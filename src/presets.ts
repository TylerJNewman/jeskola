export const PRESETS: Record<string, string> = {
  "sub-bass": JSON.stringify({
    modules: [
      { id: "sub-osc1", type: "oscillator", x: 100, y: 100, state: { octave: -2, semitone: 0, cents: 0, mode: 'pitch', type: 'square', freqLog: false } },
      { id: "sub-osc2", type: "oscillator", x: 100, y: 300, state: { octave: -1, semitone: 0, cents: 7, mode: 'pitch', type: 'sawtooth', freqLog: false } },
      { id: "sub-filter", type: "filter", x: 400, y: 200, state: { cutoff: 250, res: 6, type: 'lowpass', cutoffLog: true } }
    ],
    connections: [
      { sourceModuleId: "sub-osc1", targetModuleId: "sub-filter", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "sub-osc2", targetModuleId: "sub-filter", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "sub-filter", targetModuleId: "master", sourcePortId: "audio", targetPortId: "audio" }
    ]
  }),
  "ethereal-drone": JSON.stringify({
    modules: [
      { id: "drone-osc1", type: "oscillator", x: 100, y: 100, state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sine', freqLog: false } },
      { id: "drone-osc2", type: "oscillator", x: 100, y: 300, state: { octave: 0, semitone: 7, cents: 2, mode: 'pitch', type: 'triangle', freqLog: false } },
      { id: "drone-delay", type: "delay", x: 400, y: 200, state: { time: 0.8, feedback: 0.7, mix: 0.6 } }
    ],
    connections: [
      { sourceModuleId: "drone-osc1", targetModuleId: "drone-delay", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "drone-osc2", targetModuleId: "drone-delay", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "drone-delay", targetModuleId: "master", sourcePortId: "audio", targetPortId: "audio" }
    ]
  }),
  "sci-fi-fm": JSON.stringify({
    modules: [
      { id: "fm-modulator", type: "oscillator", x: 100, y: 100, state: { freq: 50, mode: 'freq', type: 'sine', freqLog: true } },
      { id: "fm-carrier", type: "oscillator", x: 400, y: 200, state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sine', freqLog: false } }
    ],
    connections: [
      { sourceModuleId: "fm-modulator", targetModuleId: "fm-carrier", sourcePortId: "audio", targetPortId: "freq" },
      { sourceModuleId: "fm-carrier", targetModuleId: "master", sourcePortId: "audio", targetPortId: "audio" }
    ]
  }),
  "classic-pluck": JSON.stringify({
    modules: [
      { id: "pluck-osc", type: "oscillator", x: 100, y: 100, state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sawtooth', freqLog: false } },
      { id: "pluck-adsr", type: "adsr", x: 100, y: 350, state: { attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.1 } },
      { id: "pluck-gain", type: "gain", x: 400, y: 200, state: { level: 0.0 } },
      { id: "pluck-delay", type: "delay", x: 650, y: 200, state: { time: 0.4, feedback: 0.4, mix: 0.3 } }
    ],
    connections: [
      { sourceModuleId: "pluck-osc", targetModuleId: "pluck-gain", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "pluck-adsr", targetModuleId: "pluck-gain", sourcePortId: "audio", targetPortId: "level" },
      { sourceModuleId: "pluck-gain", targetModuleId: "pluck-delay", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "pluck-delay", targetModuleId: "master", sourcePortId: "audio", targetPortId: "audio" }
    ]
  }),
  "acid-bass-sweep": JSON.stringify({
    modules: [
      { id: "acid-osc", type: "oscillator", x: 100, y: 100, state: { octave: -1, semitone: 0, cents: 0, mode: 'pitch', type: 'square', freqLog: false } },
      { id: "acid-adsr", type: "adsr", x: 100, y: 350, state: { attack: 0.01, decay: 0.3, sustain: 0.0, release: 0.2 } },
      { id: "acid-filter", type: "filter", x: 400, y: 100, state: { cutoff: 100, res: 15, type: 'lowpass', cutoffLog: true } },
      { id: "acid-gain", type: "gain", x: 700, y: 200, state: { level: 0.0 } }
    ],
    connections: [
      { sourceModuleId: "acid-osc", targetModuleId: "acid-filter", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "acid-filter", targetModuleId: "acid-gain", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "acid-adsr", targetModuleId: "acid-filter", sourcePortId: "audio", targetPortId: "cutoff" },
      { sourceModuleId: "acid-adsr", targetModuleId: "acid-gain", sourcePortId: "audio", targetPortId: "level" },
      { sourceModuleId: "acid-gain", targetModuleId: "master", sourcePortId: "audio", targetPortId: "audio" }
    ]
  }),
  "ambient-pad": JSON.stringify({
    modules: [
      { id: "pad-osc1", type: "oscillator", x: 100, y: 100, state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sine', freqLog: false } },
      { id: "pad-osc2", type: "oscillator", x: 100, y: 350, state: { octave: 0, semitone: 7, cents: 4, mode: 'pitch', type: 'triangle', freqLog: false } },
      { id: "pad-adsr", type: "adsr", x: 100, y: 600, state: { attack: 1.5, decay: 1.0, sustain: 0.8, release: 2.5 } },
      { id: "pad-filter", type: "filter", x: 400, y: 200, state: { cutoff: 800, res: 0, type: 'lowpass', cutoffLog: true } },
      { id: "pad-gain", type: "gain", x: 700, y: 200, state: { level: 0.0 } },
      { id: "pad-delay", type: "delay", x: 950, y: 200, state: { time: 0.8, feedback: 0.7, mix: 0.6 } }
    ],
    connections: [
      { sourceModuleId: "pad-osc1", targetModuleId: "pad-filter", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "pad-osc2", targetModuleId: "pad-filter", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "pad-filter", targetModuleId: "pad-gain", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "pad-adsr", targetModuleId: "pad-gain", sourcePortId: "audio", targetPortId: "level" },
      { sourceModuleId: "pad-gain", targetModuleId: "pad-delay", sourcePortId: "audio", targetPortId: "audio" },
    ]
  }),
  "wobble-bass": JSON.stringify({
    modules: [
      { id: "wobble-osc", type: "oscillator", x: 100, y: 100, state: { octave: -1, semitone: 0, cents: 0, mode: 'pitch', type: 'sawtooth', freqLog: false } },
      { id: "wobble-filter", type: "filter", x: 400, y: 100, state: { cutoff: 300, res: 12, type: 'lowpass', cutoffLog: true } },
      { id: "wobble-lfo", type: "lfo", x: 100, y: 350, state: { rate: 3.5, depth: 400.0, type: 'sine' } },
      { id: "wobble-gain", type: "gain", x: 700, y: 100, state: { level: 0.8 } }
    ],
    connections: [
      { sourceModuleId: "wobble-osc", targetModuleId: "wobble-filter", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "wobble-lfo", targetModuleId: "wobble-filter", sourcePortId: "audio", targetPortId: "cutoff" },
      { sourceModuleId: "wobble-filter", targetModuleId: "wobble-gain", sourcePortId: "audio", targetPortId: "audio" },
      { sourceModuleId: "wobble-gain", targetModuleId: "master", sourcePortId: "audio", targetPortId: "audio" }
    ]
  })
};
