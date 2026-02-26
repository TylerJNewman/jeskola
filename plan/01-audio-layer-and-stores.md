# Phase 01 — Audio Layer + Zustand Stores

## Goal
Copy the audio layer unchanged. Create Zustand stores that will bridge audio nodes ↔ React UI. Create the `useAudioEngine` hook for initialization. Verify audio can be initialized programmatically.

## Depends On
Phase 00 (scaffold must be running)

---

## Steps

### 1. Verify audio layer is untouched

The entire `src/audio/` directory stays exactly as-is:

```
src/audio/
  AudioEngine.ts
  Transport.ts
  nodes/
    ModularNode.ts
    OscillatorModule.ts
    FilterModule.ts
    DelayModule.ts
    DistortionModule.ts
    GainModule.ts
    AdsrModule.ts
    LfoModule.ts
    SequencerModule.ts
    KeyboardModule.ts
    MasterNode.ts
  sequencer/
    types.ts
```

No changes. If any imports broke from the tsconfig change, fix them (they shouldn't — these files don't import React or CSS).

### 2. Create module registry

Create `src/lib/module-registry.ts`:

```ts
import type { ModularNode } from '@/audio/nodes/ModularNode'
import { OscillatorModule } from '@/audio/nodes/OscillatorModule'
import { FilterModule } from '@/audio/nodes/FilterModule'
import { DelayModule } from '@/audio/nodes/DelayModule'
import { DistortionModule } from '@/audio/nodes/DistortionModule'
import { GainModule } from '@/audio/nodes/GainModule'
import { AdsrModule } from '@/audio/nodes/AdsrModule'
import { LfoModule } from '@/audio/nodes/LfoModule'
import { SequencerModule } from '@/audio/nodes/SequencerModule'
import { KeyboardModule } from '@/audio/nodes/KeyboardModule'
import { MasterNode } from '@/audio/nodes/MasterNode'

export type ModuleType =
  | 'oscillator'
  | 'filter'
  | 'delay'
  | 'distortion'
  | 'gain'
  | 'adsr'
  | 'lfo'
  | 'sequencer'
  | 'keyboard'

// Display labels for palette
export const MODULE_LABELS: Record<ModuleType, string> = {
  oscillator: 'Oscillator',
  filter: 'Filter',
  delay: 'Delay',
  distortion: 'Distortion',
  gain: 'Gain',
  adsr: 'ADSR',
  lfo: 'LFO',
  sequencer: 'Sequencer',
  keyboard: 'Keyboard',
}

export const MODULE_TYPES: ModuleType[] = [
  'oscillator', 'filter', 'adsr', 'lfo', 'keyboard',
  'delay', 'distortion', 'gain', 'sequencer',
]

// Default state for each module type (matches what old main.ts used)
export const DEFAULT_STATES: Record<ModuleType, Record<string, unknown>> = {
  oscillator: { octave: 0, semitone: 0, cents: 0, freq: 440, type: 'sine', mode: 'pitch' },
  filter: { cutoff: 1000, res: 1, type: 'lowpass' },
  delay: { time: 0.4, feedback: 0.4, mix: 0.5 },
  distortion: { drive: 1.0, mix: 0.5, output: 0.8 },
  gain: { level: 0.5 },
  adsr: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.5 },
  lfo: { rate: 1.0, depth: 0.5, type: 'sine' },
  sequencer: {}, // Sequencer handles its own default via createEmptyPattern
  keyboard: { octaveOffset: 0, baseMidi: 60, enabled: true },
}

/**
 * Create a fresh audio node for the given module type.
 * The caller must call start() on oscillator-based modules.
 */
export function createAudioNode(type: ModuleType): ModularNode {
  switch (type) {
    case 'oscillator': return new OscillatorModule()
    case 'filter': return new FilterModule()
    case 'delay': return new DelayModule()
    case 'distortion': return new DistortionModule()
    case 'gain': return new GainModule()
    case 'adsr': return new AdsrModule()
    case 'lfo': return new LfoModule()
    case 'sequencer': return new SequencerModule()
    case 'keyboard': return new KeyboardModule()
    default: throw new Error(`Unknown module type: ${type}`)
  }
}

/**
 * Create the master node (singleton per workspace).
 */
export function createMasterNode(): MasterNode {
  const master = new MasterNode()
  master.id = 'master'
  return master
}

/**
 * Modules that need start() called after creation.
 */
export function startModuleIfNeeded(node: ModularNode): void {
  if (node instanceof OscillatorModule) node.start()
  if (node instanceof LfoModule) node.start()
  // ADSR ConstantSourceNode starts in its constructor
  // Sequencer registers with Transport in constructor
  // Keyboard ConstantSourceNodes start in constructor
}

/**
 * Port definitions for each module type.
 * Used by React Flow to render Handle components.
 */
export type PortDef = {
  id: string
  label: string
  type: 'audio' | 'cv' | 'gate'
}

export type ModulePortConfig = {
  inputs: PortDef[]
  outputs: PortDef[]
}

export const MODULE_PORTS: Record<ModuleType | 'master', ModulePortConfig> = {
  oscillator: {
    inputs: [
      { id: 'freq', label: '1V/OCT', type: 'cv' },
      { id: 'gain', label: 'GAIN', type: 'cv' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'audio' },
    ],
  },
  filter: {
    inputs: [
      { id: 'audio', label: 'IN', type: 'audio' },
      { id: 'cutoff', label: 'CV CUT', type: 'cv' },
      { id: 'res', label: 'CV RES', type: 'cv' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'audio' },
    ],
  },
  delay: {
    inputs: [
      { id: 'audio', label: 'IN', type: 'audio' },
      { id: 'time', label: 'TIME', type: 'cv' },
      { id: 'feedback', label: 'FB', type: 'cv' },
      { id: 'mix', label: 'MIX', type: 'cv' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'audio' },
    ],
  },
  distortion: {
    inputs: [
      { id: 'audio', label: 'IN', type: 'audio' },
      { id: 'drive', label: 'DRIVE', type: 'cv' },
      { id: 'mix', label: 'MIX', type: 'cv' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'audio' },
    ],
  },
  gain: {
    inputs: [
      { id: 'audio', label: 'IN', type: 'audio' },
      { id: 'level', label: 'LEVEL', type: 'cv' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'audio' },
    ],
  },
  adsr: {
    inputs: [
      { id: 'gate', label: 'GATE', type: 'gate' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'cv' },
    ],
  },
  lfo: {
    inputs: [],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'cv' },
    ],
  },
  sequencer: {
    inputs: [],
    outputs: [
      { id: 'audio', label: 'NOTE', type: 'cv' },
      { id: 'gate', label: 'GATE', type: 'gate' },
    ],
  },
  keyboard: {
    inputs: [],
    outputs: [
      { id: 'audio', label: 'NOTE', type: 'cv' },
      { id: 'gate', label: 'GATE', type: 'gate' },
    ],
  },
  master: {
    inputs: [
      { id: 'audio', label: 'IN', type: 'audio' },
    ],
    outputs: [],
  },
}
```

### 3. Create workspace store

Create `src/stores/workspace-store.ts`:

```ts
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
  source: string      // module ID
  sourcePort: string   // port ID (e.g. 'audio', 'gate')
  target: string       // module ID
  targetPort: string   // port ID
}

type WorkspaceState = {
  modules: Map<string, ModuleEntry>
  connections: Connection[]
  initialized: boolean

  // Actions
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

    // Destroy audio node
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

    // No self-connections
    if (conn.source === conn.target) return null

    // No duplicates
    const dup = state.connections.some(
      c => c.source === conn.source && c.target === conn.target
        && c.sourcePort === conn.sourcePort && c.targetPort === conn.targetPort
    )
    if (dup) return null

    const connId = `${conn.source}:${conn.sourcePort}->${conn.target}:${conn.targetPort}`

    // Determine if this is a gate connection
    const isGate = (conn.sourcePort === 'gate' || conn.targetPort === 'gate')
      && typeof target.audioNode.onGateSignal === 'function'

    if (isGate) {
      // Use gate signal interface
      const src = source.audioNode as any
      if (typeof src.addGateTarget === 'function') {
        src.addGateTarget(target.audioNode)
      }
    } else {
      // Normal audio/CV routing
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
    // Remove all connections first
    for (const conn of [...state.connections]) {
      get().removeConnection(conn.id)
    }
    // Remove all modules except master
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
```

### 4. Create transport store

Create `src/stores/transport-store.ts`:

```ts
import { create } from 'zustand'
import { transport } from '@/audio/Transport'

type TransportState = {
  bpm: number
  isPlaying: boolean
  currentStep: number
  ticksPerBeat: number
  swing: number

  setBpm: (bpm: number) => void
  play: () => void
  stop: () => void
  setSwing: (swing: number) => void
  setTicksPerBeat: (tpb: number) => void
  syncFromTransport: () => void
}

export const useTransportStore = create<TransportState>((set) => ({
  bpm: 120,
  isPlaying: false,
  currentStep: -1,
  ticksPerBeat: 4,
  swing: 0.5,

  setBpm: (bpm) => {
    transport.setBpm(bpm)
    set({ bpm: transport.bpm })
  },

  play: () => {
    transport.play()
    set({ isPlaying: true })
  },

  stop: () => {
    transport.stop()
    set({ isPlaying: false, currentStep: -1 })
  },

  setSwing: (swing) => {
    transport.setSwing(swing)
    set({ swing: transport.swing })
  },

  setTicksPerBeat: (tpb) => {
    transport.setTicksPerBeat(tpb)
    set({ ticksPerBeat: transport.ticksPerBeat })
  },

  syncFromTransport: () => {
    set({
      bpm: transport.bpm,
      isPlaying: transport.isPlaying,
      currentStep: transport.currentTick,
      ticksPerBeat: transport.ticksPerBeat,
      swing: transport.swing,
    })
  },
}))
```

### 5. Create keyboard store

Create `src/stores/keyboard-store.ts`:

```ts
import { create } from 'zustand'
import type { KeyboardModule } from '@/audio/nodes/KeyboardModule'

const KEY_TO_SEMITONE: Record<string, number> = {
  a: 0,  // C
  w: 1,  // C#
  s: 2,  // D
  e: 3,  // D#
  d: 4,  // E
  f: 5,  // F
  g: 7,  // G
}

export const OCTAVE_DOWN_KEY = 'z'
export const OCTAVE_UP_KEY = 'x'

type KeyboardState = {
  heldKeys: string[]
  keyDown: (key: string, modules: KeyboardModule[]) => void
  keyUp: (key: string, modules: KeyboardModule[]) => void
  adjustOctave: (delta: number, modules: KeyboardModule[]) => void
  releaseAll: (modules: KeyboardModule[]) => void
}

function applyTopNote(heldKeys: string[], modules: KeyboardModule[]) {
  if (modules.length === 0) return

  const topKey = heldKeys[heldKeys.length - 1]
  if (!topKey) {
    modules.forEach(kb => kb.noteOff())
    return
  }

  const semitone = KEY_TO_SEMITONE[topKey]
  if (semitone === undefined) return

  modules.forEach(kb => {
    kb.noteOn(kb.baseMidi + kb.octaveOffset * 12 + semitone)
  })
}

export { KEY_TO_SEMITONE }

export const useKeyboardStore = create<KeyboardState>((set, get) => ({
  heldKeys: [],

  keyDown: (key, modules) => {
    const state = get()
    if (state.heldKeys.includes(key)) return
    const next = [...state.heldKeys, key]
    set({ heldKeys: next })
    applyTopNote(next, modules)
  },

  keyUp: (key, modules) => {
    const state = get()
    const idx = state.heldKeys.indexOf(key)
    if (idx === -1) return
    const next = state.heldKeys.filter((_, i) => i !== idx)
    set({ heldKeys: next })
    applyTopNote(next, modules)
  },

  adjustOctave: (delta, modules) => {
    modules.forEach(kb => kb.adjustOctave(delta))
  },

  releaseAll: (modules) => {
    set({ heldKeys: [] })
    modules.forEach(kb => kb.noteOff())
  },
}))
```

### 6. Create useAudioEngine hook

Create `src/hooks/use-audio-engine.ts`:

```ts
import { useState, useCallback } from 'react'
import { audioEngine } from '@/audio/AudioEngine'
import { useWorkspaceStore } from '@/stores/workspace-store'

export function useAudioEngine() {
  const [audioState, setAudioState] = useState<'stopped' | 'initializing' | 'running'>('stopped')
  const initWorkspace = useWorkspaceStore(s => s.initWorkspace)

  const initialize = useCallback(async () => {
    if (audioState !== 'stopped') return
    setAudioState('initializing')

    await audioEngine.init()
    initWorkspace()
    setAudioState('running')
  }, [audioState, initWorkspace])

  const toggle = useCallback(async () => {
    if (audioState === 'stopped') {
      await initialize()
      return
    }

    const ctx = audioEngine.getContext()
    if (ctx.state === 'running') {
      ctx.suspend()
      setAudioState('stopped')
    } else {
      ctx.resume()
      setAudioState('running')
    }
  }, [audioState, initialize])

  return {
    audioState,
    initialize,
    toggle,
  }
}
```

### 7. Wire the audio toggle into App

Update `src/components/App.tsx` to use the hook:

```tsx
import { useAudioEngine } from '@/hooks/use-audio-engine'

export function App() {
  const { audioState, toggle } = useAudioEngine()

  return (
    <div className="flex flex-col h-screen bg-bg">
      <header className="h-[76px] bg-panel border-b border-border-light shadow-sm flex items-center px-4 z-[100] gap-4">
        <h1 className="text-sm font-semibold tracking-[2px] text-text-main">
          SYNTHESIS
        </h1>
        <button
          onClick={toggle}
          className={`text-[10px] uppercase tracking-wide px-3 py-1.5 border rounded-[4px] transition-colors cursor-pointer ${
            audioState === 'running'
              ? 'bg-accent-orange text-white border-accent-orange'
              : 'bg-panel border-border text-text-light hover:border-accent-orange'
          }`}
        >
          {audioState === 'stopped' ? 'START AUDIO' :
           audioState === 'initializing' ? 'INITIALIZING...' :
           'STOP AUDIO'}
        </button>
      </header>

      <main className="flex-1 relative bg-bg">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-text-muted text-xs uppercase tracking-wide">
            Audio: {audioState}
          </p>
        </div>
      </main>

      <aside className="fixed right-0 top-[76px] bottom-0 w-[140px] bg-panel border-l border-border-light z-[50] flex flex-col gap-2 p-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[1px] text-text-muted mb-2">
          Modules
        </h2>
        {['Oscillator', 'Filter', 'ADSR', 'LFO', 'Keyboard', 'Delay', 'Distortion', 'Gain', 'Sequencer'].map(name => (
          <button
            key={name}
            className="text-[10px] uppercase tracking-wide px-2 py-1.5 bg-bg border border-border rounded-[4px] text-text-light hover:border-accent-orange hover:text-accent-orange transition-colors cursor-pointer"
          >
            + {name}
          </button>
        ))}
      </aside>
    </div>
  )
}
```

---

## Files Created/Modified

| Action | File |
|--------|------|
| Create | `src/lib/module-registry.ts` |
| Create | `src/stores/workspace-store.ts` |
| Create | `src/stores/transport-store.ts` |
| Create | `src/stores/keyboard-store.ts` |
| Create | `src/hooks/use-audio-engine.ts` |
| Modify | `src/components/App.tsx` |

## Verify It Works

1. `npm run dev` — no TypeScript errors, app loads
2. Click "START AUDIO" — button turns orange, text changes to "STOP AUDIO"
3. Open browser DevTools console:
   ```js
   // Verify stores work
   const ws = window.__ZUSTAND_DEVTOOLS__  // if devtools middleware added
   // Or import directly in console won't work, but we can verify via React DevTools
   ```
4. Click "STOP AUDIO" — button reverts to default style
5. No console errors about AudioContext or missing modules
6. `npm run build` succeeds
