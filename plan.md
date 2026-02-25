# Jeskola Clone: Implementation Plan

This document outlines the step-by-step implementation details and code snippets required to fix the known bugs and build out the recommended architectural improvements and new features for the Jeskola Clone MVP.

---

## Phase 1: Immediate Bug Fixes

### 1.1 Patching the Deletion Leak in `Workspace.ts`
**Goal:** Ensure that deleting a module properly disconnects the audio of any modules that were connected *to* it.
**File:** `src/ui/Workspace.ts`
**Changes:** In `removeModule(id: string)`, we need to invoke `disconnect()` on the source audio node when cleaning up connections where the deleted module is the target.

```typescript
// Proposed snippet in Workspace.ts -> removeModule()
public removeModule(id: string) {
  const data = this.modules.get(id);
  if (!data) return;

  // cleanup outgoing audio from this module
  data.audio.destroy();
  
  // cleanup DOM
  data.element.remove();
  this.modules.delete(id);

  // cleanup connections and cleanly sever audio paths
  const toRemove = this.connections.filter(c => c.sourceModuleId === id || c.targetModuleId === id);
  toRemove.forEach(c => {
    // If the deleted module is the TARGET, we must disconnect the SOURCE's audio
    if (c.targetModuleId === id && c.sourceModuleId !== id) {
      const sourceData = this.modules.get(c.sourceModuleId);
      if (sourceData) {
        sourceData.audio.disconnect(data.audio);
      }
    }
    c.svgPath.remove();
  });
  
  this.connections = this.connections.filter(c => c.sourceModuleId !== id && c.targetModuleId !== id);
  this.updateAllCables();
}
```

### 1.2 Preventing Duplicate Connections
**Goal:** Stop the user from patching identical cables between the same source and target ports.
**File:** `src/ui/Workspace.ts`
**Changes:** In `attemptConnection()`, add a check before creating the new connection.

```typescript
// Proposed snippet in Workspace.ts -> attemptConnection()
private attemptConnection(portA: HTMLElement, portB: HTMLElement) {
    // ... setup and ID extraction ...
    if (!sourceModuleId || !targetModuleId || sourceModuleId === targetModuleId) return;

    // ----- NEW CHECK -----
    // Check if a connection already exists between these two ports
    const connectionExists = this.connections.some(c => 
      c.sourceModuleId === sourceModuleId && c.targetModuleId === targetModuleId
    );
    if (connectionExists) return;
    // ---------------------

    const sourceData = this.modules.get(sourceModuleId);
    // ... connection logic continues
}
```

---

## Phase 2: Core UX and Architecture Enhancements

### 2.1 Implementing Touch Support
**Goal:** Allow users on phones/tablets to drag modules, twist knobs, and patch cables.
**Files:** `src/ui/Knob.ts`, `src/ui/Workspace.ts`
**Strategy:** Map `touchstart`, `touchmove`, and `touchend` events alongside mouse events, utilizing `e.touches[0].clientY` instead of `e.clientY`.

```typescript
// Example snippet in Knob.ts -> initEvents()

// Mouse Down / Touch Start
const handleStart = (clientY: number) => {
  this.isDragging = true;
  this.startY = clientY;
  this.startValue = this.currentValue;
}

knobContainer.addEventListener('mousedown', (e) => {
  e.stopPropagation();
  handleStart(e.clientY);
  document.body.style.cursor = 'ns-resize';
});

knobContainer.addEventListener('touchstart', (e) => {
  e.stopPropagation();
  handleStart(e.touches[0].clientY);
}, { passive: false });

// Window Move / Touch Move
window.addEventListener('mousemove', (e) => {
  if (this.isDragging) handleMove(e.clientY);
});
window.addEventListener('touchmove', (e) => {
  if (this.isDragging) {
    e.preventDefault(); // prevent scrolling while twisting knob
    handleMove(e.touches[0].clientY);
  }
}, { passive: false });

const handleMove = (clientY: number) => {
  const deltaY = this.startY - clientY;
  const range = this.max - this.min;
  const valueDelta = (deltaY / 150) * range;
  this.currentValue = Math.min(this.max, Math.max(this.min, this.startValue + valueDelta));
  this.updateVisuals();
  this.onChange(this.currentValue);
}

// Touchend maps to Mouseup to clear isDragging
```
*(Similar parallel mapping is needed in `Workspace.ts` for module dragging and cable ports).*

### 2.2 Multi-Port / Control Voltage (CV) Support
**Goal:** Allow modules to have multiple discrete inputs (e.g. an Oscillator with "Audio Out", "Frequency CV In", "FM In").
**Strategy:** 
1. `ModularNode.connect(destination, outputIndex, inputIndex)` must be updated to handle specific Web Audio `.connect(destination.nodes[x])` destinations.
2. `UIConnection` interface must store the specific `portId`.
3. HTML payload in `main.ts` must assign `data-port-id="audio"` or `data-port-id="cv-freq"` to `<div class="port">`.

```typescript
// ModularNode needs specific parameter exposure instead of just 1 inputNode
export abstract class ModularNode {
  // Map of accessible AudioParams for modulation (CV)
  protected params: Map<string, AudioParam> = new Map();
  protected inputNodes: Map<string, AudioNode> = new Map();
  //...
  
  public connectParam(target: ModularNode, paramId: string) {
      if (this.outputNode && target.params.has(paramId)) {
          this.outputNode.connect(target.params.get(paramId)!);
      }
  }
}
```
This is a high-effort architectural change that forms the foundation of real modular synthesis (e.g., routing an LFO to a Filter Cutoff).

### 2.3 State Serialization (Save / Load)
**Goal:** Allow users to persist their patches.
**Files:** `src/ui/Workspace.ts` (Add `exportState()` and `importState(json)`)
**Strategy:**
Create a JSON payload representing the canvas:
```json
{
  "modules": [
    { "id": "uuid-1", "type": "oscillator", "x": 100, "y": 150, "state": { "freq": 440, "type": "sine" } },
    { "id": "uuid-2", "type": "filter", "x": 300, "y": 150, "state": { "cutoff": 1000, "res": 1 } }
  ],
  "connections": [
    { "sourceId": "uuid-1", "targetId": "uuid-2", "sourcePort": "out", "targetPort": "in" }
  ]
}
```

---

## Phase 3: Expanding the Module Library

Once multi-port/CV support is active, we will introduce:

1. **LFOModule (Low Frequency Oscillator):**
   - Identical to Oscillator, but frequency goes from `0.1Hz` to `20Hz`.
   - Its output is meant to be dragged into the "CV In" port of a Filter or Oscillator.

2. **ADSR Envelope Generator:**
   - Instead of droning endlessly, this module sends an automation curve (Attack, Decay, Sustain, Release) when triggered.
   - Requires a `trigger` method.
   
3. **Keyboard / Trigger Module:**
   - Listens to `window.keydown` events (A, W, S, E, D, F, G row mapping to musical notes).
   - Has two outputs: 
     - **CV Out:** Routes to Oscillator Frequency.
     - **Gate Out:** Routes to ADSR Envelope trigger.

## Summary of Execution Steps
If approved by the user, the execution will follow this order:
1. Implement Phase 1 Bug Fixes `(Workspace.ts)`.
2. Implement Touch Support `(Knob.ts, Workspace.ts)`.
3. Undertake the Phase 2 Architecture Refactor `(Multi-Port & CV)`, modifying `main.ts` HTML strings and `ModularNode` base classes.
4. Implement the Expanded Library `(LFO, Keyboard)` to take advantage of the new CV system.
