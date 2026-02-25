---
title: CV Voltage Standard
type: note
permalink: knowledge/cv-voltage-standard
tags:
- cv
- voltage
- pitch
- 1v-octave
- modular
---

# CV Voltage Standard

## The 1V/Octave Convention in Jeskola

### How It Works
- Sequencer outputs pitch as: `(midiNote - 60) / 12`
- This means C4 (MIDI 60) = 0V, C5 (MIDI 72) = 1V, C3 (MIDI 48) = -1V
- Each semitone = 1/12 of a volt

### How OscillatorModule Receives It
- OscillatorModule has `cvPitchMod` GainNode with `gain.value = 1200`
- This GainNode feeds into `osc.detune` AudioParam
- So: 1V input × 1200 gain = 1200 cents = 1 octave of detune
- The math works out: `(midi - 60) / 12 * 1200 = (midi - 60) * 100` cents

### Gate CV
- Gate output: 1.0 = note on, 0.0 = note off
- Velocity-sensitive: gate value = step.velocity (0 to 1)
- Can connect to Gain `level` for amplitude gating
- Can connect to Filter `cutoff` for filter key-follow effects

### ADSR Gate Signal
- Separate from CV: uses direct method call `onGateSignal(gateOn, time)`
- This is because ADSR needs discrete attack/release events, not a continuous signal
- Gate targets are tracked in SequencerModule's `gateTargets: Set<ModularNode>`
- Workspace manages registration when cables connect/disconnect

## Related
- [[Pattern Sequencer Implementation]]
