---
title: Sequencer Next Steps
type: note
permalink: plans/sequencer-next-steps
tags:
- sequencer
- roadmap
- future-work
---

# Sequencer Next Steps

## Completed
- [x] Transport singleton with lookahead scheduler
- [x] SequencerModule with dual CV outputs (note + gate)
- [x] ModularNode multi-port output support
- [x] ADSR time-parameterized triggers and gate signal
- [x] Step grid UI with click toggle, right-click note picker, scroll wheel
- [x] Playhead animation
- [x] Save/load integration with transport state
- [x] Backward compatibility with existing patches

## Future Improvements to Consider
- [ ] Pattern copy/paste and pattern bank (multiple patterns per sequencer)
- [ ] Velocity editing per step (currently all steps default to velocity 1.0)
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

## Known Edge Cases Handled
- Stop mid-note: cancels scheduled values, forces gate off, releases all ADSRs
- BPM change during playback: recalculates from last tick boundary
- Sequencer delete during playback: unregisters from transport in destroy()
- Multiple sequencers: each independently wraps at own pattern length (polymetric)

## Related
- [[Pattern Sequencer Implementation]]
- [[Transport Architecture Decision]]
