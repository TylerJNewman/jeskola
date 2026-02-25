---
title: Pattern Sequencer Implementation
type: note
permalink: knowledge/pattern-sequencer-implementation
tags:
- sequencer
- transport
- implementation
- architecture
---

# Pattern Sequencer Implementation

## Summary
Implemented a full per-machine pattern sequencer as a first-class module in the Jeskola modular synth. This was the #1 missing feature identified in the grand plan (priority 10). The implementation adds three core components: a global Transport clock, a SequencerModule audio node, and a step grid UI.

## Components Built

### 1. Transport (`src/audio/Transport.ts`)
- Global singleton clock (like AudioEngine)
- "Tale of two clocks" scheduler: `setTimeout` at 25ms + `AudioContext.currentTime` lookahead of 100ms
- Modules register tick/stop callbacks
- Default: 120 BPM, 4 ticks/beat (16th notes)
- Swing support: odd-numbered ticks offset by `(swing - 0.5) * secondsPerTick`
- BPM change mid-playback: recalculates nextTickTime from last tick boundary
- `play()` / `stop()` / `setBpm()` / `setTicksPerBeat()` / `setSwing()`

### 2. Sequencer Types (`src/audio/sequencer/types.ts`)
- `SequencerStep`: note (MIDI 0-127), velocity (0-1), gate (boolean)
- `Pattern`: name, length (1-64), steps array
- `NO_VALUE = -1` sentinel for empty steps
- Helper functions: `createEmptyPattern()`, `midiToNoteName()`, `midiToCv()`

### 3. SequencerModule (`src/audio/nodes/SequencerModule.ts`)
- Extends [[ModularNode]]
- Dual CV outputs via ConstantSourceNode:
  - `noteCV`: pitch as `(midiNote - 60) / 12` (1V/octave, C4 = 0) — maps to OscillatorModule's cvPitchMod (gain=1200 cents)
  - `gateCV`: 1.0 on note-on, 0.0 on note-off — connects to Gain level or Filter cutoff
- Port registration: `outputNode = noteCV` (default audio port), `params.set('gate', gateCV)`
- Gate target tracking: `gateTargets: Set<ModularNode>` for direct ADSR triggering
- Overrides `state` getter/setter for serialization of pattern, octaveOffset, gateLength
- Transport tick callback schedules CV changes at precise audio times
- Transport stop callback cancels all scheduled values and releases all ADSRs
- Pattern length change: truncate or extend with empty steps
- Unregisters from transport on destroy()

### 4. ModularNode Changes (`src/audio/nodes/ModularNode.ts`)
- Added `getOutputForPort(portId)` — returns different AudioNode per output port
- Added `sourcePortId` parameter to `connect()` and `disconnect()`
- Added optional `onGateSignal?(gateOn: boolean, time: number)` interface
- Base class `state` property converted to get/set accessors backed by `_state`

### 5. ADSR Changes (`src/audio/nodes/AdsrModule.ts`)
- Added `triggerAttackAt(time)` and `triggerReleaseAt(time)` — same logic as existing methods but accept future time parameter
- Refactored `triggerAttack()` / `triggerRelease()` to delegate to the At-time variants using `ctx.currentTime`
- Implemented `onGateSignal()` — calls triggerAttackAt/ReleaseAt based on gateOn boolean

### 6. Workspace Changes (`src/ui/Workspace.ts`)
- `attemptConnection()`: passes `sourcePortId` to `connect()`, registers gate targets when connecting gate port to modules with `onGateSignal`
- `removeConnection()`: passes `sourcePortId` to `disconnect()`, deregisters gate targets
- `removeModule()`: passes `sourcePortId` in disconnect calls, deregisters gate targets
- `exportState()`: includes `transport: { bpm, ticksPerBeat }` in patch JSON
- `importState()`: restores transport state if present (backward compatible), stops transport before clearing modules, syncs BPM input UI

### 7. UI (`src/main.ts`, `index.html`, `src/style.css`)
- Transport play/stop button + BPM number input in header controls
- `+ SEQUENCER` button in module palette
- `case 'sequencer'` in createModule factory with:
  - Step grid: click to toggle gate, right-click for note picker, scroll wheel to change note
  - Note picker popup: octave +/- buttons, 12 note buttons (C through B)
  - Length selector: 4/8/16/32 steps
  - Knobs: OCT OFFSET (-3 to +3), GATE LEN (0.05 to 1.0)
  - Playhead animation: requestAnimationFrame loop highlights current step with blue ring
  - Dispose callback: cancels animation frame, closes picker

## Signal Flow
```
SequencerModule [note CV] ──→ Oscillator [freq input] (pitch via 1V/oct)
SequencerModule [gate CV] ──→ Gain [level input] (amplitude gating)
SequencerModule [gate]    ──→ ADSR [gate input] (envelope trigger via onGateSignal)
```

## Key Design Decisions
- 1V/octave CV standard: `(midi - 60) / 12` maps correctly to OscillatorModule's cvPitchMod
- Gate targets use direct method calls (onGateSignal) rather than CV-only, since ADSR needs attack/release events
- Multiple sequencers independently wrap at their own pattern length for polymetric composition
- Backward compatible: patches without transport field import fine; all existing connect/disconnect calls unchanged
- SequencerModule overrides state get/set accessors for custom serialization

## Files Modified/Created
| Action | File |
|--------|------|
| Create | `src/audio/sequencer/types.ts` |
| Create | `src/audio/Transport.ts` |
| Create | `src/audio/nodes/SequencerModule.ts` |
| Modify | `src/audio/nodes/ModularNode.ts` |
| Modify | `src/audio/nodes/AdsrModule.ts` |
| Modify | `src/ui/Workspace.ts` |
| Modify | `src/main.ts` |
| Modify | `index.html` |
| Modify | `src/style.css` |
