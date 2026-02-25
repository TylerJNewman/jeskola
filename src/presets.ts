type PatchModule = {
  id: string;
  type: string;
  x: number;
  y: number;
  state: Record<string, any>;
};

type PatchConnection = {
  sourceModuleId: string;
  targetModuleId: string;
  sourcePortId: string;
  targetPortId: string;
};

type PatchState = {
  modules: PatchModule[];
  connections: PatchConnection[];
};

type PresetDef = {
  name: string;
  patch: PatchState;
  tags?: string[];
};

type PresetModifier = {
  name: string;
  apply: (base: PatchState) => PatchState;
  constraints?: {
    requiresTypes?: string[];
  };
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\+/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function clonePatch<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function assertUniqueModuleIds(patch: PatchState, label: string): void {
  const seen = new Set<string>();
  for (const m of patch.modules) {
    if (seen.has(m.id)) {
      throw new Error(`${label}: duplicate module id ${m.id}`);
    }
    seen.add(m.id);
  }
}

function assertValidConnections(patch: PatchState, label: string): void {
  const ids = new Set(patch.modules.map((m) => m.id));
  ids.add('master');

  for (const c of patch.connections) {
    if (!ids.has(c.sourceModuleId)) {
      throw new Error(`${label}: invalid connection source ${c.sourceModuleId}`);
    }
    if (!ids.has(c.targetModuleId)) {
      throw new Error(`${label}: invalid connection target ${c.targetModuleId}`);
    }
  }
}

function ensureMasterRoute(patch: PatchState, label: string): void {
  const hasMasterRoute = patch.connections.some(
    (c) => c.targetModuleId === 'master' && (c.targetPortId || 'audio') === 'audio'
  );
  if (!hasMasterRoute) {
    throw new Error(`${label}: patch must route audio to master`);
  }
}

function validatePatch(patch: PatchState, label: string): void {
  assertUniqueModuleIds(patch, label);
  assertValidConnections(patch, label);
  ensureMasterRoute(patch, label);
}

function mergePatch(base: PatchState, addon: PatchState, label: string): PatchState {
  const merged: PatchState = {
    modules: [...base.modules, ...addon.modules],
    connections: [...base.connections, ...addon.connections]
  };
  validatePatch(merged, label);
  return merged;
}

function hasType(patch: PatchState, type: string): boolean {
  return patch.modules.some((m) => m.type === type);
}

function firstModuleOfType(patch: PatchState, type: string): PatchModule | undefined {
  return patch.modules.find((m) => m.type === type);
}

function findFirstAudioRouteToMaster(patch: PatchState): PatchConnection | undefined {
  return patch.connections.find(
    (c) => c.targetModuleId === 'master' && c.targetPortId === 'audio' && c.sourcePortId === 'audio'
  );
}

function composePreset(basePreset: PresetDef, modifier: PresetModifier, composedName: string): PresetDef {
  if (modifier.constraints?.requiresTypes) {
    for (const requiredType of modifier.constraints.requiresTypes) {
      if (!hasType(basePreset.patch, requiredType)) {
        throw new Error(`Cannot compose ${composedName}: missing required type ${requiredType}`);
      }
    }
  }

  const base = clonePatch(basePreset.patch);
  const nextPatch = modifier.apply(base);
  validatePatch(nextPatch, composedName);

  return {
    name: composedName,
    patch: nextPatch,
    tags: ['composed', ...(basePreset.tags || [])]
  };
}

const BASE_PRESETS: PresetDef[] = [
  {
    name: 'Sub Bass',
    tags: ['base', 'bass'],
    patch: {
      modules: [
        { id: 'sub-osc1', type: 'oscillator', x: 100, y: 100, state: { octave: -2, semitone: 0, cents: 0, mode: 'pitch', type: 'square', freqLog: false } },
        { id: 'sub-osc2', type: 'oscillator', x: 100, y: 300, state: { octave: -1, semitone: 0, cents: 7, mode: 'pitch', type: 'sawtooth', freqLog: false } },
        { id: 'sub-filter', type: 'filter', x: 400, y: 200, state: { cutoff: 250, res: 6, type: 'lowpass', cutoffLog: true } }
      ],
      connections: [
        { sourceModuleId: 'sub-osc1', targetModuleId: 'sub-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'sub-osc2', targetModuleId: 'sub-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'sub-filter', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Ethereal Drone',
    tags: ['base', 'drone'],
    patch: {
      modules: [
        { id: 'drone-osc1', type: 'oscillator', x: 100, y: 100, state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sine', freqLog: false } },
        { id: 'drone-osc2', type: 'oscillator', x: 100, y: 300, state: { octave: 0, semitone: 7, cents: 2, mode: 'pitch', type: 'triangle', freqLog: false } },
        { id: 'drone-delay', type: 'delay', x: 400, y: 200, state: { time: 0.8, feedback: 0.7, mix: 0.6 } }
      ],
      connections: [
        { sourceModuleId: 'drone-osc1', targetModuleId: 'drone-delay', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'drone-osc2', targetModuleId: 'drone-delay', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'drone-delay', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Sci-Fi FM',
    tags: ['base', 'fm'],
    patch: {
      modules: [
        { id: 'fm-modulator', type: 'oscillator', x: 100, y: 100, state: { freq: 50, mode: 'freq', type: 'sine', freqLog: true } },
        { id: 'fm-carrier', type: 'oscillator', x: 400, y: 200, state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sine', freqLog: false } }
      ],
      connections: [
        { sourceModuleId: 'fm-modulator', targetModuleId: 'fm-carrier', sourcePortId: 'audio', targetPortId: 'freq' },
        { sourceModuleId: 'fm-carrier', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Classic Pluck',
    tags: ['base', 'pluck'],
    patch: {
      modules: [
        { id: 'pluck-osc', type: 'oscillator', x: 100, y: 100, state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sawtooth', freqLog: false } },
        { id: 'pluck-adsr', type: 'adsr', x: 100, y: 350, state: { attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.1 } },
        { id: 'pluck-gain', type: 'gain', x: 400, y: 200, state: { level: 0.0 } },
        { id: 'pluck-delay', type: 'delay', x: 650, y: 200, state: { time: 0.4, feedback: 0.4, mix: 0.3 } }
      ],
      connections: [
        { sourceModuleId: 'pluck-osc', targetModuleId: 'pluck-gain', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'pluck-adsr', targetModuleId: 'pluck-gain', sourcePortId: 'audio', targetPortId: 'level' },
        { sourceModuleId: 'pluck-gain', targetModuleId: 'pluck-delay', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'pluck-delay', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Acid Bass Sweep',
    tags: ['base', 'acid'],
    patch: {
      modules: [
        { id: 'acid-osc', type: 'oscillator', x: 100, y: 100, state: { octave: -1, semitone: 0, cents: 0, mode: 'pitch', type: 'square', freqLog: false } },
        { id: 'acid-adsr', type: 'adsr', x: 100, y: 350, state: { attack: 0.01, decay: 0.3, sustain: 0.0, release: 0.2 } },
        { id: 'acid-filter', type: 'filter', x: 400, y: 100, state: { cutoff: 100, res: 15, type: 'lowpass', cutoffLog: true } },
        { id: 'acid-gain', type: 'gain', x: 700, y: 200, state: { level: 0.0 } }
      ],
      connections: [
        { sourceModuleId: 'acid-osc', targetModuleId: 'acid-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'acid-filter', targetModuleId: 'acid-gain', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'acid-adsr', targetModuleId: 'acid-filter', sourcePortId: 'audio', targetPortId: 'cutoff' },
        { sourceModuleId: 'acid-adsr', targetModuleId: 'acid-gain', sourcePortId: 'audio', targetPortId: 'level' },
        { sourceModuleId: 'acid-gain', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Acid Drive',
    tags: ['base', 'acid', 'distortion'],
    patch: {
      modules: [
        { id: 'drive-osc', type: 'oscillator', x: 100, y: 140, state: { octave: -1, semitone: 0, cents: 0, mode: 'pitch', type: 'sawtooth', freqLog: false } },
        { id: 'drive-dist', type: 'distortion', x: 370, y: 140, state: { drive: 5.5, mix: 0.75, output: 0.8, driveLog: true } },
        { id: 'drive-filter', type: 'filter', x: 650, y: 140, state: { cutoff: 650, res: 8, type: 'lowpass', cutoffLog: true } }
      ],
      connections: [
        { sourceModuleId: 'drive-osc', targetModuleId: 'drive-dist', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'drive-dist', targetModuleId: 'drive-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'drive-filter', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Ambient Pad',
    tags: ['base', 'ambient'],
    patch: {
      modules: [
        { id: 'pad-osc1', type: 'oscillator', x: 100, y: 100, state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sine', freqLog: false } },
        { id: 'pad-osc2', type: 'oscillator', x: 100, y: 350, state: { octave: 0, semitone: 7, cents: 4, mode: 'pitch', type: 'triangle', freqLog: false } },
        { id: 'pad-adsr', type: 'adsr', x: 100, y: 600, state: { attack: 1.5, decay: 1.0, sustain: 0.8, release: 2.5 } },
        { id: 'pad-filter', type: 'filter', x: 400, y: 200, state: { cutoff: 800, res: 0, type: 'lowpass', cutoffLog: true } },
        { id: 'pad-gain', type: 'gain', x: 700, y: 200, state: { level: 0.0 } },
        { id: 'pad-delay', type: 'delay', x: 950, y: 200, state: { time: 0.8, feedback: 0.7, mix: 0.6 } }
      ],
      connections: [
        { sourceModuleId: 'pad-osc1', targetModuleId: 'pad-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'pad-osc2', targetModuleId: 'pad-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'pad-filter', targetModuleId: 'pad-gain', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'pad-adsr', targetModuleId: 'pad-gain', sourcePortId: 'audio', targetPortId: 'level' },
        { sourceModuleId: 'pad-gain', targetModuleId: 'pad-delay', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'pad-delay', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Wobble Bass',
    tags: ['base', 'bass', 'modulation'],
    patch: {
      modules: [
        { id: 'wobble-osc', type: 'oscillator', x: 100, y: 100, state: { octave: -1, semitone: 0, cents: 0, mode: 'pitch', type: 'sawtooth', freqLog: false } },
        { id: 'wobble-filter', type: 'filter', x: 400, y: 100, state: { cutoff: 300, res: 12, type: 'lowpass', cutoffLog: true } },
        { id: 'wobble-lfo', type: 'lfo', x: 100, y: 350, state: { rate: 3.5, depth: 0.5, type: 'sine' } },
        { id: 'wobble-gain', type: 'gain', x: 700, y: 100, state: { level: 0.8 } }
      ],
      connections: [
        { sourceModuleId: 'wobble-osc', targetModuleId: 'wobble-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'wobble-lfo', targetModuleId: 'wobble-filter', sourcePortId: 'audio', targetPortId: 'cutoff' },
        { sourceModuleId: 'wobble-filter', targetModuleId: 'wobble-gain', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'wobble-gain', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Classic Mono Lead',
    tags: ['base', 'classic', 'lead'],
    patch: {
      modules: [
        { id: 'mono-osc', type: 'oscillator', x: 100, y: 130, state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sawtooth', freqLog: false } },
        { id: 'mono-dist', type: 'distortion', x: 340, y: 130, state: { drive: 4.8, mix: 0.7, output: 0.85, driveLog: true } },
        { id: 'mono-filter', type: 'filter', x: 590, y: 130, state: { cutoff: 1400, res: 3.5, type: 'lowpass', cutoffLog: true } },
        { id: 'mono-gain', type: 'gain', x: 830, y: 130, state: { level: 0.9 } },
        { id: 'mono-delay', type: 'delay', x: 1080, y: 130, state: { time: 0.23, feedback: 0.28, mix: 0.22 } }
      ],
      connections: [
        { sourceModuleId: 'mono-osc', targetModuleId: 'mono-dist', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'mono-dist', targetModuleId: 'mono-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'mono-filter', targetModuleId: 'mono-gain', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'mono-gain', targetModuleId: 'mono-delay', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'mono-delay', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Deep Techno Stab',
    tags: ['base', 'classic', 'stab'],
    patch: {
      modules: [
        { id: 'stab-osc1', type: 'oscillator', x: 90, y: 80, state: { octave: -1, semitone: 0, cents: -4, mode: 'pitch', type: 'sawtooth', freqLog: false } },
        { id: 'stab-osc2', type: 'oscillator', x: 90, y: 280, state: { octave: -1, semitone: 7, cents: 4, mode: 'pitch', type: 'square', freqLog: false } },
        { id: 'stab-filter', type: 'filter', x: 360, y: 170, state: { cutoff: 950, res: 6, type: 'lowpass', cutoffLog: true } },
        { id: 'stab-gain', type: 'gain', x: 620, y: 170, state: { level: 0.0 } },
        { id: 'stab-adsr', type: 'adsr', x: 350, y: 410, state: { attack: 0.01, decay: 0.23, sustain: 0.08, release: 0.16 } }
      ],
      connections: [
        { sourceModuleId: 'stab-osc1', targetModuleId: 'stab-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'stab-osc2', targetModuleId: 'stab-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'stab-filter', targetModuleId: 'stab-gain', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'stab-adsr', targetModuleId: 'stab-gain', sourcePortId: 'audio', targetPortId: 'level' },
        { sourceModuleId: 'stab-gain', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Dub Chord Echo',
    tags: ['base', 'classic', 'dub'],
    patch: {
      modules: [
        { id: 'dub-osc1', type: 'oscillator', x: 100, y: 90, state: { octave: -1, semitone: 0, cents: 0, mode: 'pitch', type: 'triangle', freqLog: false } },
        { id: 'dub-osc2', type: 'oscillator', x: 100, y: 280, state: { octave: 0, semitone: 7, cents: 0, mode: 'pitch', type: 'triangle', freqLog: false } },
        { id: 'dub-filter', type: 'filter', x: 350, y: 180, state: { cutoff: 650, res: 2.8, type: 'lowpass', cutoffLog: true } },
        { id: 'dub-delay', type: 'delay', x: 620, y: 180, state: { time: 0.52, feedback: 0.74, mix: 0.62 } }
      ],
      connections: [
        { sourceModuleId: 'dub-osc1', targetModuleId: 'dub-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'dub-osc2', targetModuleId: 'dub-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'dub-filter', targetModuleId: 'dub-delay', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'dub-delay', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Electro FM Bell',
    tags: ['base', 'classic', 'fm'],
    patch: {
      modules: [
        { id: 'bell-mod', type: 'oscillator', x: 90, y: 90, state: { freq: 180, mode: 'freq', type: 'sine', freqLog: true } },
        { id: 'bell-carrier', type: 'oscillator', x: 360, y: 170, state: { octave: 1, semitone: 0, cents: 0, mode: 'pitch', type: 'sine', freqLog: false } },
        { id: 'bell-filter', type: 'filter', x: 620, y: 170, state: { cutoff: 3200, res: 1.2, type: 'bandpass', cutoffLog: true } }
      ],
      connections: [
        { sourceModuleId: 'bell-mod', targetModuleId: 'bell-carrier', sourcePortId: 'audio', targetPortId: 'freq' },
        { sourceModuleId: 'bell-carrier', targetModuleId: 'bell-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'bell-filter', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Classic Wobble Lead',
    tags: ['base', 'classic', 'lead', 'modulation'],
    patch: {
      modules: [
        { id: 'cw-osc', type: 'oscillator', x: 90, y: 110, state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sawtooth', freqLog: false } },
        { id: 'cw-dist', type: 'distortion', x: 330, y: 110, state: { drive: 6.2, mix: 0.78, output: 0.78, driveLog: true } },
        { id: 'cw-filter', type: 'filter', x: 580, y: 110, state: { cutoff: 900, res: 9, type: 'lowpass', cutoffLog: true } },
        { id: 'cw-lfo', type: 'lfo', x: 320, y: 330, state: { rate: 2.6, depth: 0.45, type: 'triangle' } }
      ],
      connections: [
        { sourceModuleId: 'cw-osc', targetModuleId: 'cw-dist', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'cw-dist', targetModuleId: 'cw-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'cw-lfo', targetModuleId: 'cw-filter', sourcePortId: 'audio', targetPortId: 'cutoff' },
        { sourceModuleId: 'cw-filter', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  },
  {
    name: 'Soft Ambient Keys',
    tags: ['base', 'classic', 'ambient'],
    patch: {
      modules: [
        { id: 'sak-osc1', type: 'oscillator', x: 90, y: 80, state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sine', freqLog: false } },
        { id: 'sak-osc2', type: 'oscillator', x: 90, y: 280, state: { octave: 0, semitone: 7, cents: 3, mode: 'pitch', type: 'triangle', freqLog: false } },
        { id: 'sak-filter', type: 'filter', x: 340, y: 170, state: { cutoff: 1200, res: 0.8, type: 'lowpass', cutoffLog: true } },
        { id: 'sak-gain', type: 'gain', x: 600, y: 170, state: { level: 0.0 } },
        { id: 'sak-adsr', type: 'adsr', x: 330, y: 420, state: { attack: 0.9, decay: 0.8, sustain: 0.7, release: 2.3 } },
        { id: 'sak-delay', type: 'delay', x: 860, y: 170, state: { time: 0.62, feedback: 0.65, mix: 0.45 } }
      ],
      connections: [
        { sourceModuleId: 'sak-osc1', targetModuleId: 'sak-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'sak-osc2', targetModuleId: 'sak-filter', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'sak-filter', targetModuleId: 'sak-gain', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'sak-adsr', targetModuleId: 'sak-gain', sourcePortId: 'audio', targetPortId: 'level' },
        { sourceModuleId: 'sak-gain', targetModuleId: 'sak-delay', sourcePortId: 'audio', targetPortId: 'audio' },
        { sourceModuleId: 'sak-delay', targetModuleId: 'master', sourcePortId: 'audio', targetPortId: 'audio' }
      ]
    }
  }
];

const PRESET_MODIFIERS: PresetModifier[] = [
  {
    name: 'Slow Wobble',
    constraints: { requiresTypes: ['filter'] },
    apply: (base) => {
      const patch = clonePatch(base);
      const filter = firstModuleOfType(patch, 'filter');
      if (!filter) {
        return patch;
      }

      const addon: PatchState = {
        modules: [
          {
            id: 'mod-slow-wobble-lfo',
            type: 'lfo',
            x: Math.max(80, filter.x - 210),
            y: filter.y + 220,
            state: { rate: 0.45, depth: 0.32, type: 'sine' }
          }
        ],
        connections: [
          {
            sourceModuleId: 'mod-slow-wobble-lfo',
            targetModuleId: filter.id,
            sourcePortId: 'audio',
            targetPortId: 'cutoff'
          }
        ]
      };

      return mergePatch(patch, addon, 'Slow Wobble merge');
    }
  },
  {
    name: 'Wide Echo',
    apply: (base) => {
      const patch = clonePatch(base);
      const route = findFirstAudioRouteToMaster(patch);
      if (!route) {
        return patch;
      }

      const sourceModule = patch.modules.find((m) => m.id === route.sourceModuleId);
      const delayX = sourceModule ? sourceModule.x + 260 : 900;
      const delayY = sourceModule ? sourceModule.y : 180;

      patch.connections = patch.connections.filter((c) => c !== route);

      const addon: PatchState = {
        modules: [
          {
            id: 'mod-wide-echo-delay',
            type: 'delay',
            x: delayX,
            y: delayY,
            state: { time: 0.36, feedback: 0.52, mix: 0.38 }
          }
        ],
        connections: [
          {
            sourceModuleId: route.sourceModuleId,
            targetModuleId: 'mod-wide-echo-delay',
            sourcePortId: 'audio',
            targetPortId: 'audio'
          },
          {
            sourceModuleId: 'mod-wide-echo-delay',
            targetModuleId: 'master',
            sourcePortId: 'audio',
            targetPortId: 'audio'
          }
        ]
      };

      return mergePatch(patch, addon, 'Wide Echo merge');
    }
  },
  {
    name: 'Drive Boost',
    apply: (base) => {
      const patch = clonePatch(base);
      const existingDist = firstModuleOfType(patch, 'distortion');
      if (existingDist) {
        const drive = Math.min(20, Math.max(0.5, Number(existingDist.state.drive || 1) * 1.6));
        existingDist.state.drive = drive;
        existingDist.state.mix = Math.min(1, Math.max(0, Number(existingDist.state.mix ?? 0.7)));
        return patch;
      }

      const route = findFirstAudioRouteToMaster(patch);
      if (!route) {
        return patch;
      }

      patch.connections = patch.connections.filter((c) => c !== route);

      const sourceModule = patch.modules.find((m) => m.id === route.sourceModuleId);

      const addon: PatchState = {
        modules: [
          {
            id: 'mod-drive-boost-dist',
            type: 'distortion',
            x: sourceModule ? sourceModule.x + 250 : 700,
            y: sourceModule ? sourceModule.y : 180,
            state: { drive: 7.5, mix: 0.82, output: 0.84, driveLog: true }
          }
        ],
        connections: [
          {
            sourceModuleId: route.sourceModuleId,
            targetModuleId: 'mod-drive-boost-dist',
            sourcePortId: 'audio',
            targetPortId: 'audio'
          },
          {
            sourceModuleId: 'mod-drive-boost-dist',
            targetModuleId: 'master',
            sourcePortId: 'audio',
            targetPortId: 'audio'
          }
        ]
      };

      return mergePatch(patch, addon, 'Drive Boost merge');
    }
  },
  {
    name: 'Envelope Pump',
    apply: (base) => {
      const patch = clonePatch(base);

      let gain = firstModuleOfType(patch, 'gain');
      const route = findFirstAudioRouteToMaster(patch);
      if (!route) {
        return patch;
      }

      if (!gain) {
        patch.connections = patch.connections.filter((c) => c !== route);
        const sourceModule = patch.modules.find((m) => m.id === route.sourceModuleId);
        const newGainId = 'mod-envelope-pump-gain';

        patch.modules.push({
          id: newGainId,
          type: 'gain',
          x: sourceModule ? sourceModule.x + 240 : 760,
          y: sourceModule ? sourceModule.y : 200,
          state: { level: 0 }
        });

        patch.connections.push(
          {
            sourceModuleId: route.sourceModuleId,
            targetModuleId: newGainId,
            sourcePortId: 'audio',
            targetPortId: 'audio'
          },
          {
            sourceModuleId: newGainId,
            targetModuleId: 'master',
            sourcePortId: 'audio',
            targetPortId: 'audio'
          }
        );

        gain = patch.modules.find((m) => m.id === newGainId);
      }

      if (!gain) {
        return patch;
      }

      const hasEnvToGain = patch.connections.some(
        (c) => c.targetModuleId === gain!.id && c.targetPortId === 'level' && hasType({ modules: patch.modules.filter((m) => m.id === c.sourceModuleId), connections: [] }, 'adsr')
      );

      if (hasEnvToGain) {
        return patch;
      }

      const addon: PatchState = {
        modules: [
          {
            id: 'mod-envelope-pump-adsr',
            type: 'adsr',
            x: gain.x - 220,
            y: gain.y + 220,
            state: { attack: 0.005, decay: 0.14, sustain: 0.0, release: 0.11 }
          }
        ],
        connections: [
          {
            sourceModuleId: 'mod-envelope-pump-adsr',
            targetModuleId: gain.id,
            sourcePortId: 'audio',
            targetPortId: 'level'
          }
        ]
      };

      return mergePatch(patch, addon, 'Envelope Pump merge');
    }
  }
];

const PRESET_MODIFIER_MAP = new Map(PRESET_MODIFIERS.map((m) => [m.name, m]));
const BASE_PRESET_MAP = new Map(BASE_PRESETS.map((p) => [p.name, p]));

function getBase(name: string): PresetDef {
  const found = BASE_PRESET_MAP.get(name);
  if (!found) {
    throw new Error(`Missing base preset: ${name}`);
  }
  return found;
}

function getModifier(name: string): PresetModifier {
  const found = PRESET_MODIFIER_MAP.get(name);
  if (!found) {
    throw new Error(`Missing modifier: ${name}`);
  }
  return found;
}

const COMPOSED_PRESETS: PresetDef[] = [
  composePreset(getBase('Acid Drive'), getModifier('Slow Wobble'), 'Acid Drive + Slow Wobble'),
  composePreset(getBase('Acid Drive'), getModifier('Envelope Pump'), 'Acid Drive + Envelope Pump'),
  composePreset(getBase('Classic Pluck'), getModifier('Wide Echo'), 'Classic Pluck + Wide Echo'),
  composePreset(getBase('Classic Pluck'), getModifier('Drive Boost'), 'Classic Pluck + Drive Boost'),
  composePreset(getBase('Sub Bass'), getModifier('Drive Boost'), 'Sub Bass + Drive Boost'),
  composePreset(getBase('Sub Bass'), getModifier('Slow Wobble'), 'Sub Bass + Slow Wobble'),
  composePreset(getBase('Dub Chord Echo'), getModifier('Slow Wobble'), 'Dub Chord Echo + Slow Wobble'),
  composePreset(getBase('Classic Mono Lead'), getModifier('Slow Wobble'), 'Classic Mono Lead + Slow Wobble'),
  composePreset(getBase('Soft Ambient Keys'), getModifier('Drive Boost'), 'Soft Ambient Keys + Drive Boost'),
  composePreset(getBase('Electro FM Bell'), getModifier('Wide Echo'), 'Electro FM Bell + Wide Echo')
];

const ALL_PRESETS: PresetDef[] = [...BASE_PRESETS, ...COMPOSED_PRESETS];

for (const p of ALL_PRESETS) {
  validatePatch(p.patch, p.name);
}

const seenKeys = new Set<string>();
for (const p of ALL_PRESETS) {
  const key = slugify(p.name);
  if (seenKeys.has(key)) {
    throw new Error(`Duplicate preset key generated: ${key}`);
  }
  seenKeys.add(key);
}

export const PRESET_ORDER: string[] = ALL_PRESETS.map((p) => slugify(p.name));

export const PRESET_LABELS: Record<string, string> = Object.fromEntries(
  ALL_PRESETS.map((p) => [slugify(p.name), p.name])
);

export const PRESETS: Record<string, string> = Object.fromEntries(
  ALL_PRESETS.map((p) => [slugify(p.name), JSON.stringify(p.patch)])
);
