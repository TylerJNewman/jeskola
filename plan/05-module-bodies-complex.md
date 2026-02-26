# Phase 05 — Module Bodies (Complex: Oscillator, Filter, Delay, Distortion)

## Goal
Implement the four audio-processing module bodies. These are more complex because they have multiple knobs, mode toggles, and type selectors. After this phase, you can build a basic subtractive synth (Oscillator → Filter → Gain → Master) and hear sound.

## Depends On
Phase 04 (simple modules + body registry pattern)

---

## Steps

### 1. Create OscillatorBody

The oscillator has two modes (PITCH / FREQ) that show different knob sets, plus a waveform type selector.

Create `src/components/workspace/module-nodes/OscillatorBody.tsx`:

```tsx
import { useCallback, useState } from 'react'
import { Knob } from '@/components/controls/Knob'
import { SegmentToggle } from '@/components/controls/SegmentToggle'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { OscillatorModule } from '@/audio/nodes/OscillatorModule'
import { registerModuleBody } from '@/lib/module-body-registry'

const WAVEFORM_OPTIONS = [
  { value: 'sine', label: 'Sin' },
  { value: 'square', label: 'Sq' },
  { value: 'sawtooth', label: 'Saw' },
  { value: 'triangle', label: 'Tri' },
]

const MODE_OPTIONS = [
  { value: 'pitch', label: 'PITCH' },
  { value: 'freq', label: 'FREQ' },
]

function OscillatorBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as OscillatorModule | undefined
  if (!audio) return null

  const state = audio.state as {
    octave: number; semitone: number; cents: number
    freq: number; freqLog?: boolean
    type: string; mode: string
  }

  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate(n => n + 1)

  const mode = state.mode || 'pitch'

  // --- PITCH mode handlers ---
  const handleOctave = useCallback((val: number) => {
    audio.setOctave(val)
    audio.state = { ...audio.state, octave: val }
  }, [audio])

  const handleSemitone = useCallback((val: number) => {
    audio.setSemitone(val)
    audio.state = { ...audio.state, semitone: val }
  }, [audio])

  const handleCents = useCallback((val: number) => {
    audio.setCents(val)
    audio.state = { ...audio.state, cents: val }
  }, [audio])

  // --- FREQ mode handler ---
  const handleFreq = useCallback((val: number) => {
    audio.setFreq(val)
    audio.state = { ...audio.state, freq: val }
  }, [audio])

  // --- Mode toggle ---
  const handleMode = useCallback((val: string) => {
    audio.setMode(val as 'pitch' | 'freq')
    audio.state = { ...audio.state, mode: val }
    rerender()
  }, [audio])

  // --- Type selector ---
  const handleType = useCallback((val: string) => {
    audio.setType(val as OscillatorType)
    audio.state = { ...audio.state, type: val }
    rerender()
  }, [audio])

  // --- Log mode for freq knob ---
  const handleFreqLogToggle = useCallback((isLog: boolean) => {
    audio.state = { ...audio.state, freqLog: isLog }
  }, [audio])

  return (
    <div className="flex flex-col gap-2">
      {/* PITCH / FREQ toggle */}
      <div className="flex justify-center">
        <SegmentToggle
          options={MODE_OPTIONS}
          value={mode}
          onChange={handleMode}
        />
      </div>

      {/* PITCH mode: OCT / COARSE / FINE */}
      {mode === 'pitch' && (
        <div className="flex gap-2 justify-center">
          <Knob
            label="OCT"
            min={-3} max={3}
            value={state.octave ?? 0}
            defaultValue={0}
            onChange={handleOctave}
            step={1}
          />
          <Knob
            label="COARSE"
            min={-12} max={12}
            value={state.semitone ?? 0}
            defaultValue={0}
            onChange={handleSemitone}
            step={1}
          />
          <Knob
            label="FINE"
            min={-100} max={100}
            value={state.cents ?? 0}
            defaultValue={0}
            onChange={handleCents}
          />
        </div>
      )}

      {/* FREQ mode: single frequency knob */}
      {mode === 'freq' && (
        <div className="flex justify-center">
          <Knob
            label="FREQ"
            min={0.1} max={2000}
            value={state.freq ?? 440}
            defaultValue={440}
            onChange={handleFreq}
            logCapable
            isLogMode={!!state.freqLog}
            onModeChange={handleFreqLogToggle}
          />
        </div>
      )}

      {/* Waveform selector */}
      <SegmentToggle
        options={WAVEFORM_OPTIONS}
        value={state.type ?? 'sine'}
        onChange={handleType}
      />
    </div>
  )
}

registerModuleBody('oscillator', OscillatorBody)
export { OscillatorBody }
```

### 2. Create FilterBody

Create `src/components/workspace/module-nodes/FilterBody.tsx`:

```tsx
import { useCallback, useState } from 'react'
import { Knob } from '@/components/controls/Knob'
import { SegmentToggle } from '@/components/controls/SegmentToggle'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { FilterModule } from '@/audio/nodes/FilterModule'
import { registerModuleBody } from '@/lib/module-body-registry'

const FILTER_TYPE_OPTIONS = [
  { value: 'lowpass', label: 'LP' },
  { value: 'highpass', label: 'HP' },
  { value: 'bandpass', label: 'BP' },
]

function FilterBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as FilterModule | undefined
  if (!audio) return null

  const state = audio.state as { cutoff: number; cutoffLog?: boolean; res: number; type: string }
  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate(n => n + 1)

  const handleCutoff = useCallback((val: number) => {
    audio.setFrequency(val)
    audio.state = { ...audio.state, cutoff: val }
  }, [audio])

  const handleCutoffLog = useCallback((isLog: boolean) => {
    audio.state = { ...audio.state, cutoffLog: isLog }
  }, [audio])

  const handleRes = useCallback((val: number) => {
    audio.setResonance(val)
    audio.state = { ...audio.state, res: val }
  }, [audio])

  const handleType = useCallback((val: string) => {
    audio.setType(val as BiquadFilterType)
    audio.state = { ...audio.state, type: val }
    rerender()
  }, [audio])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 justify-center">
        <Knob
          label="CUTOFF"
          min={20} max={10000}
          value={state.cutoff ?? 1000}
          defaultValue={1000}
          onChange={handleCutoff}
          logCapable
          isLogMode={!!state.cutoffLog}
          onModeChange={handleCutoffLog}
        />
        <Knob
          label="RES"
          min={0} max={20}
          value={state.res ?? 1}
          defaultValue={1}
          onChange={handleRes}
        />
      </div>
      <SegmentToggle
        options={FILTER_TYPE_OPTIONS}
        value={state.type ?? 'lowpass'}
        onChange={handleType}
      />
    </div>
  )
}

registerModuleBody('filter', FilterBody)
export { FilterBody }
```

### 3. Create DelayBody

Create `src/components/workspace/module-nodes/DelayBody.tsx`:

```tsx
import { useCallback } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { DelayModule } from '@/audio/nodes/DelayModule'
import { registerModuleBody } from '@/lib/module-body-registry'

function DelayBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as DelayModule | undefined
  if (!audio) return null

  const state = audio.state as { time: number; feedback: number; mix: number }

  const handleTime = useCallback((val: number) => {
    audio.setTime(val)
    audio.state = { ...audio.state, time: val }
  }, [audio])

  const handleFeedback = useCallback((val: number) => {
    audio.setFeedback(val)
    audio.state = { ...audio.state, feedback: val }
  }, [audio])

  const handleMix = useCallback((val: number) => {
    audio.setMix(val)
    audio.state = { ...audio.state, mix: val }
  }, [audio])

  return (
    <div className="flex gap-2 justify-center">
      <Knob label="TIME" min={0} max={2} value={state.time ?? 0.4} defaultValue={0.4} onChange={handleTime} />
      <Knob label="FB" min={0} max={1} value={state.feedback ?? 0.4} defaultValue={0.4} onChange={handleFeedback} />
      <Knob label="MIX" min={0} max={1} value={state.mix ?? 0.5} defaultValue={0.5} onChange={handleMix} />
    </div>
  )
}

registerModuleBody('delay', DelayBody)
export { DelayBody }
```

### 4. Create DistortionBody

Create `src/components/workspace/module-nodes/DistortionBody.tsx`:

```tsx
import { useCallback } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { DistortionModule } from '@/audio/nodes/DistortionModule'
import { registerModuleBody } from '@/lib/module-body-registry'

function DistortionBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as DistortionModule | undefined
  if (!audio) return null

  const state = audio.state as { drive: number; driveLog?: boolean; mix: number; output: number }

  const handleDrive = useCallback((val: number) => {
    audio.setDrive(val)
    audio.state = { ...audio.state, drive: val }
  }, [audio])

  const handleDriveLog = useCallback((isLog: boolean) => {
    audio.state = { ...audio.state, driveLog: isLog }
  }, [audio])

  const handleMix = useCallback((val: number) => {
    audio.setMix(val)
    audio.state = { ...audio.state, mix: val }
  }, [audio])

  const handleOutput = useCallback((val: number) => {
    audio.setOutput(val)
    audio.state = { ...audio.state, output: val }
  }, [audio])

  return (
    <div className="flex gap-2 justify-center">
      <Knob
        label="DRIVE"
        min={0.5} max={20}
        value={state.drive ?? 1}
        defaultValue={1}
        onChange={handleDrive}
        logCapable
        isLogMode={!!state.driveLog}
        onModeChange={handleDriveLog}
      />
      <Knob label="MIX" min={0} max={1} value={state.mix ?? 0.5} defaultValue={0.5} onChange={handleMix} />
      <Knob label="OUTPUT" min={0} max={2} value={state.output ?? 0.8} defaultValue={0.8} onChange={handleOutput} />
    </div>
  )
}

registerModuleBody('distortion', DistortionBody)
export { DistortionBody }
```

### 5. Register new bodies

Update `src/lib/register-module-bodies.ts`:

```ts
import '@/components/workspace/module-nodes/MasterBody'
import '@/components/workspace/module-nodes/GainBody'
import '@/components/workspace/module-nodes/LfoBody'
import '@/components/workspace/module-nodes/AdsrBody'
import '@/components/workspace/module-nodes/OscillatorBody'
import '@/components/workspace/module-nodes/FilterBody'
import '@/components/workspace/module-nodes/DelayBody'
import '@/components/workspace/module-nodes/DistortionBody'
```

---

## Files Created/Modified

| Action | File |
|--------|------|
| Create | `src/components/workspace/module-nodes/OscillatorBody.tsx` |
| Create | `src/components/workspace/module-nodes/FilterBody.tsx` |
| Create | `src/components/workspace/module-nodes/DelayBody.tsx` |
| Create | `src/components/workspace/module-nodes/DistortionBody.tsx` |
| Modify | `src/lib/register-module-bodies.ts` |

## Verify It Works

### Visual verification
1. Add an **Oscillator** — shows PITCH/FREQ toggle, OCT/COARSE/FINE knobs, waveform selector
2. Toggle to FREQ mode — pitch knobs hide, FREQ knob appears with LOG capability
3. Toggle back to PITCH mode — FREQ knob hides, OCT/COARSE/FINE reappear
4. Add a **Filter** — shows CUTOFF (log-capable) + RES knobs, LP/HP/BP toggle
5. Add a **Delay** — shows TIME/FB/MIX knobs
6. Add a **Distortion** — shows DRIVE (log-capable)/MIX/OUTPUT knobs

### Audio verification (the big moment)
1. Start Audio
2. Add Oscillator → connect its OUT to Master IN
3. **You should hear a sine wave!**
4. Turn the oscillator OCT knob — pitch changes by octaves (step=1)
5. Switch to Saw waveform — timbre changes
6. Insert a Filter between Oscillator and Master:
   - Disconnect Osc → Master
   - Connect Osc → Filter → Master
7. Turn the Filter CUTOFF knob — tone gets brighter/darker
8. Crank the Filter RES — resonance peak appears
9. Add a Delay after Filter → Master chain — echoes appear
10. Add Distortion before the Delay — crunchy distorted echoes
