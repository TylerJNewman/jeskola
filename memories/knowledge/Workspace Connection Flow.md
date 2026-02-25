---
title: Workspace Connection Flow
type: note
permalink: knowledge/workspace-connection-flow
tags:
- workspace
- connections
- cables
- routing
---

# Workspace Connection Flow

## How Cables Work

### Making a Connection
1. User drags from a port (mousedown on `.port` element)
2. Workspace creates temporary SVG cable following cursor
3. On mouseup over another port, `attemptConnection(portA, portB)` is called
4. Validates: one must be output, one input; no self-connection; no duplicate
5. Calls `sourceData.audio.connect(targetData.audio, targetPortId, sourcePortId)`
6. If source is a 'gate' port and target has `onGateSignal`, registers gate target
7. Creates permanent SVG cable path with click-to-delete handler

### Removing a Connection
1. User clicks on cable SVG path
2. `removeConnection(conn)` called
3. Calls `sourceData.audio.disconnect(targetData.audio, targetPortId, sourcePortId)`
4. If gate connection, deregisters gate target via `removeGateTarget()`
5. Removes SVG path and connection from array

### Removing a Module
1. Finds all connections involving the module
2. For each where module is target, disconnects the source
3. Deregisters any gate targets
4. Calls `audio.destroy()` and removes DOM element
5. Cleans connection array

### sourcePortId Flow
The `sourcePortId` is critical for multi-output modules like SequencerModule:
- Workspace reads `data-port-id` from the output port element
- Passes it through `connect()` → `getOutputForPort(sourcePortId)` → correct AudioNode
- Stored in `UIConnection.sourcePortId` for later disconnect
- Must be passed to both `connect()` and `disconnect()` to target the right node

## Related
- [[ModularNode Multi-Port Output Decision]]
- [[Jeskola Project Architecture]]
