---
title: Jeskola Current State Research
type: note
permalink: knowledge/jeskola-current-state-research
tags:
- jeskola
- research
- architecture
- current-state
- comprehensive
---

# Jeskola Current State Research

## Executive Summary
Jeskola (branded "SYNTHESIS") is a browser-based modular synthesizer built with TypeScript, Vite, and the Web Audio API. Visual patching workspace with drag-and-drop modules, virtual cables, real-time sound design. ~6,500 lines of TypeScript across 18 source files, zero runtime dependencies.

## Technology Stack
- TypeScript 5.9 strict mode with `verbatimModuleSyntax`
- Vite 7.3, ESM modules, no framework
- Web Audio API (AudioContext, OscillatorNode, BiquadFilterNode, DelayNode, WaveShaperNode, ConstantSourceNode, GainNode)
- Vanilla DOM + inline SVG for cables
- Puppeteer 24.x headless browser tests (16 test scripts)
- Inter font (Google Fonts), Dieter Rams-inspired design

## Architecture

### Singletons
- **AudioEngine** — wraps AudioContext, master GainNode at 0.8, lazy init after user gesture
- **Transport** — "Tale of Two Clocks" BPM scheduler (setTimeout 25ms + AudioContext lookahead 100ms), 120 BPM default, swing support

### ModularNode Base Class
- `id` (UUID), `type` (string), `inputNode`/`outputNode`, `params` Map, `_state`/state get/set
- `getOutputForPort(portId)` for multi-output modules
- `onGateSignal?(gateOn, time)` optional gate interface
- `connect(dest, targetPortId?, sourcePortId?)` / `disconnect()` / `destroy()`
- `pushStateToAudio()` — subclasses override to sync state to AudioParams

### 10 Module Types
| Module | Type | CV Params | Notes |
|--------|------|-----------|-------|
| Oscillator | oscillator | freq (1V/oct), gain | Dual PITCH/FREQ modes, sine/square/saw/tri |
| Filter | filter | cutoff (4800 cents via detune), res | LP/HP/BP |
| Delay | delay | time, feedback, mix | Dry/wet crossfade, feedback loop, max 10s |
| Distortion | distortion | drive, mix | Tanh waveshaper, dry/wet |
| Gain | gain | level | Simple VCA, 0-2 range |
| ADSR | adsr | gate (input) | ConstantSourceNode envelope, triggerAttackAt/ReleaseAt, onGateSignal |
| LFO | lfo | — | Sub-audio osc, rate 0.1-50Hz log, depth 0-1 |
| Sequencer | sequencer | — | Dual CV outputs (note+gate), pattern 1-64 steps, gate targets for ADSR |
| Keyboard | keyboard | — | QWERTY input (A-G), mono priority, octave Z/X, note+gate outputs |
| Master | N/A | audio (input) | Fixed 'master' ID, routes to AudioEngine destination |

### Signal Flow Standards
- **1V/Octave CV**: `(midiNote - 60) / 12` — C4=0V, each semitone=1/12V
- **OscillatorModule cvPitchMod**: GainNode gain=1200 → osc.detune (1V × 1200 = 1200 cents = 1 octave)
- **Gate CV**: 1.0=on, 0.0=off (velocity-sensitive)
- **Gate Signal**: discrete `onGateSignal(gateOn, time)` method calls for ADSR
- **Anti-click**: 2ms ramps (sequencer), 5ms ramps (keyboard), 50ms setTargetAtTime (knobs)

## UI Architecture

### Workspace (1148 lines)
- Module Map, cable SVG management, pan/zoom (0.15x-2.0x with zoom-to-cursor)
- Connection validation, gate target registration
- Patch export/import with robust normalization and stale import protection
- **Apply engine**: non-destructive additive patching (add_chain, add_modulation, add_send, add_layer)

### Knob (275 lines)
- Vertical drag, linear/log modes, step snapping, double-click reset, 60fps throttle, touch support

### Main.ts (1833 lines)
- Module factory switch, keyboard handler, toolbar/drawer construction, save/load, preset/recipe/stack UI

## Preset System (1007 lines, 3 tiers)

### Tier 1 — Classic Presets (15 base + 10 composed = 25)
Base presets: Sub Bass, Ethereal Drone, Sci-Fi FM, Classic Pluck, Acid Bass Sweep, Acid Drive, Ambient Pad, Wobble Bass, Classic Mono Lead, Deep Techno Stab, Dub Chord Echo, Electro FM Bell, Classic Wobble Lead, Soft Ambient Keys

### Tier 2 — Stacked Presets (dynamic)
User picks base + up to 3 modifiers. 5 pre-built combos.

### Tier 3 — Recipes (6 parametric)
Base + modifiers + state overrides + morph slider (0-1 interpolation)

### 4 Modifiers
- Slow Wobble (LFO→filter cutoff), Wide Echo (delay before master), Drive Boost (distortion), Envelope Pump (ADSR→gain)

## Testing
16 Puppeteer tests: preset integrity, composed/stack/recipe loading, toolbar layout, apply modes (chain/modulation/send), keyboard (basic/mono-priority/focus-guard/blur), rapid import, duplicate ID handling.

## File Inventory
| File | Lines |
|------|-------|
| main.ts | 1833 |
| Workspace.ts | 1148 |
| presets.ts | 1007 |
| style.css | 873 |
| Knob.ts | 275 |
| SequencerModule.ts | 217 |
| Transport.ts | 137 |
| OscillatorModule.ts | 131 |
| KeyboardModule.ts | 126 |
| ModularNode.ts | 124 |
| DistortionModule.ts | 102 |
| DelayModule.ts | 96 |
| AdsrModule.ts | 83 |
| LfoModule.ts | 77 |
| FilterModule.ts | 67 |
| AudioEngine.ts | 63 |
| GainModule.ts | 37 |
| sequencer/types.ts | 32 |
| MasterNode.ts | 25 |
| **Total** | **~6,500** |

## Strengths
1. Clean ModularNode abstraction for routing, serialization, multi-port
2. Robust import/export with validation and backward compatibility
3. Sophisticated 3-tier preset system with composable modifiers and parametric morphing
4. Non-destructive apply engine with intelligent routing inference
5. Proper Web Audio scheduling (lookahead transport, anti-click ramps)
6. Touch support throughout
7. Good test coverage (16 Puppeteer tests)

## Tech Debt
1. main.ts is 1833-line monolith (module factory, keyboard, toolbar all inline)
2. Window globals (`_workspace`, `_createModule`) for cross-module communication
3. No undo/redo
4. No visual distinction between CV and audio cables
5. Sequencer UI inline in main.ts (~260 lines)
6. Ad-hoc state management (each knob callback manually sets audio + state)
7. No polyphony (mono only)
8. No MIDI support
9. No audio metering (VU, scope, spectrum)
10. Toolbar drawers built imperatively (~400 lines of createElement)

## Future Roadmap (from memory)
- Pattern copy/paste, pattern bank
- Velocity editing per step
- Tie/legato mode
- Step probability / humanization
- External MIDI clock sync
- Pattern chaining
- Undo/redo
- Piano roll view
- Accent output, ratcheting
- Tempo tap, pattern randomize

## Related
- [[Jeskola Project Architecture]]
- [[Pattern Sequencer Implementation]]
- [[CV Voltage Standard]]
- [[Transport Architecture Decision]]
- [[ModularNode Multi-Port Output Decision]]
- [[Workspace Connection Flow]]
- [[Sequencer Next Steps]]
- [[SequencerModule State Serialization]]
