# Jeskola — Current State Research Document

## Executive Summary

Jeskola (branded "SYNTHESIS" in the UI) is a browser-based modular synthesizer built with TypeScript, Vite, and the Web Audio API. It provides a visual patching workspace where users drag-and-drop audio modules, connect them with virtual cables, and sculpt sound in real time. The project has evolved from a basic oscillator-and-filter demo into a full-featured modular synth with 10 module types, a pattern sequencer with transport clock, a 3-tier preset system, a composable patch apply engine, and a keyboard trigger module — all in ~5,200 lines of TypeScript across 18 source files with zero runtime dependencies.

---

## 1. Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.9, strict mode, `verbatimModuleSyntax` |
| Build | Vite 7.3, ESM modules, no framework |
| Audio | Web Audio API (AudioContext, OscillatorNode, BiquadFilterNode, DelayNode, WaveShaperNode, ConstantSourceNode, GainNode) |
| Rendering | Vanilla DOM + inline SVG for cables |
| Testing | Puppeteer 24.x headless browser tests (16 test scripts) |
| Fonts | Inter (Google Fonts) |
| Design | Dieter Rams-inspired minimal aesthetic — off-white panels, muted colors, orange/blue accents |

### Key TypeScript Config Constraints
- `verbatimModuleSyntax`: all type-only imports must use `import type`
- `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`
- Target ES2022, bundler module resolution

---

## 2. Architecture Overview

### 2.1 Singleton Services

**AudioEngine** (`src/audio/AudioEngine.ts`, 63 lines)
- Classic singleton wrapping `AudioContext`
- Creates a master `GainNode` at 0.8 volume connected to `ctx.destination`
- Lazy initialization — requires user gesture to call `init()` (browser autoplay policy)
- Exposes `getContext()`, `getDestination()`, `suspend()`, `resume()`

**Transport** (`src/audio/Transport.ts`, 137 lines)
- Global BPM clock singleton using the "Tale of Two Clocks" pattern
- `setTimeout` fires every 25ms; schedules events up to 100ms ahead via `AudioContext.currentTime`
- Default: 120 BPM, 4 ticks/beat (16th notes), swing 0.5 (neutral)
- Modules register via `onTick(cb)` / `onStop(cb)` callbacks
- BPM changes during playback recalculate `nextTickTime` from last tick boundary
- Swing: odd-numbered ticks offset by `(swing - 0.5) * secondsPerTick`

### 2.2 Module System

**ModularNode** (`src/audio/nodes/ModularNode.ts`, 124 lines) — abstract base class:
- `id`: UUID (or forced value like 'master')
- `type`: string identifier (e.g., 'Oscillator', 'Filter')
- `inputNode` / `outputNode`: Web Audio nodes for signal I/O
- `params: Map<string, AudioParam | AudioNode>`: named CV/modulation inputs
- `_state` / `state` (get/set): serializable parameter snapshot
- `pushStateToAudio()`: applies `_state` to actual AudioParams (subclasses override)
- `getOutputForPort(portId)`: multi-output support (default returns `outputNode`; gate returns from `params`)
- `onGateSignal?(gateOn, time)`: optional gate event interface
- `connect(dest, targetPortId?, sourcePortId?)`: routes audio between modules
- `disconnect(dest, targetPortId?, sourcePortId?)`: reverses routing
- `destroy()`: disconnects output node

### 2.3 Available Modules (10 types)

| Module | Type String | File | Lines | Input | Output | CV Params | Notes |
|--------|-----------|------|-------|-------|--------|-----------|-------|
| **Oscillator** | `oscillator` | `OscillatorModule.ts` | 131 | None | audio | `freq` (1V/oct via GainNode→detune), `gain` | Dual mode: PITCH (oct/semi/cents) or FREQ (raw Hz). Supports sine/square/saw/tri. Log/lin toggle for freq knob. |
| **Filter** | `filter` | `FilterModule.ts` | 67 | audio | audio | `cutoff` (4800 cents via detune), `res` (×10 via Q) | LP/HP/BP. Cutoff mod uses filter.detune for exponential CV response. |
| **Delay** | `delay` | `DelayModule.ts` | 96 | audio | audio | `time`, `feedback`, `mix` | Dry/wet crossfade. Feedback loop (delay→feedback→delay). Max 10s. |
| **Distortion** | `distortion` | `DistortionModule.ts` | 102 | audio | audio | `drive`, `mix` | Soft-clip tanh waveshaper. Dry/wet blend. Drive 0.5-20, log-capable knob. |
| **Gain** | `gain` | `GainModule.ts` | 37 | audio | audio | `level` (gain.gain) | Simple VCA. Level 0-2. |
| **ADSR** | `adsr` | `AdsrModule.ts` | 83 | gate (CV input port) | audio (CV) | — | ConstantSourceNode-based envelope. `triggerAttackAt`/`ReleaseAt` for scheduled triggers. `onGateSignal()` implements gate interface. Uses `cancelAndHoldAtTime` with fallback. |
| **LFO** | `lfo` | `LfoModule.ts` | 77 | None | audio (CV) | — | Sub-audio oscillator. Rate 0.1-50 Hz (log knob). Depth 0-1. Sine/square/saw/tri. |
| **Sequencer** | `sequencer` | `SequencerModule.ts` | 217 | None | note CV (audio port), gate CV (gate port) | — | Dual ConstantSourceNode outputs. Registers with Transport for tick/stop callbacks. Pattern: 1-64 steps, each with note/velocity/gate. Oct offset -3 to +3. Gate length 0.05-1.0. Uses `gateTargets: Set<ModularNode>` for direct ADSR triggering via `onGateSignal`. |
| **Keyboard** | `keyboard` | `KeyboardModule.ts` | 126 | None | note CV (audio port), gate CV (gate port) | — | Computer keyboard input (A/W/S/E/D/F/G = C through G, Z/X = octave). Mono priority (last-note-wins). Outputs same 1V/oct CV as sequencer. Enable/disable toggle. |
| **Master** | N/A | `MasterNode.ts` | 25 | audio (from AudioEngine destination) | None | — | Fixed 'master' ID. Routes to AudioEngine's master gain. No output. |

### 2.4 Signal Flow Standards

**1V/Octave CV Convention:**
- Pitch CV: `(midiNote - 60) / 12` → C4=0V, C5=1V, each semitone = 1/12V
- OscillatorModule's `cvPitchMod` GainNode has gain=1200, feeding `osc.detune`
- Result: 1V input × 1200 = 1200 cents = 1 octave. Maps perfectly.

**Gate CV:**
- 1.0 = note on, 0.0 = note off (velocity-sensitive: gate value = step.velocity)
- Can connect to Gain `level` (amplitude gating) or Filter `cutoff` (key-follow)

**Gate Signal (discrete events):**
- Separate from gate CV — uses `onGateSignal(gateOn, time)` method calls
- Required because ADSR needs discrete attack/release events, not continuous CV
- Workspace manages gate target registration when cables connect/disconnect

**Anti-Click Measures:**
- Sequencer uses 2ms linear ramps for pitch and gate CV changes
- Keyboard uses 5ms ramps
- All AudioParam changes use `setTargetAtTime` with 50ms time constant for smooth transitions

---

## 3. UI Architecture

### 3.1 Workspace (`src/ui/Workspace.ts`, 1148 lines)

The largest single file. Manages:

**Module Placement:**
- `modules: Map<string, WorkspaceModule>` — maps ID → {audio, element, disposeUi}
- Modules positioned via CSS transform with data-x/data-y attributes
- Dragging via module header with touch support

**Pan & Zoom:**
- `transform = { x, y, scale }` — applied to all module positions and background grid
- Scroll wheel / trackpad pinch zoom (0.15x–2.0x) with zoom-to-cursor
- Click-drag on empty space for panning
- Touch support for mobile

**Cable System:**
- SVG paths in a dedicated `<svg>` layer
- Cubic bezier curves with tension based on horizontal distance
- Click-to-delete on cables (hover turns orange)
- Cables track `sourcePortId` and `targetPortId` for multi-port modules
- `updateAllCables()` recalculates positions after any movement

**Connection Logic:**
- `attemptConnection(portA, portB)`: validates one-output-one-input, no self-connection, no duplicates
- Gate connections route through `addGateTarget`/`removeGateTarget` instead of audio graph
- Non-gate connections use `sourceData.audio.connect(targetData.audio, targetPortId, sourcePortId)`

**Patch Serialization:**
- `exportState()`: JSON with `{ transport: {bpm, ticksPerBeat}, modules: [{id, type, x, y, state}], connections: [{sourceModuleId, targetModuleId, sourcePortId, targetPortId}] }`
- `importState(json)`: stops transport, clears all modules, recreates via `window._createModule`, reconnects
- `normalizePatchState()`: robust validation — skips invalid entries, deduplicates IDs, validates connections reference known modules
- Import version counter prevents stale async imports

**Apply System (additive patching):**
- `applyState(json, options)`: non-destructive module addition with intelligent routing
- `previewApplyState(json, options)`: dry-run preview returning summary stats
- Apply modes: `replace`, `add_chain`, `add_modulation`, `add_send`, `add_layer`
- Target types: `auto`, `before_module`, `after_module`, `parallel_to_module`, `master_send`
- Safe ID renaming on collision
- Automatic entry/exit module inference for chain insertion
- Modulation source preference: LFO > ADSR > Sequencer > first module
- CV port discovery from DOM elements for modulation routing

### 3.2 Knob (`src/ui/Knob.ts`, 275 lines)

Reusable rotary control:
- Vertical drag interaction (150px = full range)
- Linear and logarithmic scaling modes with LIN/LOG toggle
- Step snapping (integer values for octave/semitone knobs)
- Double-click to reset to default value
- 60fps-throttled onChange callbacks via requestAnimationFrame
- Full cleanup via `dispose()` with tracked cleanup callbacks
- Touch support
- Value display with smart formatting (2dp < 10, 1dp < 100, integer ≥ 100)

### 3.3 Main Entry (`src/main.ts`, 1833 lines)

The monolith orchestrator:

**Module Factory** (`createModule` switch):
- Creates audio node, builds HTML body, attaches knobs, configures state
- Returns boolean success/false
- Exposed as `window._createModule` for Workspace to call during imports
- Each case handles: state restoration, knob creation, event binding, audio initialization

**Keyboard Handler:**
- Global keydown/keyup listeners for QWERTY note input
- `KEY_TO_SEMITONE` mapping: A=C, W=C#, S=D, E=D#, D=E, F=F, G=G
- Z/X for octave down/up
- `heldNoteKeys[]` array for mono priority (last-note-wins)
- Text input guard: ignores when focused on input/textarea/select/contenteditable
- Window blur and visibility change release all notes

**Toolbar System:**
- Two-tier header: Tier 1 (transport, file, apply, audio controls), Tier 2 (section chips)
- Three section chips: Recipe, Preset, Stack — open floating drawer panels
- Apply drawer: separate floating panel on right side

**Save/Load:**
- Save: exports JSON, creates blob download
- Load: file input, reads text, calls `importState`
- Preset/Recipe/Stack selection and loading

### 3.4 Style (`src/style.css`, 873 lines)

Dieter Rams-inspired design language:
- Color palette: off-white (#EFEFEF bg), #FAFAFA panels, #2A2A2A text, #EA523F orange accent, #3A7CA5 blue accent, #607C64 green accent
- Inter font family
- Dot-grid workspace background (20px spacing)
- Z-index layers: cables=10, modules=20/40, UI=100
- Responsive: logo text hides below 1200px, drawers shrink below 1400px
- Sequencer grid: 20×32px cells, orange active, blue playing highlight, every 4th step has left border marker

---

## 4. Preset System (`src/presets.ts`, 1007 lines)

### 4.1 Three-Tier Architecture

**Tier 1 — Classic Presets (15 total: 15 base + 10 composed):**
- Base presets: hardcoded `PatchState` objects (Sub Bass, Ethereal Drone, Sci-Fi FM, Classic Pluck, Acid Bass Sweep, Acid Drive, Ambient Pad, Wobble Bass, Classic Mono Lead, Deep Techno Stab, Dub Chord Echo, Electro FM Bell, Classic Wobble Lead, Soft Ambient Keys)
- Composed presets: base + modifier combinations (e.g., "Acid Drive + Slow Wobble")
- All validated at module load time (unique IDs, valid connections, master route)

**Tier 2 — Stacked Presets (dynamic composition):**
- User picks a base + up to 3 modifiers from dropdowns
- `buildStackedPreset(baseKey, modifierKeys[])` composes at runtime
- 5 pre-built stack combos: Acid Movement, Dub Motion Bus, Mono Lead Plus, Sub Heavy Wobble, FM Space Bell

**Tier 3 — Recipes (6 parametric presets):**
- Built from base + modifiers + module state overrides + morph slider
- `buildRecipePreset(recipeKey, morphAmount)` — morphAmount 0-1 interpolates between base and max states
- Recipes: Classic Acid Bassline, Dub Techno Chord Bus, Subtractive Mono Lead, Evolving Ambient Pad, FM Bell Atmosphere, Sub Pressure Wobble
- Each has a named morph axis (e.g., "Acid Intensity", "Dub Space", "Lead Bite")

### 4.2 Preset Modifiers (4 types)

| Modifier | Category | What It Does |
|----------|----------|-------------|
| Slow Wobble | movement | Adds LFO → filter cutoff. Requires filter. |
| Wide Echo | space | Inserts delay before master. Replaces last master route. |
| Drive Boost | character | Adds distortion (or boosts existing). Inserts before master. |
| Envelope Pump | dynamics | Adds ADSR → gain level. Creates gain if none exists. |

Each modifier has:
- `constraints.requiresTypes`: which module types must exist in base
- `applyModesSupported`: which apply modes work with this modifier
- `conflictsWith`: (unused currently) for future conflict detection
- `apply(base)`: pure function that returns modified PatchState

### 4.3 Validation Pipeline

All presets go through:
1. `assertUniqueModuleIds()` — no duplicate IDs
2. `assertValidConnections()` — all connection endpoints reference existing modules or 'master'
3. `ensureMasterRoute()` — at least one `targetModuleId === 'master'` connection
4. Duplicate key detection via slugified names

---

## 5. Sequencer Types (`src/audio/sequencer/types.ts`, 32 lines)

```
SequencerStep: { note: number, velocity: number, gate: boolean }
Pattern: { name: string, length: number, steps: SequencerStep[] }
NO_VALUE = -1 (sentinel for empty steps)
createEmptyPattern(length, name): Pattern
midiToNoteName(midi): string  // e.g., "C4", "F#3"
midiToCv(midi): number        // (midi - 60) / 12
```

---

## 6. HTML Structure (`index.html`)

```
<header class="top-bar">
  <div class="top-tier">
    <div class="logo">SYNTHESIS</div>
    <div class="tier1-global controls">
      [transport, file, apply, audio — populated dynamically]
    </div>
  </div>
  <div class="second-tier">
    <div class="toolbar-section-chips">[Recipe|Preset|Stack chips]</div>
    <div class="toolbar-sections">[unused container]</div>
  </div>
</header>

<main class="workspace" id="workspace">
  <svg id="cables-layer" class="cables-layer"></svg>
  [modules injected dynamically]
</main>

<aside class="palette">
  [+ OSCILLATOR, + FILTER, + ADSR, + LFO, + KEYBOARD, + DELAY, + DISTORTION, + GAIN, + SEQUENCER]
</aside>
```

The toolbar drawer (left) and apply drawer (right) are appended to `<body>` by JavaScript.

---

## 7. Testing Infrastructure

16 Puppeteer-based browser tests:
- `test_preset_integrity.js` — validates all preset JSON parses and has correct structure
- `test_composed_preset_load.js` — loads each composed preset, verifies modules created
- `test_stacked_builder.js` — tests `buildStackedPreset` with various base/modifier combos
- `test_stack_preset_load.js` — loads stack presets via UI, verifies import
- `test_recipe_load.js` — loads recipes with morph slider, verifies output
- `test_toolbar_layout.js` — verifies toolbar chip/drawer structure
- `test_apply_add_chain.js` — tests add_chain apply mode
- `test_apply_add_modulation.js` — tests add_modulation apply mode
- `test_apply_add_send.js` — tests add_send apply mode
- `test_apply_preview_summary.js` — tests previewApplyState dry-run
- `test_keyboard_trigger_basic.js` — tests keyboard note on/off
- `test_keyboard_mono_priority.js` — tests last-note-wins behavior
- `test_keyboard_focus_guard.js` — tests text input guard
- `test_keyboard_blur_cleanup.js` — tests blur note release
- `test_rapid_import_switch.js` — tests rapid sequential imports
- `test_duplicate_id_import.js` — tests duplicate ID handling

All run against a local Vite dev server. The `test:regression` script starts the server, runs all 16 tests sequentially, then kills the server.

---

## 8. File Inventory & Size

| File | Lines | Purpose |
|------|-------|---------|
| `src/main.ts` | 1833 | Module factory, UI orchestration, toolbar, keyboard |
| `src/ui/Workspace.ts` | 1148 | Module/cable management, pan/zoom, import/export, apply engine |
| `src/presets.ts` | 1007 | Base/composed/stacked/recipe preset definitions |
| `src/style.css` | 873 | Complete styling |
| `src/ui/Knob.ts` | 275 | Reusable rotary knob control |
| `src/audio/nodes/SequencerModule.ts` | 217 | Pattern sequencer audio node |
| `src/audio/Transport.ts` | 137 | Global BPM clock |
| `src/audio/nodes/OscillatorModule.ts` | 131 | Oscillator with pitch/freq modes |
| `src/audio/nodes/ModularNode.ts` | 124 | Abstract base class |
| `src/audio/nodes/KeyboardModule.ts` | 126 | Keyboard input module |
| `src/audio/nodes/DistortionModule.ts` | 102 | Waveshaper distortion |
| `src/audio/nodes/DelayModule.ts` | 96 | Delay with feedback |
| `src/audio/nodes/AdsrModule.ts` | 83 | ADSR envelope |
| `src/audio/nodes/LfoModule.ts` | 77 | Low frequency oscillator |
| `src/audio/nodes/FilterModule.ts` | 67 | Biquad filter |
| `src/audio/AudioEngine.ts` | 63 | AudioContext wrapper |
| `src/audio/nodes/GainModule.ts` | 37 | Simple VCA |
| `src/audio/sequencer/types.ts` | 32 | Pattern/step types and helpers |
| `src/audio/nodes/MasterNode.ts` | 25 | Master output node |
| `index.html` | 64 | Entry HTML |
| **Total** | **~6,500** | |

---

## 9. Git History & Evolution

The project has evolved through these major phases (oldest to newest):

1. **Foundation**: Basic oscillator with frequency knob, filter, workspace with cable connections
2. **Tuning System**: OCT/COARSE/FINE knobs replacing raw frequency, PITCH/FREQ mode toggle
3. **ADSR Envelope**: ConstantSourceNode-based envelope with gate button, presets
4. **LFO Module**: Sub-audio oscillator for modulation
5. **Anti-Click Engineering**: Parameter smoothing, slew limiters (attempted then reverted), `setTargetAtTime` everywhere
6. **Preset System**: Classic presets, then composed presets with modifiers, then stacked presets
7. **Distortion Module**: Tanh waveshaper with dry/wet, drive log knob
8. **Import Stability**: Robust normalization, regression tests, push-state-to-audio on load
9. **Pattern Sequencer**: Transport singleton, SequencerModule with dual CV outputs, step grid UI, playhead animation
10. **ModularNode Multi-Port**: `getOutputForPort()`, `sourcePortId` parameter, gate signal interface
11. **ADSR Gate Input**: Time-parameterized triggers (`triggerAttackAt`/`ReleaseAt`), `onGateSignal`
12. **Keyboard Module**: QWERTY input, mono priority, octave shift, enable/disable
13. **Recipe Presets**: Parametric presets with morph sliders
14. **Apply Engine**: Non-destructive additive patching (add_chain, add_modulation, add_send, add_layer)
15. **Workspace Zoom**: Scroll/pinch zoom with zoom-to-cursor
16. **Hygiene Pass**: 8 bug fixes — state sync, memory leaks, dead code cleanup

---

## 10. Key Design Decisions

### Why ConstantSourceNode for CV?
ADSR, Sequencer, and Keyboard all use `ConstantSourceNode.offset` for CV output. This provides:
- A schedulable AudioParam (supports `setValueAtTime`, `linearRampToValueAtTime`, etc.)
- DC signal that can be connected to any AudioParam target
- Proper Web Audio graph routing without manual sample manipulation

### Why Gate Targets Instead of Pure CV?
ADSR needs discrete attack/release events. A continuous gate CV (1→0) would require edge detection. Instead, modules with `onGateSignal` receive direct method calls with precise timing — cleaner and more reliable.

### Why "Tale of Two Clocks"?
- `setTimeout` alone has ~15ms jitter
- `requestAnimationFrame` pauses when tab is hidden
- Lookahead scheduling (100ms window) absorbs jitter while staying responsive to BPM/pattern changes
- This is the industry-standard approach (Chris Wilson's article)

### Why State Get/Set Accessors?
SequencerModule needs custom serialization for its nested Pattern object. Converting ModularNode's `state` from a plain property to get/set accessors (backed by `_state`) allows each subclass to customize serialization while keeping the interface uniform.

### Why `window._createModule`?
Workspace needs to instantiate modules during `importState()` but doesn't know how to construct each type's UI. The module factory in main.ts is registered on window, creating a clean callback boundary between UI construction and workspace management.

---

## 11. Known Patterns & Conventions

- **All AudioParam changes use `setTargetAtTime` or `setValueAtTime`** — never direct assignment to `.value` (except during initialization)
- **State is always serializable**: `JSON.parse(JSON.stringify(state))` must round-trip correctly
- **Cleanup is thorough**: every module has `destroy()`, every knob has `dispose()`, event listeners have corresponding removal functions
- **CV naming**: `freq` for pitch input, `cutoff` for filter cutoff, `level` for gain, `res` for resonance, `gate` for gate CV
- **Port naming**: `audio` for main audio I/O, module-specific names for CV ports
- **Module IDs**: UUIDs by default, but presets use semantic names (e.g., 'acid-osc', 'sub-filter')
- **Log knobs**: filter cutoff, oscillator raw frequency, distortion drive, LFO rate all support log scaling
- **Import type**: all type-only imports use `import type` per `verbatimModuleSyntax`

---

## 12. Architectural Strengths

1. **Clean module abstraction**: ModularNode provides a uniform interface for audio routing, state serialization, and multi-port output
2. **Robust import/export**: Extensive validation, backward compatibility, stale import protection
3. **Sophisticated preset system**: Three tiers (classic → stacked → recipe) with composable modifiers and parametric morphing
4. **Apply engine**: Non-destructive additive patching with intelligent routing inference
5. **Proper Web Audio scheduling**: Lookahead transport, anti-click ramps, time-parameterized envelope triggers
6. **Touch support**: All interactions (drag, pan, knobs, ports) work on mobile
7. **Good test coverage**: 16 Puppeteer tests covering presets, imports, keyboard, and apply modes

---

## 13. Architectural Weaknesses & Tech Debt

1. **`main.ts` is a 1833-line monolith**: The module factory, keyboard handler, toolbar construction, and save/load logic are all in one DOMContentLoaded callback. Each `case` in the switch statement builds HTML strings, creates knobs, and configures events inline.

2. **Window globals**: `window._workspace` and `window._createModule` are used for cross-module communication. A proper dependency injection or event bus would be cleaner.

3. **No undo/redo**: Pattern edits, module additions/deletions, and cable changes are all permanent until next save/load.

4. **No visual feedback for CV connections**: CV cables look identical to audio cables. There's no visual indication of CV signal flow vs audio signal flow.

5. **Sequencer UI is inline in main.ts**: The 260-line sequencer case in `createModule` builds the entire step grid, note picker, and playhead animation inline. This is the most complex UI and should be its own component.

6. **State management is ad-hoc**: Each knob callback manually sets both the audio parameter and `state` property. There's no unified state store or reactive binding.

7. **No polyphony**: Keyboard and sequencer are mono. Multiple simultaneous notes would require voice management.

8. **No MIDI support**: Keyboard input only — no Web MIDI API integration.

9. **Cable routing is basic**: Cubic bezier curves with fixed tension. No automatic rerouting to avoid crossing modules.

10. **No audio metering**: No visual indication of signal levels (VU meters, oscilloscope, spectrum analyzer).

11. **Module positioning on creation**: New modules stagger by 20px increments from top-left. No intelligent placement.

12. **Toolbar drawer panels built imperatively**: ~400 lines of DOM createElement/appendChild in main.ts. A component framework (or at minimum, helper functions) would reduce this significantly.

---

## 14. Completed Roadmap Items (from memory)

- [x] Transport singleton with lookahead scheduler
- [x] SequencerModule with dual CV outputs (note + gate)
- [x] ModularNode multi-port output support
- [x] ADSR time-parameterized triggers and gate signal
- [x] Step grid UI with click toggle, right-click note picker, scroll wheel
- [x] Playhead animation
- [x] Save/load integration with transport state
- [x] Backward compatibility with existing patches
- [x] Keyboard trigger module with mono priority
- [x] Scroll/pinch zoom to workspace
- [x] Comprehensive hygiene pass (8 bug fixes)

---

## 15. Future Roadmap Items (from memory)

- [ ] Pattern copy/paste and pattern bank (multiple patterns per sequencer)
- [ ] Velocity editing per step (all steps currently default to velocity 1.0)
- [ ] Tie/legato mode (hold gate across consecutive active steps)
- [ ] Step probability / humanization
- [ ] Transport sync to external MIDI clock
- [ ] Pattern chaining (play patterns in sequence)
- [ ] Undo/redo for pattern edits
- [ ] Piano roll view as alternative to step grid
- [ ] Accent output (separate CV for accented steps)
- [ ] Ratcheting (multiple triggers per step)
- [ ] Transport tempo tap button
- [ ] Pattern randomize button

---

## 16. Signal Flow Diagrams

### Basic Subtractive Synth
```
Oscillator [audio] → Filter [audio] → Gain [audio] → Master
                                          ↑
ADSR [audio] ────────────────────── level (CV)
```

### Sequenced Patch
```
Sequencer [note CV] → Oscillator [freq] (1V/oct pitch)
Sequencer [gate CV] → Gain [level] (amplitude gating)
Sequencer [gate]    → ADSR [onGateSignal] (envelope trigger)
ADSR [audio]        → Gain [level] (envelope CV)
Oscillator [audio]  → Filter [audio] → Gain [audio] → Master
```

### FM Synthesis
```
Modulator Oscillator [audio] → Carrier Oscillator [freq] (FM)
Carrier Oscillator [audio] → Master
```

### Keyboard Trigger
```
Keyboard [note CV] → Oscillator [freq] (1V/oct pitch)
Keyboard [gate CV] → Gain [level] (amplitude gating)
Keyboard [gate]    → ADSR [onGateSignal] (envelope trigger)
```

---

## 17. Data Flow: Patch Import Sequence

1. `importState(jsonString)` called on Workspace
2. Increment `importVersion` (stale import protection)
3. Parse JSON, extract transport state if present
4. Set transport BPM/ticksPerBeat, sync BPM input UI
5. Stop transport if playing
6. `normalizePatchState()` — validate structure, dedupe IDs, check connections
7. Remove all existing modules (except master)
8. For each module in patch: call `window._createModule(type, id, x, y, state)`
   - Creates audio node, builds HTML, adds to workspace, configures knobs, applies state
9. Check importVersion hasn't been superseded
10. For each connection: find source/target port DOM elements, call `attemptConnection()`
    - Validates one-output/one-input, creates SVG cable, connects audio graph
    - Registers gate targets if applicable
11. Return `{ modulesCreated, connectionsCreated, warnings }`

---

## 18. Data Flow: Apply State Sequence

1. `applyState(jsonString, options)` called
2. If mode is 'replace': delegates to `importState()`
3. Parse and normalize patch JSON
4. `buildApplyPlan()`:
   a. Remap IDs to avoid collisions with existing modules
   b. Infer entry/exit modules of incoming patch
   c. Based on mode (add_chain/add_modulation/add_send/add_layer):
      - Determine which existing connections to remove
      - Determine new connections to create
      - For add_chain: splice into existing audio chain
      - For add_modulation: connect modulation source to target CV port
      - For add_send: create parallel send path to master
      - For add_layer: connect as parallel output to master
5. Stop transport
6. Create new modules via `window._createModule`
7. `applyPlannedConnections()`: remove old connections, create new ones
8. Return result with summary stats
