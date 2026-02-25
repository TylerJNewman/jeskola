---
title: Jeskola Project Architecture
type: note
permalink: knowledge/jeskola-project-architecture
tags:
- architecture
- overview
- project-structure
---

# Jeskola Project Architecture

## Overview
Browser-based modular synthesizer built with TypeScript, Vite, and the Web Audio API.

## Key Singletons
- **AudioEngine** (`src/audio/AudioEngine.ts`) — wraps AudioContext, master gain, suspend/resume
- **Transport** (`src/audio/Transport.ts`) — global BPM clock, tick/stop callbacks, lookahead scheduler

## Module System
- **ModularNode** (`src/audio/nodes/ModularNode.ts`) — abstract base class for all synth modules
  - `inputNode` / `outputNode` — Web Audio nodes for signal routing
  - `params: Map<string, AudioParam | AudioNode>` — named inputs for CV modulation
  - `state: Record<string, any>` — serializable state (get/set accessors backed by `_state`)
  - `connect(dest, targetPortId?, sourcePortId?)` — routes audio between modules
  - `getOutputForPort(portId)` — returns appropriate output node per port
  - `onGateSignal?(gateOn, time)` — optional gate event interface

## Available Modules
| Module | Type String | File |
|--------|------------|------|
| Oscillator | `oscillator` | `OscillatorModule.ts` |
| Filter | `filter` | `FilterModule.ts` |
| Delay | `delay` | `DelayModule.ts` |
| Distortion | `distortion` | `DistortionModule.ts` |
| Gain | `gain` | `GainModule.ts` |
| ADSR | `adsr` | `AdsrModule.ts` |
| LFO | `lfo` | `LfoModule.ts` |
| Sequencer | `sequencer` | `SequencerModule.ts` |
| Master | N/A | `MasterNode.ts` |

## UI Architecture
- **Workspace** (`src/ui/Workspace.ts`) — manages module placement, cable connections, panning, import/export
- **Knob** (`src/ui/Knob.ts`) — reusable rotary knob control
- **main.ts** — module factory (`createModule` switch), UI wiring, preset system, transport controls

## Patch Format
JSON with:
```json
{
  "transport": { "bpm": 120, "ticksPerBeat": 4 },
  "modules": [{ "id", "type", "x", "y", "state" }],
  "connections": [{ "sourceModuleId", "targetModuleId", "sourcePortId", "targetPortId" }]
}
```

## Preset System
- Classic presets: hardcoded JSON strings in `src/presets.ts`
- Stacked presets: composable base + modifier patterns
- Recipes: parametric presets with morph slider

## Build
- Vite + TypeScript
- `verbatimModuleSyntax` enabled — must use `import type` for type-only imports
- No test framework configured (vitest available but no test files)

## Related
- [[Pattern Sequencer Implementation]]
- [[CV Voltage Standard]]
- [[Transport Architecture Decision]]
