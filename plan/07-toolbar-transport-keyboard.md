# Phase 07 — Toolbar, Transport Controls, File I/O, Keyboard Handler

## Goal
Build the top toolbar with transport controls (play/stop, BPM), file operations (save/load patch), and the global QWERTY keyboard handler. After this phase, the synth is fully playable — you can build patches, play sequences, trigger notes from the keyboard, and save/load your work.

## Depends On
Phase 05-06 (all modules working)

---

## Steps

### 1. Create TransportControls

Create `src/components/toolbar/TransportControls.tsx`:

```tsx
import { useTransportStore } from '@/stores/transport-store'
import { useAudioEngine } from '@/hooks/use-audio-engine'

export function TransportControls() {
  const { isPlaying, bpm, setBpm, play, stop } = useTransportStore()
  const { initialize, audioState } = useAudioEngine()

  const handlePlayStop = async () => {
    if (audioState === 'stopped') await initialize()
    if (isPlaying) {
      stop()
    } else {
      play()
    }
  }

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBpm(parseInt(e.target.value, 10) || 120)
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handlePlayStop}
        className={`text-[10px] uppercase tracking-wide px-2.5 py-1 border rounded-[4px] transition-colors cursor-pointer ${
          isPlaying
            ? 'bg-accent-orange text-white border-accent-orange'
            : 'bg-panel border-border text-text-light hover:border-accent-orange'
        }`}
      >
        {isPlaying ? '■ STOP' : '▶ PLAY'}
      </button>
      <input
        type="number"
        value={bpm}
        onChange={handleBpmChange}
        min={20}
        max={300}
        className="w-14 text-[11px] text-center bg-bg border border-border rounded-[4px] px-1 py-1 text-text-main tabular-nums focus:outline-none focus:border-accent-orange"
      />
      <span className="text-[9px] text-text-muted uppercase">BPM</span>
    </div>
  )
}
```

### 2. Create FileControls

Create `src/components/toolbar/FileControls.tsx`:

```tsx
import { useRef } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useTransportStore } from '@/stores/transport-store'
import { useAudioEngine } from '@/hooks/use-audio-engine'
import { exportPatch, importPatch } from '@/lib/patch-serialization'

export function FileControls() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { initialize, audioState } = useAudioEngine()

  const handleSave = () => {
    const json = exportPatch()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'jeskola_patch.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleLoad = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (audioState === 'stopped') await initialize()

    const text = await file.text()
    importPatch(text)

    // Reset file input so same file can be loaded again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleSave}
        className="text-[10px] uppercase tracking-wide px-2.5 py-1 bg-panel border border-border rounded-[4px] text-text-light hover:border-accent-orange transition-colors cursor-pointer"
      >
        Save
      </button>
      <button
        onClick={handleLoad}
        className="text-[10px] uppercase tracking-wide px-2.5 py-1 bg-panel border border-border rounded-[4px] text-text-light hover:border-accent-orange transition-colors cursor-pointer"
      >
        Load
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
```

### 3. Create patch serialization helpers

Create `src/lib/patch-serialization.ts`:

```ts
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

/**
 * Export current workspace state as JSON string.
 * Matches the exact format the old app produced.
 */
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

/**
 * Import a patch JSON string into the workspace.
 * Handles backward-compatible normalization.
 */
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

  // Restore transport state
  if (patch.transport && typeof patch.transport === 'object') {
    const t = patch.transport as Record<string, unknown>
    if (typeof t.bpm === 'number') {
      useTransportStore.getState().setBpm(t.bpm)
    }
    if (typeof t.ticksPerBeat === 'number') {
      transport.setTicksPerBeat(t.ticksPerBeat)
    }
  }

  // Stop transport before clearing
  if (transport.isPlaying) {
    useTransportStore.getState().stop()
  }

  // Clear existing workspace
  store.clear()

  // Normalize and create modules
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
    } catch (e) {
      warnings.push(`Failed to create module ${id} (${type})`)
    }
  }

  // Create connections
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
```

### 4. Create AudioToggle component

Create `src/components/toolbar/AudioToggle.tsx`:

```tsx
import { useAudioEngine } from '@/hooks/use-audio-engine'

export function AudioToggle() {
  const { audioState, toggle } = useAudioEngine()

  return (
    <button
      onClick={toggle}
      className={`text-[10px] uppercase tracking-wide px-2.5 py-1 border rounded-[4px] transition-colors cursor-pointer ${
        audioState === 'running'
          ? 'bg-accent-orange text-white border-accent-orange'
          : 'bg-panel border-border text-text-light hover:border-accent-orange'
      }`}
    >
      {audioState === 'stopped' ? 'START AUDIO' :
       audioState === 'initializing' ? 'INIT...' :
       'STOP AUDIO'}
    </button>
  )
}
```

### 5. Create Toolbar component

Create `src/components/toolbar/Toolbar.tsx`:

```tsx
import { TransportControls } from './TransportControls'
import { FileControls } from './FileControls'
import { AudioToggle } from './AudioToggle'

export function Toolbar() {
  return (
    <header className="h-[44px] bg-panel border-b border-border-light shadow-sm flex items-center px-4 z-[100] shrink-0 gap-4">
      {/* Logo */}
      <h1 className="text-sm font-semibold tracking-[2px] text-text-main mr-4">
        SYNTHESIS
      </h1>

      {/* Divider */}
      <div className="w-px h-5 bg-border-light" />

      {/* Transport */}
      <TransportControls />

      {/* Divider */}
      <div className="w-px h-5 bg-border-light" />

      {/* File */}
      <FileControls />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Audio */}
      <AudioToggle />
    </header>
  )
}
```

### 6. Create keyboard handler hook

Create `src/hooks/use-keyboard.ts`:

```tsx
import { useEffect } from 'react'
import { useKeyboardStore, KEY_TO_SEMITONE, OCTAVE_DOWN_KEY, OCTAVE_UP_KEY } from '@/stores/keyboard-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAudioEngine } from '@/hooks/use-audio-engine'
import type { KeyboardModule } from '@/audio/nodes/KeyboardModule'

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return !!target.closest('[contenteditable="true"]')
}

export function useKeyboard() {
  const { initialize, audioState } = useAudioEngine()

  useEffect(() => {
    const getEnabledModules = (): KeyboardModule[] => {
      return useWorkspaceStore.getState()
        .getModulesByType('keyboard')
        .map(e => e.audioNode as KeyboardModule)
        .filter(kb => kb.enabled)
    }

    const handleKeyDown = async (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const isMappedNote = key in KEY_TO_SEMITONE
      const isOctaveKey = key === OCTAVE_DOWN_KEY || key === OCTAVE_UP_KEY
      if (!isMappedNote && !isOctaveKey) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isTextInputTarget(event.target)) return
      if (event.repeat) return

      if (audioState === 'stopped') await initialize()

      const modules = getEnabledModules()
      if (modules.length === 0) return

      if (isOctaveKey) {
        const delta = key === OCTAVE_DOWN_KEY ? -1 : 1
        useKeyboardStore.getState().adjustOctave(delta, modules)
        return
      }

      useKeyboardStore.getState().keyDown(key, modules)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (!(key in KEY_TO_SEMITONE)) return
      const modules = getEnabledModules()
      useKeyboardStore.getState().keyUp(key, modules)
    }

    const handleBlur = () => {
      const modules = getEnabledModules()
      useKeyboardStore.getState().releaseAll(modules)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const modules = getEnabledModules()
        useKeyboardStore.getState().releaseAll(modules)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [audioState, initialize])
}
```

### 7. Update App to use Toolbar and keyboard

Update `src/components/App.tsx`:

```tsx
import { ReactFlowProvider } from '@xyflow/react'
import { WorkspaceCanvas } from './workspace/WorkspaceCanvas'
import { ModulePalette } from './palette/ModulePalette'
import { Toolbar } from './toolbar/Toolbar'
import { useKeyboard } from '@/hooks/use-keyboard'

export function App() {
  useKeyboard()

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-bg">
        <Toolbar />

        <main className="flex-1 relative" style={{ marginRight: 140 }}>
          <WorkspaceCanvas />
        </main>

        <ModulePalette />
      </div>
    </ReactFlowProvider>
  )
}
```

---

## Files Created/Modified

| Action | File |
|--------|------|
| Create | `src/components/toolbar/TransportControls.tsx` |
| Create | `src/components/toolbar/FileControls.tsx` |
| Create | `src/components/toolbar/AudioToggle.tsx` |
| Create | `src/components/toolbar/Toolbar.tsx` |
| Create | `src/lib/patch-serialization.ts` |
| Create | `src/hooks/use-keyboard.ts` |
| Modify | `src/components/App.tsx` |

## Verify It Works

### Toolbar
1. Header shows: SYNTHESIS | ▶ PLAY | BPM input | SAVE | LOAD | START AUDIO
2. Click **▶ PLAY** — changes to "■ STOP", transport is playing
3. Click **■ STOP** — transport stops
4. Change **BPM** input — tempo changes audibly when sequencer is running
5. Click **SAVE** — downloads `jeskola_patch.json`
6. Click **LOAD** — file picker opens, selecting a JSON loads the patch

### Keyboard
1. Add Oscillator → Gain → Master
2. Connect Keyboard NOTE → Oscillator freq, Keyboard GATE → Gain level
3. Add a Keyboard module (if not already)
4. Press **A** key — hear a C note
5. Press **S** key while holding A — hear D (last-note-wins)
6. Release S, still holding A — hear C again
7. Press **Z** — octave down, **X** — octave up
8. Click in BPM input, type — keyboard doesn't trigger notes (text input guard)
9. Switch tabs and come back — notes released

### Save/Load round-trip
1. Build a patch (Osc → Filter → Gain → Master)
2. Save it
3. Refresh the page, Start Audio
4. Load the saved file
5. Same modules and connections appear, same positions, same knob values
