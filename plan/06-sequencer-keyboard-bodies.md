# Phase 06 — Sequencer + Keyboard Module Bodies

## Goal
Implement the two most complex module bodies: the pattern sequencer (step grid, note picker, playhead animation, pattern length) and the keyboard controller (octave display, enable toggle). These are the "input" modules that generate CV/gate signals.

## Depends On
Phase 04-05 (body registry pattern, knob component)

---

## Steps

### 1. Create KeyboardBody

Create `src/components/workspace/module-nodes/KeyboardBody.tsx`:

```tsx
import { useCallback, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { KeyboardModule } from '@/audio/nodes/KeyboardModule'
import { registerModuleBody } from '@/lib/module-body-registry'

function KeyboardBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as KeyboardModule | undefined
  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate(n => n + 1)
  if (!audio) return null

  const octave = audio.octaveOffset
  const enabled = audio.enabled
  const signedOct = octave >= 0 ? `+${octave}` : String(octave)

  const handleOctaveDown = useCallback(() => {
    audio.adjustOctave(-1)
    rerender()
  }, [audio])

  const handleOctaveUp = useCallback(() => {
    audio.adjustOctave(1)
    rerender()
  }, [audio])

  const handleEnabledToggle = useCallback(() => {
    const next = !audio.enabled
    audio.setEnabled(next)
    if (!next) audio.noteOff()
    rerender()
  }, [audio])

  return (
    <div className="flex flex-col gap-2">
      {/* Octave controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={handleOctaveDown}
          className="text-[10px] px-2 py-0.5 bg-bg border border-border rounded-[4px] text-text-light hover:border-accent-orange cursor-pointer"
        >
          -
        </button>
        <span className="text-[10px] font-medium text-text-muted tabular-nums min-w-[52px] text-center">
          OCT: {signedOct}
        </span>
        <button
          onClick={handleOctaveUp}
          className="text-[10px] px-2 py-0.5 bg-bg border border-border rounded-[4px] text-text-light hover:border-accent-orange cursor-pointer"
        >
          +
        </button>
      </div>

      {/* Enable toggle */}
      <label className="flex items-center gap-2 justify-center cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleEnabledToggle}
          className="accent-accent-orange"
        />
        <span className="text-[10px] text-text-muted">Enabled</span>
      </label>

      {/* Help text */}
      <div className="text-[8px] text-text-muted text-center leading-tight">
        Keys: A W S E D F G<br />
        Octave: Z / X
      </div>
    </div>
  )
}

registerModuleBody('keyboard', KeyboardBody)
export { KeyboardBody }
```

### 2. Create SequencerBody

This is the most complex UI component. It includes:
- Step grid with click to toggle gate, right-click for note picker
- Scroll wheel on cells to change note pitch
- Pattern length selector
- Octave offset and gate length knobs
- Playhead animation synced to Transport

Create `src/components/workspace/module-nodes/SequencerBody.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useTransportStore } from '@/stores/transport-store'
import type { SequencerModule } from '@/audio/nodes/SequencerModule'
import { NO_VALUE, midiToNoteName } from '@/audio/sequencer/types'
import { transport } from '@/audio/Transport'
import { registerModuleBody } from '@/lib/module-body-registry'

const PATTERN_LENGTHS = [4, 8, 16, 32]
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function SequencerBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as SequencerModule | undefined
  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate(n => n + 1)
  const [currentStep, setCurrentStep] = useState(-1)
  const [notePickerStep, setNotePickerStep] = useState<number | null>(null)
  const [pickerOctave, setPickerOctave] = useState(4)
  const rafRef = useRef<number | null>(null)

  if (!audio) return null

  const pattern = audio.pattern
  const steps = pattern.steps

  // --- Playhead animation ---
  useEffect(() => {
    // Subscribe to step changes from the audio node
    audio.onStepChange = (step: number) => {
      setCurrentStep(step)
    }

    // Also poll via rAF when transport is playing
    const animate = () => {
      if (transport.isPlaying) {
        setCurrentStep(audio.currentStep)
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    const stopHandler = () => setCurrentStep(-1)
    transport.onStop(stopHandler)

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      audio.onStepChange = undefined
      transport.offStop(stopHandler)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [audio])

  // --- Step toggle (left click) ---
  const handleStepClick = useCallback((index: number) => {
    const step = steps[index]
    if (!step) return

    if (step.gate) {
      // Turn off
      audio.setStep(index, { gate: false })
    } else {
      // Turn on with default note if no note set
      const note = step.note === NO_VALUE ? 60 : step.note
      audio.setStep(index, { gate: true, note, velocity: 1 })
    }
    rerender()
  }, [audio, steps])

  // --- Right-click note picker ---
  const handleStepRightClick = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setNotePickerStep(index)
    const step = steps[index]
    if (step && step.note !== NO_VALUE) {
      setPickerOctave(Math.floor(step.note / 12) - 1)
    }
  }, [steps])

  // --- Scroll wheel pitch adjust ---
  const handleStepWheel = useCallback((e: React.WheelEvent, index: number) => {
    e.stopPropagation()
    const step = steps[index]
    if (!step || !step.gate) return

    const current = step.note === NO_VALUE ? 60 : step.note
    const delta = e.deltaY < 0 ? 1 : -1
    const next = Math.max(0, Math.min(127, current + delta))
    audio.setStep(index, { note: next })
    rerender()
  }, [audio, steps])

  // --- Note picker select ---
  const handleNoteSelect = useCallback((midi: number) => {
    if (notePickerStep === null) return
    audio.setStep(notePickerStep, { note: midi, gate: true, velocity: 1 })
    setNotePickerStep(null)
    rerender()
  }, [audio, notePickerStep])

  // --- Pattern length ---
  const handleLengthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const len = parseInt(e.target.value, 10)
    audio.setPatternLength(len)
    rerender()
  }, [audio])

  // --- Knobs ---
  const handleOctave = useCallback((val: number) => {
    audio.octaveOffset = val
  }, [audio])

  const handleGateLen = useCallback((val: number) => {
    audio.gateLength = val
  }, [audio])

  return (
    <div className="flex flex-col gap-2 relative">
      {/* Pattern length selector */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase text-text-muted">Steps</span>
        <select
          value={pattern.length}
          onChange={handleLengthChange}
          className="text-[10px] bg-bg border border-border rounded-[4px] px-1 py-0.5 text-text-light"
        >
          {PATTERN_LENGTHS.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Step grid */}
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: `repeat(${Math.min(pattern.length, 16)}, 20px)`,
        }}
      >
        {steps.slice(0, pattern.length).map((step, i) => {
          const isActive = step.gate
          const isPlaying = i === currentStep
          const isBeatStart = i % 4 === 0
          const noteName = isActive && step.note !== NO_VALUE
            ? midiToNoteName(step.note)
            : ''

          return (
            <button
              key={i}
              onClick={() => handleStepClick(i)}
              onContextMenu={(e) => handleStepRightClick(e, i)}
              onWheel={(e) => handleStepWheel(e, i)}
              className={`
                w-5 h-8 text-[7px] leading-tight flex items-end justify-center pb-0.5
                border rounded-sm cursor-pointer transition-colors select-none
                ${isActive
                  ? 'bg-accent-orange text-white border-accent-orange'
                  : 'bg-bg text-text-muted border-border hover:border-accent-orange'}
                ${isPlaying ? 'ring-2 ring-accent-blue ring-inset' : ''}
                ${isBeatStart ? 'border-l-2 border-l-border' : ''}
              `}
            >
              {noteName}
            </button>
          )
        })}
      </div>

      {/* Row 2 for patterns > 16 steps */}
      {pattern.length > 16 && (
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `repeat(16, 20px)`,
          }}
        >
          {steps.slice(16, pattern.length).map((step, i) => {
            const idx = i + 16
            const isActive = step.gate
            const isPlaying = idx === currentStep
            const isBeatStart = idx % 4 === 0
            const noteName = isActive && step.note !== NO_VALUE
              ? midiToNoteName(step.note)
              : ''

            return (
              <button
                key={idx}
                onClick={() => handleStepClick(idx)}
                onContextMenu={(e) => handleStepRightClick(e, idx)}
                onWheel={(e) => handleStepWheel(e, idx)}
                className={`
                  w-5 h-8 text-[7px] leading-tight flex items-end justify-center pb-0.5
                  border rounded-sm cursor-pointer transition-colors select-none
                  ${isActive
                    ? 'bg-accent-orange text-white border-accent-orange'
                    : 'bg-bg text-text-muted border-border hover:border-accent-orange'}
                  ${isPlaying ? 'ring-2 ring-accent-blue ring-inset' : ''}
                  ${isBeatStart ? 'border-l-2 border-l-border' : ''}
                `}
              >
                {noteName}
              </button>
            )
          })}
        </div>
      )}

      {/* Note picker popover */}
      {notePickerStep !== null && (
        <div className="absolute z-50 bg-panel border border-border rounded-[6px] shadow-md p-2 left-0 top-full mt-1">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setPickerOctave(o => Math.max(0, o - 1))}
              className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded-[4px] cursor-pointer"
            >
              -
            </button>
            <span className="text-[10px] text-text-muted">Oct {pickerOctave}</span>
            <button
              onClick={() => setPickerOctave(o => Math.min(8, o + 1))}
              className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded-[4px] cursor-pointer"
            >
              +
            </button>
            <button
              onClick={() => setNotePickerStep(null)}
              className="text-[10px] text-text-muted hover:text-accent-orange cursor-pointer ml-auto"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {NOTE_NAMES.map((name, i) => {
              const midi = (pickerOctave + 1) * 12 + i
              return (
                <button
                  key={name}
                  onClick={() => handleNoteSelect(midi)}
                  className="text-[9px] px-1.5 py-1 bg-bg border border-border rounded-[4px] text-text-light hover:bg-accent-orange hover:text-white cursor-pointer transition-colors"
                >
                  {name}{pickerOctave}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Octave + Gate length knobs */}
      <div className="flex gap-3 justify-center">
        <Knob
          label="OCT"
          min={-3} max={3}
          value={audio.octaveOffset}
          defaultValue={0}
          onChange={handleOctave}
          step={1}
        />
        <Knob
          label="GATE"
          min={0.05} max={1}
          value={audio.gateLength}
          defaultValue={0.5}
          onChange={handleGateLen}
        />
      </div>
    </div>
  )
}

registerModuleBody('sequencer', SequencerBody)
export { SequencerBody }
```

### 3. Register new bodies

Update `src/lib/register-module-bodies.ts` — add:

```ts
import '@/components/workspace/module-nodes/KeyboardBody'
import '@/components/workspace/module-nodes/SequencerBody'
```

---

## Files Created/Modified

| Action | File |
|--------|------|
| Create | `src/components/workspace/module-nodes/KeyboardBody.tsx` |
| Create | `src/components/workspace/module-nodes/SequencerBody.tsx` |
| Modify | `src/lib/register-module-bodies.ts` |

## Verify It Works

### Keyboard Module
1. Add a **Keyboard** module — shows octave controls, enabled toggle, help text
2. Click **-** / **+** — octave display changes (OCT: -1, OCT: +0, etc.)
3. Toggle **Enabled** checkbox off — keyboard input should stop affecting this module
4. Help text shows "Keys: A W S E D F G / Octave: Z / X"

### Sequencer Module
1. Add a **Sequencer** — shows 16-step grid, length selector, OCT + GATE knobs
2. **Click** a step cell — it turns orange (active), shows note name (C4)
3. **Click again** — it turns off (grey)
4. **Right-click** a step — note picker popover appears
5. Select a note in the picker — step updates with new note name
6. **Scroll wheel** on an active step — note changes up/down by semitone
7. Change **Steps** dropdown to 32 — grid expands to two rows
8. Turn **OCT** knob — step snaps to integer values (-3 to +3)
9. Turn **GATE** knob — gate length adjusts (0.05 to 1.0)
10. Note picker closes when you click ×

### Audio verification
1. Build: Oscillator → Filter → Gain → Master
2. Connect **Sequencer NOTE** → Oscillator freq (1V/OCT)
3. Connect **Sequencer GATE** → Gain level
4. Program a few steps in the sequencer
5. Press Play (from toolbar — Phase 08, or use `transport.play()` in console)
6. **Playhead blue ring** moves across active steps
7. You hear the sequenced melody with gates
