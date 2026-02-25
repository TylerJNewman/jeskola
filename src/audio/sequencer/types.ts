export const NO_VALUE = -1;

export interface SequencerStep {
  note: number;       // MIDI 0-127, or NO_VALUE
  velocity: number;   // 0-1, or NO_VALUE
  gate: boolean;      // true = note on
}

export interface Pattern {
  name: string;
  length: number;     // 1-64 steps
  steps: SequencerStep[];
}

export function createEmptyPattern(length: number = 16, name: string = 'Pattern 1'): Pattern {
  const steps: SequencerStep[] = [];
  for (let i = 0; i < length; i++) {
    steps.push({ note: NO_VALUE, velocity: 1.0, gate: false });
  }
  return { name, length, steps };
}

export function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = names[midi % 12];
  return `${note}${octave}`;
}

export function midiToCv(midi: number): number {
  return (midi - 60) / 12; // 1V/octave, C4 = 0
}
