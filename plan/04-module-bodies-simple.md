# Phase 04 — Module Bodies (Simple: Master, Gain, LFO, ADSR)

## Goal
Implement the body components for the four simplest modules. Wire knob onChange callbacks to the actual audio nodes via the Zustand store. After this phase, you can add these modules and hear audio pass through them.

## Depends On
Phase 02 (workspace), Phase 03 (knob)

---

## Steps

### 1. Create the module body registry

Create `src/lib/module-body-registry.tsx`:

```tsx
import type { ComponentType } from 'react'
import type { ModuleType } from '@/lib/module-registry'

// Lazy map of module type → body component
// Each phase adds to this. Start with placeholders.
const bodyComponents = new Map<string, ComponentType<{ moduleId: string }>>()

export function registerModuleBody(type: string, component: ComponentType<{ moduleId: string }>) {
  bodyComponents.set(type, component)
}

export function getModuleBody(type: string): ComponentType<{ moduleId: string }> | undefined {
  return bodyComponents.get(type)
}
```

### 2. Update ModuleNode to use body registry

Update `src/components/workspace/ModuleNode.tsx` — replace the placeholder body div:

```tsx
import { getModuleBody } from '@/lib/module-body-registry'

// Inside the ModuleNodeInner component, replace the placeholder <div> with:

      {/* Module body */}
      <div className="px-3 py-2">
        {(() => {
          const BodyComponent = getModuleBody(nodeData.moduleType)
          if (BodyComponent) {
            return <BodyComponent moduleId={id} />
          }
          return (
            <span className="text-[9px] text-text-muted">
              {nodeData.moduleType}
            </span>
          )
        })()}
      </div>
```

### 3. Create MasterBody

Create `src/components/workspace/module-nodes/MasterBody.tsx`:

```tsx
import { registerModuleBody } from '@/lib/module-body-registry'

function MasterBody({ moduleId }: { moduleId: string }) {
  // Master has no controls — just an input port (handled by ModuleNode handles)
  return (
    <div className="text-[9px] text-text-muted text-center py-1">
      Audio Output
    </div>
  )
}

registerModuleBody('master', MasterBody)
export { MasterBody }
```

### 4. Create GainBody

Create `src/components/workspace/module-nodes/GainBody.tsx`:

```tsx
import { useCallback } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { GainModule } from '@/audio/nodes/GainModule'
import { registerModuleBody } from '@/lib/module-body-registry'

function GainBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as GainModule | undefined
  if (!audio) return null

  const state = audio.state as { level: number }

  const handleLevel = useCallback((val: number) => {
    audio.setGain(val)
    audio.state = { ...audio.state, level: val }
  }, [audio])

  return (
    <div className="flex justify-center">
      <Knob
        label="LEVEL"
        min={0}
        max={2}
        value={state.level ?? 0.5}
        defaultValue={0.5}
        onChange={handleLevel}
      />
    </div>
  )
}

registerModuleBody('gain', GainBody)
export { GainBody }
```

### 5. Create LfoBody

Create `src/components/workspace/module-nodes/LfoBody.tsx`:

```tsx
import { useCallback, useState } from 'react'
import { Knob } from '@/components/controls/Knob'
import { SegmentToggle } from '@/components/controls/SegmentToggle'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { LfoModule } from '@/audio/nodes/LfoModule'
import { registerModuleBody } from '@/lib/module-body-registry'

const WAVEFORM_OPTIONS = [
  { value: 'sine', label: 'Sin' },
  { value: 'square', label: 'Sq' },
  { value: 'sawtooth', label: 'Saw' },
  { value: 'triangle', label: 'Tri' },
]

function LfoBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as LfoModule | undefined
  if (!audio) return null

  const state = audio.state as { rate: number; depth: number; type: string }
  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate(n => n + 1)

  const handleRate = useCallback((val: number) => {
    audio.setRate(val)
    audio.state = { ...audio.state, rate: val }
  }, [audio])

  const handleDepth = useCallback((val: number) => {
    audio.setDepth(val)
    audio.state = { ...audio.state, depth: val }
  }, [audio])

  const handleType = useCallback((val: string) => {
    audio.setType(val as OscillatorType)
    audio.state = { ...audio.state, type: val }
    rerender()
  }, [audio])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 justify-center">
        <Knob
          label="RATE"
          min={0.1}
          max={50}
          value={state.rate ?? 1}
          defaultValue={1}
          onChange={handleRate}
          logCapable
          isLogMode
        />
        <Knob
          label="DEPTH"
          min={0}
          max={1}
          value={state.depth ?? 0.5}
          defaultValue={0.5}
          onChange={handleDepth}
        />
      </div>
      <SegmentToggle
        options={WAVEFORM_OPTIONS}
        value={state.type ?? 'sine'}
        onChange={handleType}
      />
    </div>
  )
}

registerModuleBody('lfo', LfoBody)
export { LfoBody }
```

### 6. Create AdsrBody

Create `src/components/workspace/module-nodes/AdsrBody.tsx`:

```tsx
import { useCallback, useRef } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { AdsrModule } from '@/audio/nodes/AdsrModule'
import { registerModuleBody } from '@/lib/module-body-registry'

function AdsrBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as AdsrModule | undefined
  const gateActive = useRef(false)
  if (!audio) return null

  const state = audio.state as { attack: number; decay: number; sustain: number; release: number }

  const handleAttack = useCallback((val: number) => {
    audio.setAttack(val)
    audio.state = { ...audio.state, attack: val }
  }, [audio])

  const handleDecay = useCallback((val: number) => {
    audio.setDecay(val)
    audio.state = { ...audio.state, decay: val }
  }, [audio])

  const handleSustain = useCallback((val: number) => {
    audio.setSustain(val)
    audio.state = { ...audio.state, sustain: val }
  }, [audio])

  const handleRelease = useCallback((val: number) => {
    audio.setRelease(val)
    audio.state = { ...audio.state, release: val }
  }, [audio])

  const handleGateDown = useCallback(() => {
    if (!gateActive.current) {
      gateActive.current = true
      audio.triggerAttack()
    }
  }, [audio])

  const handleGateUp = useCallback(() => {
    if (gateActive.current) {
      gateActive.current = false
      audio.triggerRelease()
    }
  }, [audio])

  return (
    <div className="flex flex-col gap-2">
      {/* Manual gate button */}
      <button
        onMouseDown={handleGateDown}
        onMouseUp={handleGateUp}
        onMouseLeave={handleGateUp}
        className="w-full text-[10px] uppercase tracking-wide py-1.5 bg-bg border border-border rounded-[4px] text-text-light hover:bg-accent-orange hover:text-white active:bg-accent-orange active:text-white transition-colors cursor-pointer text-center"
      >
        Gate (Hold)
      </button>

      {/* ADSR knobs */}
      <div className="flex gap-1.5 justify-between">
        <Knob
          label="A"
          min={0.01}
          max={5}
          value={state.attack ?? 0.1}
          defaultValue={0.1}
          onChange={handleAttack}
        />
        <Knob
          label="D"
          min={0.01}
          max={5}
          value={state.decay ?? 0.2}
          defaultValue={0.2}
          onChange={handleDecay}
        />
        <Knob
          label="S"
          min={0}
          max={1}
          value={state.sustain ?? 0.5}
          defaultValue={0.5}
          onChange={handleSustain}
        />
        <Knob
          label="R"
          min={0.01}
          max={5}
          value={state.release ?? 0.5}
          defaultValue={0.5}
          onChange={handleRelease}
        />
      </div>
    </div>
  )
}

registerModuleBody('adsr', AdsrBody)
export { AdsrBody }
```

### 7. Register all bodies on app startup

Create `src/lib/register-module-bodies.ts`:

```ts
// Import all module body components to trigger their self-registration
import '@/components/workspace/module-nodes/MasterBody'
import '@/components/workspace/module-nodes/GainBody'
import '@/components/workspace/module-nodes/LfoBody'
import '@/components/workspace/module-nodes/AdsrBody'

// Future phases will add more imports here:
// import '@/components/workspace/module-nodes/OscillatorBody'
// import '@/components/workspace/module-nodes/FilterBody'
// etc.
```

Import this in `src/main.tsx`:

```tsx
import './lib/register-module-bodies'
// ... rest of main.tsx
```

---

## Files Created/Modified

| Action | File |
|--------|------|
| Create | `src/lib/module-body-registry.tsx` |
| Create | `src/components/workspace/module-nodes/MasterBody.tsx` |
| Create | `src/components/workspace/module-nodes/GainBody.tsx` |
| Create | `src/components/workspace/module-nodes/LfoBody.tsx` |
| Create | `src/components/workspace/module-nodes/AdsrBody.tsx` |
| Create | `src/lib/register-module-bodies.ts` |
| Modify | `src/components/workspace/ModuleNode.tsx` |
| Modify | `src/main.tsx` |

## Verify It Works

1. Add a **Gain** module — shows a LEVEL knob (0-2, default 0.5)
2. Add an **LFO** — shows RATE (log knob) + DEPTH + waveform toggle (Sin/Sq/Saw/Tri)
3. Add an **ADSR** — shows GATE (HOLD) button + A/D/S/R knobs
4. **Master** module shows "Audio Output" text
5. Turn the Gain LEVEL knob — value updates in real-time
6. Turn the LFO RATE knob — note it's log-scaled (moves faster at higher values)
7. Click the LFO waveform toggle — switches between Sin/Sq/Saw/Tri
8. Hold the ADSR gate button — it should visually activate (orange background while held)
9. Double-click any knob — resets to default value
10. Connect LFO output → Gain level input (cable appears) — you won't hear anything yet without an oscillator, but the connection should be made
11. No console errors
