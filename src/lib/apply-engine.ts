import { useWorkspaceStore } from '@/stores/workspace-store'
import { useTransportStore } from '@/stores/transport-store'
import { transport } from '@/audio/Transport'
import { MODULE_PORTS } from '@/lib/module-registry'
import type { ModuleType } from '@/lib/module-registry'

export type ApplyMode = 'replace' | 'add_chain' | 'add_modulation' | 'add_send' | 'add_layer'
export type ApplyTarget = 'before_module' | 'after_module' | 'parallel_to_module' | 'master_send' | 'auto'

export interface ApplyOptions {
  mode: ApplyMode
  targetType?: ApplyTarget
  targetModuleId?: string
}

export interface ApplySummary {
  modulesAdded: number
  connectionsAdded: number
  routesRewired: number
  idsRenamed: number
  warnings: string[]
}

interface PatchModule {
  id: string
  type: string
  x: number
  y: number
  state: Record<string, unknown>
}

interface PatchConnection {
  sourceModuleId: string
  targetModuleId: string
  sourcePortId: string
  targetPortId: string
}

interface PatchState {
  modules: PatchModule[]
  connections: PatchConnection[]
}

interface PlannedApply {
  patch: PatchState
  warnings: string[]
  idsRenamed: number
  connectionsToRemove: PatchConnection[]
  connectionsToAdd: PatchConnection[]
}

function parsePatch(json: string): PatchState | null {
  try {
    const raw = JSON.parse(json)
    if (!raw || typeof raw !== 'object') return null
    return {
      modules: Array.isArray(raw.modules) ? raw.modules : [],
      connections: Array.isArray(raw.connections) ? raw.connections : [],
    }
  } catch {
    return null
  }
}

function clonePatch(state: PatchState): PatchState {
  return JSON.parse(JSON.stringify(state))
}

function remapIds(patch: PatchState): { patch: PatchState; renamed: number } {
  const store = useWorkspaceStore.getState()
  const cloned = clonePatch(patch)
  const idMap = new Map<string, string>()
  let renamed = 0

  for (const mod of cloned.modules) {
    if (!store.modules.has(mod.id)) continue
    let counter = 1
    let newId = `${mod.id}-${counter}`
    while (store.modules.has(newId) || cloned.modules.some(m => m !== mod && m.id === newId)) {
      counter++
      newId = `${mod.id}-${counter}`
    }
    idMap.set(mod.id, newId)
    mod.id = newId
    renamed++
  }

  for (const conn of cloned.connections) {
    if (idMap.has(conn.sourceModuleId)) conn.sourceModuleId = idMap.get(conn.sourceModuleId)!
    if (idMap.has(conn.targetModuleId)) conn.targetModuleId = idMap.get(conn.targetModuleId)!
  }

  return { patch: cloned, renamed }
}

function inferEntry(patch: PatchState): string | null {
  const hasIncoming = new Set(
    patch.connections
      .filter(c => c.targetPortId === 'audio')
      .map(c => c.targetModuleId)
  )
  const entry = patch.modules.find(m => !hasIncoming.has(m.id))
  return entry?.id ?? patch.modules[0]?.id ?? null
}

function inferExit(patch: PatchState): string | null {
  const masterConn = patch.connections.find(c => c.targetModuleId === 'master')
  if (masterConn) return masterConn.sourceModuleId
  const hasOutgoing = new Set(
    patch.connections
      .filter(c => c.sourcePortId === 'audio')
      .map(c => c.sourceModuleId)
  )
  const noOut = patch.modules.find(m => !hasOutgoing.has(m.id))
  return noOut?.id ?? patch.modules[patch.modules.length - 1]?.id ?? null
}

function inferModSource(patch: PatchState): string | null {
  for (const pref of ['lfo', 'adsr', 'sequencer']) {
    const found = patch.modules.find(m => m.type.toLowerCase() === pref)
    if (found) return found.id
  }
  return inferEntry(patch)
}

function getCvPorts(moduleType: string): string[] {
  const ports = MODULE_PORTS[moduleType as keyof typeof MODULE_PORTS]
  if (!ports) return []
  return ports.inputs.filter(p => p.type === 'cv').map(p => p.id)
}

function buildApplyPlan(patch: PatchState, options: ApplyOptions): PlannedApply {
  const store = useWorkspaceStore.getState()
  const warnings: string[] = []
  const { patch: remapped, renamed } = remapIds(patch)
  const entryId = inferEntry(remapped)
  const exitId = inferExit(remapped)

  const internalConns = remapped.connections.filter(c => c.targetModuleId !== 'master')
  const connectionsToRemove: PatchConnection[] = []
  const connectionsToAdd: PatchConnection[] = [...internalConns]

  const targetId = options.targetModuleId || null
  const targetType = options.targetType || 'auto'

  if (options.mode === 'add_chain') {
    if (targetId && entryId && exitId) {
      if (targetType === 'after_module') {
        const outConn = store.connections.find(c => c.source === targetId && c.sourcePort === 'audio')
        if (outConn) {
          connectionsToRemove.push({
            sourceModuleId: outConn.source,
            targetModuleId: outConn.target,
            sourcePortId: outConn.sourcePort,
            targetPortId: outConn.targetPort,
          })
          connectionsToAdd.push({
            sourceModuleId: targetId,
            targetModuleId: entryId,
            sourcePortId: 'audio',
            targetPortId: 'audio',
          })
          connectionsToAdd.push({
            sourceModuleId: exitId,
            targetModuleId: outConn.target,
            sourcePortId: 'audio',
            targetPortId: outConn.targetPort,
          })
        } else {
          connectionsToAdd.push({
            sourceModuleId: targetId,
            targetModuleId: entryId,
            sourcePortId: 'audio',
            targetPortId: 'audio',
          })
          connectionsToAdd.push({
            sourceModuleId: exitId,
            targetModuleId: 'master',
            sourcePortId: 'audio',
            targetPortId: 'audio',
          })
        }
      } else if (targetType === 'before_module') {
        const inConn = store.connections.find(c => c.target === targetId && c.targetPort === 'audio')
        if (inConn) {
          connectionsToRemove.push({
            sourceModuleId: inConn.source,
            targetModuleId: inConn.target,
            sourcePortId: inConn.sourcePort,
            targetPortId: inConn.targetPort,
          })
          connectionsToAdd.push({
            sourceModuleId: inConn.source,
            targetModuleId: entryId,
            sourcePortId: inConn.sourcePort,
            targetPortId: 'audio',
          })
          connectionsToAdd.push({
            sourceModuleId: exitId,
            targetModuleId: targetId,
            sourcePortId: 'audio',
            targetPortId: 'audio',
          })
        }
      } else {
        connectionsToAdd.push({
          sourceModuleId: targetId || exitId,
          targetModuleId: entryId,
          sourcePortId: 'audio',
          targetPortId: 'audio',
        })
        connectionsToAdd.push({
          sourceModuleId: exitId,
          targetModuleId: 'master',
          sourcePortId: 'audio',
          targetPortId: 'audio',
        })
      }
    } else if (exitId) {
      connectionsToAdd.push({
        sourceModuleId: exitId,
        targetModuleId: 'master',
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
    }
  } else if (options.mode === 'add_send') {
    const sendSource = targetId || (() => {
      const toMaster = store.connections.find(c => c.target === 'master' && c.targetPort === 'audio')
      return toMaster?.source ?? null
    })()

    if (sendSource && entryId && exitId) {
      connectionsToAdd.push({
        sourceModuleId: sendSource,
        targetModuleId: entryId,
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
      connectionsToAdd.push({
        sourceModuleId: exitId,
        targetModuleId: 'master',
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
    }
  } else if (options.mode === 'add_layer') {
    if (targetId && entryId) {
      connectionsToAdd.push({
        sourceModuleId: targetId,
        targetModuleId: entryId,
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
    }
    if (exitId) {
      connectionsToAdd.push({
        sourceModuleId: exitId,
        targetModuleId: 'master',
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
    }
  } else if (options.mode === 'add_modulation') {
    const modSourceId = inferModSource(remapped)
    const modTargetId = targetId || (() => {
      const existing = store.listModules()
      return existing[0]?.id ?? null
    })()

    if (modSourceId && modTargetId) {
      const modTarget = store.modules.get(modTargetId)
      if (modTarget) {
        const cvPorts = getCvPorts(modTarget.type)
        const preferredOrder = ['cutoff', 'level', 'freq', 'res', 'drive', 'mix', 'time', 'feedback']
        const targetPort = preferredOrder.find(p => cvPorts.includes(p)) || cvPorts[0]

        if (targetPort) {
          connectionsToAdd.push({
            sourceModuleId: modSourceId,
            targetModuleId: modTargetId,
            sourcePortId: 'audio',
            targetPortId: targetPort,
          })
        } else {
          warnings.push(`No CV input found on ${modTargetId}`)
        }
      }
    }
    if (exitId && exitId !== modSourceId) {
      connectionsToAdd.push({
        sourceModuleId: exitId,
        targetModuleId: 'master',
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
    }
  }

  return {
    patch: remapped,
    warnings,
    idsRenamed: renamed,
    connectionsToRemove,
    connectionsToAdd,
  }
}

export function previewApply(jsonString: string, options: ApplyOptions): ApplySummary {
  const patch = parsePatch(jsonString)
  if (!patch) return { modulesAdded: 0, connectionsAdded: 0, routesRewired: 0, idsRenamed: 0, warnings: ['Invalid JSON'] }

  if (options.mode === 'replace') {
    return {
      modulesAdded: patch.modules.length,
      connectionsAdded: patch.connections.length,
      routesRewired: 0,
      idsRenamed: 0,
      warnings: [],
    }
  }

  const plan = buildApplyPlan(patch, options)
  return {
    modulesAdded: plan.patch.modules.length,
    connectionsAdded: plan.connectionsToAdd.length,
    routesRewired: plan.connectionsToRemove.length,
    idsRenamed: plan.idsRenamed,
    warnings: plan.warnings,
  }
}

export function applyPatch(jsonString: string, options: ApplyOptions): ApplySummary {
  const store = useWorkspaceStore.getState()

  const patch = parsePatch(jsonString)
  if (!patch) return { modulesAdded: 0, connectionsAdded: 0, routesRewired: 0, idsRenamed: 0, warnings: ['Invalid JSON'] }

  if (transport.isPlaying) {
    useTransportStore.getState().stop()
  }

  const plan = buildApplyPlan(patch, options)

  let modulesAdded = 0
  for (const mod of plan.patch.modules) {
    try {
      store.addModule(mod.type as ModuleType, { x: mod.x, y: mod.y }, mod.id, mod.state)
      modulesAdded++
    } catch {
      plan.warnings.push(`Failed to create ${mod.id}`)
    }
  }

  for (const conn of plan.connectionsToRemove) {
    const existing = store.connections.find(
      c => c.source === conn.sourceModuleId && c.target === conn.targetModuleId
        && c.sourcePort === conn.sourcePortId && c.targetPort === conn.targetPortId
    )
    if (existing) {
      store.removeConnection(existing.id)
    }
  }

  let connectionsAdded = 0
  for (const conn of plan.connectionsToAdd) {
    const result = store.addConnection({
      source: conn.sourceModuleId,
      sourcePort: conn.sourcePortId,
      target: conn.targetModuleId,
      targetPort: conn.targetPortId,
    })
    if (result) connectionsAdded++
  }

  return {
    modulesAdded,
    connectionsAdded,
    routesRewired: plan.connectionsToRemove.length,
    idsRenamed: plan.idsRenamed,
    warnings: plan.warnings,
  }
}
