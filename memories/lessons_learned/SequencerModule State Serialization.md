---
title: SequencerModule State Serialization
type: note
permalink: lessons-learned/sequencer-module-state-serialization
tags:
- serialization
- typescript
- state-management
---

# SequencerModule State Serialization

## Problem
ModularNode's `state` property was originally a plain object (`public state: Record<string, any> = {}`). SequencerModule needs custom get/set logic because its state includes a nested Pattern object with steps array, plus octaveOffset and gateLength that are stored in private fields.

## Solution
The base class `state` was converted from a plain property to get/set accessors backed by `protected _state`. This allows SequencerModule to override with custom accessors:

### Getter (for export/save)
Returns a clean serializable object:
```typescript
{
  pattern: { name, length, steps: [{ note, velocity, gate }...] },
  octaveOffset: number,
  gateLength: number
}
```

### Setter (for import/load)
Parses the incoming state object and:
- Reconstructs the Pattern with proper typing
- Uses `NO_VALUE` (-1) as default for missing note values
- Falls back to `createEmptyPattern()` if steps array is missing
- Sets octaveOffset and gateLength from state

## Lesson Learned
TypeScript with `verbatimModuleSyntax` requires type-only imports for interfaces used only as types. The SequencerModule imports use:
```typescript
import { transport } from '../Transport';
import type { TickCallback, StopCallback } from '../Transport';
import { NO_VALUE, createEmptyPattern, midiToCv } from '../sequencer/types';
import type { Pattern, SequencerStep } from '../sequencer/types';
```

## Related
- [[Pattern Sequencer Implementation]]
