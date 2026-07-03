import { create } from 'zustand'
import type { ModularNode } from '@/audio/nodes/ModularNode'
import { createAudioNode, createMasterNode, startModuleIfNeeded } from '@/lib/module-registry'
import type { ModuleType } from '@/lib/module-registry'
import { WORKSPACE_LAYOUT } from '@/lib/workspace-layout'
import type { PatchState } from '@/lib/patch-serialization'

export type ModuleEntry = {
  id: string
  type: ModuleType | 'master'
  position: { x: number; y: number }
  audioNode: ModularNode
}

export type Connection = {
  id: string
  source: string
  sourcePort: string
  target: string
  targetPort: string
}

type WorkspaceState = {
  modules: Map<string, ModuleEntry>
  connections: Connection[]
  selectedModuleIds: Set<string>
  initialized: boolean

  initWorkspace: () => void
  addModule: (type: ModuleType, position?: { x: number; y: number }, id?: string, state?: Record<string, unknown>) => string
  removeModule: (id: string) => void
  moveModule: (id: string, position: { x: number; y: number }) => void
  updateModuleState: (id: string, patch: Record<string, unknown>) => void

  addConnection: (conn: Omit<Connection, 'id'>) => string | null
  removeConnection: (id: string) => void

  getModuleById: (id: string) => ModuleEntry | undefined
  getModulesByType: (type: string) => ModuleEntry[]
  listModules: () => Array<{ id: string; type: string }>
  setSelectedModules: (ids: string[]) => void
  clearSelection: () => void
  getSelectedModules: () => ModuleEntry[]
  buildPatchFromSelection: () => PatchState | null
  spreadModules: () => void
  compactModules: () => void
  snapModulesToGrid: (gridSize?: number) => void

  clear: () => void
}

let moduleCounter = 0
const MODULE_WIDTH = WORKSPACE_LAYOUT.module.minWidth
const MODULE_HEIGHT = 210

function resolveOverlaps(
  modules: Array<{ id: string; position: { x: number; y: number } }>,
  padding: number
) {
  const next = new Map<string, { x: number; y: number }>(
    modules.map(m => [m.id, { ...m.position }])
  )

  for (let i = 0; i < 24; i++) {
    let changed = false
    for (let a = 0; a < modules.length; a++) {
      for (let b = a + 1; b < modules.length; b++) {
        const first = modules[a]
        const second = modules[b]
        const p1 = next.get(first.id)!
        const p2 = next.get(second.id)!

        const dx = p1.x - p2.x
        const dy = p1.y - p2.y
        const overlapX = MODULE_WIDTH + padding - Math.abs(dx)
        const overlapY = MODULE_HEIGHT + padding - Math.abs(dy)
        if (overlapX <= 0 || overlapY <= 0) continue

        changed = true
        if (overlapX < overlapY) {
          const shift = overlapX / 2
          const direction = dx >= 0 ? 1 : -1
          p1.x += shift * direction
          p2.x -= shift * direction
        } else {
          const shift = overlapY / 2
          const direction = dy >= 0 ? 1 : -1
          p1.y += shift * direction
          p2.y -= shift * direction
        }
      }
    }
    if (!changed) break
  }

  return next
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  modules: new Map(),
  connections: [],
  selectedModuleIds: new Set(),
  initialized: false,

  initWorkspace: () => {
    const state = get()
    if (state.initialized) return

    const master = createMasterNode()
    const modules = new Map(state.modules)
    modules.set('master', {
      id: 'master',
      type: 'master',
      position: { x: window.innerWidth - 350, y: window.innerHeight - 250 },
      audioNode: master,
    })
    set({ modules, initialized: true })
  },

  addModule: (type, position, id, initialState) => {
    const node = createAudioNode(type)
    if (id) node.id = id
    const moduleId = node.id

    if (initialState) {
      node.state = initialState
    }

    startModuleIfNeeded(node)

    const pos = position ?? {
      x: 100 + (moduleCounter % 5) * 220,
      y: 100 + Math.floor(moduleCounter / 5) * 200,
    }
    moduleCounter++

    set(state => {
      const modules = new Map(state.modules)
      modules.set(moduleId, {
        id: moduleId,
        type,
        position: pos,
        audioNode: node,
      })
      return { modules }
    })

    return moduleId
  },

  removeModule: (id) => {
    const state = get()
    const entry = state.modules.get(id)
    if (!entry || id === 'master') return

    // Remove all connections involving this module
    const toRemove = state.connections.filter(
      c => c.source === id || c.target === id
    )
    for (const conn of toRemove) {
      get().removeConnection(conn.id)
    }

    entry.audioNode.destroy()

    set(state => {
      const modules = new Map(state.modules)
      modules.delete(id)
      const selectedModuleIds = new Set(state.selectedModuleIds)
      selectedModuleIds.delete(id)
      return { modules, selectedModuleIds }
    })
  },

  moveModule: (id, position) => {
    set(state => {
      const entry = state.modules.get(id)
      if (!entry) return state
      const modules = new Map(state.modules)
      modules.set(id, { ...entry, position })
      return { modules }
    })
  },

  updateModuleState: (id, patch) => {
    const entry = get().modules.get(id)
    if (!entry) return
    const current = entry.audioNode.state
    entry.audioNode.state = { ...current, ...patch }
  },

  addConnection: (conn) => {
    const state = get()
    const source = state.modules.get(conn.source)
    const target = state.modules.get(conn.target)
    if (!source || !target) return null

    if (conn.source === conn.target) return null

    const dup = state.connections.some(
      c => c.source === conn.source && c.target === conn.target
        && c.sourcePort === conn.sourcePort && c.targetPort === conn.targetPort
    )
    if (dup) return null

    const connId = `${conn.source}:${conn.sourcePort}->${conn.target}:${conn.targetPort}`

    const isGate = (conn.sourcePort === 'gate' || conn.targetPort === 'gate')
      && typeof target.audioNode.onGateSignal === 'function'

    if (isGate) {
      const src = source.audioNode as any
      if (typeof src.addGateTarget === 'function') {
        src.addGateTarget(target.audioNode)
      }
    } else {
      source.audioNode.connect(target.audioNode, conn.targetPort, conn.sourcePort)
    }

    set(state => ({
      connections: [...state.connections, { ...conn, id: connId }]
    }))

    return connId
  },

  removeConnection: (id) => {
    const state = get()
    const conn = state.connections.find(c => c.id === id)
    if (!conn) return

    const source = state.modules.get(conn.source)
    const target = state.modules.get(conn.target)

    if (source && target) {
      const isGate = (conn.sourcePort === 'gate' || conn.targetPort === 'gate')
        && typeof target.audioNode.onGateSignal === 'function'

      if (isGate) {
        const src = source.audioNode as any
        if (typeof src.removeGateTarget === 'function') {
          src.removeGateTarget(target.audioNode)
        }
      } else {
        try {
          source.audioNode.disconnect(target.audioNode, conn.targetPort, conn.sourcePort)
        } catch {
          // May already be disconnected
        }
      }
    }

    set(state => ({
      connections: state.connections.filter(c => c.id !== id)
    }))
  },

  getModuleById: (id) => get().modules.get(id),

  getModulesByType: (type) => {
    const normalized = type.toLowerCase()
    return Array.from(get().modules.values())
      .filter(m => m.type.toLowerCase() === normalized)
  },

  listModules: () => {
    return Array.from(get().modules.entries())
      .filter(([id]) => id !== 'master')
      .map(([id, m]) => ({ id, type: m.type }))
  },

  setSelectedModules: (ids) => {
    const state = get()
    const next = new Set<string>()
    for (const id of ids) {
      if (id === 'master') continue
      if (!state.modules.has(id)) continue
      next.add(id)
    }
    set({ selectedModuleIds: next })
  },

  clearSelection: () => {
    set({ selectedModuleIds: new Set() })
  },

  getSelectedModules: () => {
    const state = get()
    return Array.from(state.selectedModuleIds)
      .map(id => state.modules.get(id))
      .filter((entry): entry is ModuleEntry => !!entry && entry.id !== 'master')
  },

  buildPatchFromSelection: () => {
    const state = get()
    const selected = get().getSelectedModules()
    if (selected.length === 0) return null

    const selectedIds = new Set(selected.map(m => m.id))
    const modules = selected.map(m => ({
      id: m.id,
      type: m.type.toLowerCase(),
      x: m.position.x,
      y: m.position.y,
      state: m.audioNode.state as Record<string, unknown>,
    }))

    const connections = state.connections
      .filter(c => selectedIds.has(c.source) && selectedIds.has(c.target))
      .map(c => ({
        sourceModuleId: c.source,
        targetModuleId: c.target,
        sourcePortId: c.sourcePort,
        targetPortId: c.targetPort,
      }))

    return { modules, connections }
  },

  spreadModules: () => {
    set(state => {
      const entries = Array.from(state.modules.values()).filter(m => m.id !== 'master')
      if (entries.length < 2) return state

      const center = entries.reduce(
        (acc, entry) => ({ x: acc.x + entry.position.x, y: acc.y + entry.position.y }),
        { x: 0, y: 0 }
      )
      center.x /= entries.length
      center.y /= entries.length

      const expanded = entries.map((entry, idx) => {
        const dx = entry.position.x - center.x
        const dy = entry.position.y - center.y
        const angle = (Math.PI * 2 * idx) / Math.max(1, entries.length)
        return {
          id: entry.id,
          position: {
            x: entry.position.x + dx * 0.16 + Math.cos(angle) * 14,
            y: entry.position.y + dy * 0.16 + Math.sin(angle) * 14,
          },
        }
      })
      const resolved = resolveOverlaps(expanded, 42)
      const modules = new Map(state.modules)
      for (const entry of entries) {
        const nextPos = resolved.get(entry.id)
        if (!nextPos) continue
        modules.set(entry.id, { ...entry, position: nextPos })
      }
      return { modules }
    })
  },

  compactModules: () => {
    set(state => {
      const entries = Array.from(state.modules.values()).filter(m => m.id !== 'master')
      if (entries.length < 2) return state

      const center = entries.reduce(
        (acc, entry) => ({ x: acc.x + entry.position.x, y: acc.y + entry.position.y }),
        { x: 0, y: 0 }
      )
      center.x /= entries.length
      center.y /= entries.length

      const compacted = entries.map(entry => ({
        id: entry.id,
        position: {
          x: center.x + (entry.position.x - center.x) * 0.88,
          y: center.y + (entry.position.y - center.y) * 0.88,
        },
      }))
      const resolved = resolveOverlaps(compacted, 18)
      const modules = new Map(state.modules)
      for (const entry of entries) {
        const nextPos = resolved.get(entry.id)
        if (!nextPos) continue
        modules.set(entry.id, { ...entry, position: nextPos })
      }
      return { modules }
    })
  },

  snapModulesToGrid: (gridSize = 20) => {
    set(state => {
      const modules = new Map(state.modules)
      for (const [id, entry] of state.modules.entries()) {
        if (id === 'master') continue
        modules.set(id, {
          ...entry,
          position: {
            x: Math.round(entry.position.x / gridSize) * gridSize,
            y: Math.round(entry.position.y / gridSize) * gridSize,
          },
        })
      }
      return { modules }
    })
  },

  clear: () => {
    const state = get()
    for (const conn of [...state.connections]) {
      get().removeConnection(conn.id)
    }
    for (const [id, entry] of state.modules) {
      if (id !== 'master') {
        entry.audioNode.destroy()
      }
    }
    const master = state.modules.get('master')
    const modules = new Map<string, ModuleEntry>()
    if (master) modules.set('master', master)
    moduleCounter = 0
    set({ modules, connections: [], selectedModuleIds: new Set() })
  },
}))
