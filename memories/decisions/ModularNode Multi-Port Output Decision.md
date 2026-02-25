---
title: ModularNode Multi-Port Output Decision
type: note
permalink: decisions/modular-node-multi-port-output-decision
tags:
- modular-node
- multi-port
- architecture
- gate-signal
---

# ModularNode Multi-Port Output Decision

## Context
The sequencer module needs to output two distinct signals: note CV (pitch) and gate CV (on/off). The existing ModularNode `connect()` always used `this.outputNode` regardless of which port the cable originated from.

## Decision
Extended `connect()` and `disconnect()` with an optional `sourcePortId` parameter and added a `getOutputForPort()` method.

## Implementation
```typescript
// Base class method — subclasses can override
public getOutputForPort(portId: string): AudioNode | null {
  if (!portId || portId === 'audio') return this.outputNode;
  const param = this.params.get(portId);
  if (param instanceof AudioNode) return param;
  return this.outputNode;
}

public connect(destination: ModularNode, targetPortId?: string, sourcePortId?: string): void {
  const output = sourcePortId ? this.getOutputForPort(sourcePortId) : this.outputNode;
  // ... routing logic using output instead of this.outputNode
}
```

## Key Details
- SequencerModule stores gateCV in `params.set('gate', gateCV)` so the base class `getOutputForPort('gate')` finds it
- SequencerModule also overrides `getOutputForPort()` explicitly for clarity
- All existing callers pass no `sourcePortId`, so behavior is 100% backward compatible
- Workspace passes `sourcePortId` through `attemptConnection()`, `removeConnection()`, and `removeModule()`

## Gate Signal Interface
Also added optional `onGateSignal?(gateOn: boolean, time: number)` to ModularNode. This allows ADSR modules to receive discrete gate events rather than trying to detect edges on a CV signal. The Workspace registers gate targets when a 'gate' port cable connects to a module that implements `onGateSignal`.

## Related
- [[Pattern Sequencer Implementation]]
- [[Transport Architecture Decision]]
