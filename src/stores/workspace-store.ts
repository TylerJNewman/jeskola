import { create } from 'zustand'
import type { ModularNode } from '@/audio/nodes/ModularNode'
import { createAudioNode, createMasterNode, startModuleIfNeeded } from '@/lib/module-registry'
import type { ModuleType } from '@/lib/module-registry'

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

  clear: () => void
}

let moduleCounter = 0

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  modules: new Map(),
  connections: [],
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
      return { modules }
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
    set({ modules, connections: [] })
  },
}))
