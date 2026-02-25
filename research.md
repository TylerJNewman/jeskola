# Jeskola Clone: Project Research Report

## 1. Overall Intention & Purpose
The project is a browser-based, minimal **Modular Synthesizer** ("Jeskola Clone", paying homage to Jeskola Buzz). Its primary purpose is to be an interactive audio playground where users can visually patch together audio nodes (Oscillators, Filters, Delays, Gains) to the Master Output to explore sound synthesis.
Currently, it serves as an MVP (Minimum Viable Product). It leverages standard Web Technologies (HTML, CSS, TypeScript) and relies heavily on the **Web Audio API** for the underlying DSP (Digital Signal Processing) and a vanilla JavaScript UI engine containing a bespoke DOM-and-SVG based drag-and-drop workspace patcher.

## 2. System Architecture & Learnings
The architecture is split into two primary domains: **Audio Processing** and **User Interface**.

### Audio Engine (`src/audio/`)
- **`AudioEngine.ts`**: A singleton wrapper around the Web Audio `AudioContext`. It manages a master gain node and ensures the browser's autoplay policy is bypassed appropriately via a user gesture.
- **`ModularNode.ts`**: An abstract base class mapping exactly one Web Audio subgraph to a logical "node" the UI can recognize. It maintains `inputNode` and `outputNode` references and provides the `.connect` and `.disconnect` methods.
- **Concrete Modules (`OscillatorModule`, `FilterModule`, `DelayModule`, `GainModule`)**: These instantiate specific graph topologies internally (e.g., `DelayModule` has an internal feedback loop, wet/dry mix, and input/output gains) and expose parameter setters for the UI.

### User Interface (`src/ui/` & `src/main.ts`)
- **`main.ts`**: The glue code. It instantiates the UI, spawns the master node, assigns event listeners to the component palette sidebar, and wires up DOM elements to the Audio Nodes.
- **`Workspace.ts`**: The core interactive canvas tracker. It maps DOM elements representing modules onto an infinite panning workspace. When the user drags between the `.port.output` and `.port.input` elements, it renders bezier curves on an overlaying `<svg id="cables-layer">` and executes the `ModularNode.connect()` bindings.
- **`Knob.ts`**: A custom rotary knob control, strictly measuring absolute mouse-Y pixel deltas when clicked, mapping those smoothly across a defined `min`/`max` value array, and triggering an `onChange` callback.

## 3. Potential Bugs Identified
During the deep dive, several bugs and anti-patterns were found:

1. **Incoming Audio Connection Leak on Module Deletion:** 
   In `Workspace.ts` `removeModule(id)`, the code removes the visual SVG cables attached to the deleted module (`c.svgPath.remove()`) and filters them out of the `connections` array. It also destroys the `ModularNode`, which triggers `this.outputNode.disconnect()`.
   **The Bug:** If the deleted module was the *target* of a connection, the *source* module's audio `.disconnect()` is **never called** for that specific route. The Web Audio graph maintains an invisible connection to the orphaned node's disconnected internals. While Web Audio usually garbage-collects islanded nodes, this is slightly messy and leaves dormant connections on the source node.
2. **Redundant UI Cable Stacking:**
   In `Workspace.ts` `attemptConnection()`, there is no validation checking if `portA` and `portB` are already connected. The user can continuously drag new connections between the exact same ports. Web Audio gracefully ignores redundant graph connections, but the UI will stack overlapping SVG paths indefinitely. If a user tries to click a cable to delete it, only the top-most visual cable is removed, triggering an audio `.disconnect()` that breaks the actual audio flow, but leaving visual ghost cables underneath.
3. **Dead Code in Cable Rendering:**
   In `Workspace.updateAllCables()`, there is a condition handling `conn.targetModuleId === 'master'`. This check assumes the Master Output has no conventional `.port.input` and tries to do an edge case bypass. However, in `main.ts`, the Master Node is generated with a valid `.port.input` block and a UUID instead of the literal string `'master'`. The condition is effectively dead code, though thankfully the normal rendering branch handles the Master Node perfectly because the DOM structure is sound.
4. **Single Port Assumption:**
   `Workspace.updateAllCables()` looks up ports via `.module .port.output` using `querySelector`. This strictly grabs the *first* port found. Currently, modules only have one input and one output. If a module with multiple inputs is introduced (e.g., Carrier In vs Modulator In), the existing routing logic will instantly break.

## 4. Key Assumptions (And their Validity)
- **Assumption 1:** `Knob.ts` assumes the user has a relatively modern pointing device where standard mouse pixel deltas work universally. *Validity: Good for Desktop, fails completely on Touch Devices (no `touchstart`/`touchmove` implementations).*
- **Assumption 2:** The workspace scales infinitely. *Validity: Flawed. Since it only pans visually using CSS transforms (`translate`), there's no boundary limits. A user can pan off into the void and lose their patch forever since there's no "home" or "zoom" functionality.*
- **Assumption 3:** The browser handles polyphony well. *Validity: Good. Instantiating multiple oscillators per standard user interactions shouldn't strain the Web Audio API on modern hardware.*
- **Assumption 4:** Module IDs are always unique. *Validity: Excellent. Relies on `crypto.randomUUID()`, which guarantees collision-free IDs across the session.*

## 5. Next Steps & Recommended Improvements

To align this app closely with its intention as a robust creative sandbox, the following steps are strongly recommended:

### Immediate Bug Fixes
- **Patch the Deletion Leak:** Modify `Workspace.ts` to call `sourceData.audio.disconnect(targetData.audio)` when cleaning up connections involving a deleted target module.
- **Prevent Duplicate Connections:** Traverse the `connections` array in `Workspace.attemptConnection()` before drawing to ensure a connection between `sourceModuleId` and `targetModuleId` doesn't already exist.
- **Add Touch Support:** Upgrade the drag-and-drop code in `Workspace.ts` and `Knob.ts` to attach `touchstart`, `touchmove`, and `touchend` listeners, converting `touches[0].clientY` into coordinates.

### Architectural Improvements
- **Multi-Port Support Engine:** Refactor `Workspace.ts` and `main.ts` Module HTML generators to assign explicit `data-port-id` attributes (e.g., `in-audio`, `in-cv-freq`, `out-main`). `UIConnection` should track `sourcePortId` and `targetPortId`. This paves the way for modular synthesizers' most famous feature: Control Voltage (CV) and FM Synthesis.
- **State Serialization (Save/Load):** Implement functions on `Workspace.ts` to export the current module array, knob positions, and connection matrix into a JSON object, and a corresponding parser to reconstruct the graph on page load.
- **Enhanced UI Controls:** Add simple features like clicking a cable to highlight it before deleting (instead of instant deletion), Keyboard shortcut bindings (e.g. hitting `Backspace` to delete a selected module), and a UI "Recenter" button.
- **Expanded Module Library:**
  - Add **Envelope Generators (ADSR)**.
  - Add **LFOs (Low Frequency Oscillators)** for modulation.
  - Add **Sequencers** or MIDI hookups (via Web MIDI API) so the synthesizers can be "played" rather than just droning endlessly on start.
