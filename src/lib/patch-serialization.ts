import { useWorkspaceStore } from '@/stores/workspace-store'
import { useTransportStore } from '@/stores/transport-store'
import { transport } from '@/audio/Transport'
import type { ModuleType } from '@/lib/module-registry'

export interface PatchModule {
  id: string
  type: string
  x: number
  y: number
  state: Record<string, unknown>
}

export interface PatchConnection {
  sourceModuleId: string
  targetModuleId: string
  sourcePortId: string
  targetPortId: string
}

export interface PatchState {
  transport?: { bpm: number; ticksPerBeat: number }
  modules: PatchModule[]
  connections: PatchConnection[]
}

export function exportPatch(): string {
  const store = useWorkspaceStore.getState()

  const state: PatchState = {
    transport: {
      bpm: transport.bpm,
      ticksPerBeat: transport.ticksPerBeat,
    },
    modules: Array.from(store.modules.values())
      .filter(m => m.id !== 'master')
      .map(m => ({
        id: m.id,
        type: m.type.toLowerCase(),
        x: m.position.x,
        y: m.position.y,
        state: m.audioNode.state,
      })),
    connections: store.connections.map(c => ({
      sourceModuleId: c.source,
      targetModuleId: c.target,
      sourcePortId: c.sourcePort,
      targetPortId: c.targetPort,
    })),
  }

  return JSON.stringify(state)
}

export function importPatch(jsonString: string): { modulesCreated: number; connectionsCreated: number; warnings: string[] } {
  const store = useWorkspaceStore.getState()
  const warnings: string[] = []

  let raw: unknown
  try {
    raw = JSON.parse(jsonString)
  } catch {
    return { modulesCreated: 0, connectionsCreated: 0, warnings: ['Invalid JSON'] }
  }

  if (!raw || typeof raw !== 'object') {
    return { modulesCreated: 0, connectionsCreated: 0, warnings: ['Invalid patch format'] }
  }

  const patch = raw as Record<string, unknown>

  if (patch.transport && typeof patch.transport === 'object') {
    const t = patch.transport as Record<string, unknown>
    if (typeof t.bpm === 'number') {
      useTransportStore.getState().setBpm(t.bpm)
    }
    if (typeof t.ticksPerBeat === 'number') {
      transport.setTicksPerBeat(t.ticksPerBeat)
    }
  }

  if (transport.isPlaying) {
    useTransportStore.getState().stop()
  }

  store.clear()

  const rawModules = Array.isArray(patch.modules) ? patch.modules : []
  const seenIds = new Set<string>()
  let modulesCreated = 0

  for (const m of rawModules) {
    if (!m || typeof m !== 'object') continue
    const mod = m as Record<string, unknown>
    const id = typeof mod.id === 'string' ? mod.id : null
    const type = typeof mod.type === 'string' ? mod.type.toLowerCase() : null
    if (!id || !type || id === 'master' || seenIds.has(id)) continue
    seenIds.add(id)

    const x = typeof mod.x === 'number' ? mod.x : 0
    const y = typeof mod.y === 'number' ? mod.y : 0
    const state = (mod.state && typeof mod.state === 'object') ? mod.state as Record<string, unknown> : undefined

    try {
      store.addModule(type as ModuleType, { x, y }, id, state)
      modulesCreated++
    } catch {
      warnings.push(`Failed to create module ${id} (${type})`)
    }
  }

  const rawConns = Array.isArray(patch.connections) ? patch.connections : []
  const validIds = new Set([...seenIds, 'master'])
  let connectionsCreated = 0

  for (const c of rawConns) {
    if (!c || typeof c !== 'object') continue
    const conn = c as Record<string, unknown>
    const source = typeof conn.sourceModuleId === 'string' ? conn.sourceModuleId : null
    const target = typeof conn.targetModuleId === 'string' ? conn.targetModuleId : null
    if (!source || !target) continue
    if (!validIds.has(source) || !validIds.has(target)) continue

    const sourcePort = typeof conn.sourcePortId === 'string' ? conn.sourcePortId : 'audio'
    const targetPort = typeof conn.targetPortId === 'string' ? conn.targetPortId : 'audio'

    const result = store.addConnection({
      source,
      sourcePort,
      target,
      targetPort,
    })

    if (result) {
      connectionsCreated++
    } else {
      warnings.push(`Failed to connect ${source}:${sourcePort} → ${target}:${targetPort}`)
    }
  }

  return { modulesCreated, connectionsCreated, warnings }
}
