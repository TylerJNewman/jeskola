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
  })
};
