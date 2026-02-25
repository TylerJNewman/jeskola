---
title: Transport Architecture Decision
type: note
permalink: decisions/transport-architecture-decision
tags:
- transport
- architecture
- scheduling
- web-audio
---

# Transport Architecture Decision

## Context
Jeskola needed a clock/scheduler system for the pattern sequencer. No BPM, scheduler, or timing system existed previously.

## Decision
Implemented a "tale of two clocks" approach as a global Transport singleton.

## How It Works
- **JavaScript timer**: `setTimeout` fires every 25ms to check what needs scheduling
- **Web Audio lookahead**: Schedules events up to 100ms into the future using `AudioContext.currentTime`
- This decouples the imprecise JS timer from the sample-accurate Web Audio scheduler
- The JS timer fills a buffer of upcoming events; Web Audio executes them precisely

## Why This Pattern
- `setTimeout` alone has ~15ms jitter (too imprecise for musical timing)
- Scheduling everything at once causes problems when BPM changes or patterns are edited
- The lookahead window (100ms) is small enough to respond quickly to changes but large enough to absorb JS timer jitter
- This is the standard pattern recommended by Chris Wilson's "A Tale of Two Clocks" article

## Alternatives Considered
- **AudioWorklet-based clock**: More precise but harder to communicate with main thread for UI updates
- **requestAnimationFrame**: Tied to display refresh, pauses when tab is hidden
- **Web Worker timer**: Better than setTimeout for background tabs but adds complexity

## Consequences
- Transport is a singleton like AudioEngine — only one global clock
- Modules register callbacks: `onTick(tickIndex, tickTime)` and `onStop()`
- Multiple sequencers sharing the same transport naturally support polymetric patterns (different pattern lengths, same clock)
- BPM changes mid-playback work by recalculating nextTickTime from last tick boundary
- Swing is implemented as time offset on odd-numbered ticks

## Related
- [[Pattern Sequencer Implementation]]
- [[ModularNode Multi-Port Output Decision]]
