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

export type StackedPresetResult = {
  key: string;
  label: string;
  json: string;
};

type RecipeModuleStateOverride = {
  moduleId: string;
  state: Record<string, any>;
};

type RecipeDef = {
  name: string;
  description: string;
  baseKey: string;
  modifierKeys: string[];
  moduleStateOverrides?: RecipeModuleStateOverride[];
  morph?: {
    label: string;
    moduleStateAtMax: RecipeModuleStateOverride[];
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

function parsePatchJson(json: string): PatchState {
  return JSON.parse(json) as PatchState;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
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

export const STACK_BASE_ORDER: string[] = BASE_PRESETS.map((p) => slugify(p.name));
export const STACK_BASE_LABELS: Record<string, string> = Object.fromEntries(
  BASE_PRESETS.map((p) => [slugify(p.name), p.name])
);
export const STACK_MODIFIER_ORDER: string[] = PRESET_MODIFIERS.map((m) => slugify(m.name));
export const STACK_MODIFIER_LABELS: Record<string, string> = Object.fromEntries(
  PRESET_MODIFIERS.map((m) => [slugify(m.name), m.name])
);

function getBaseByKey(baseKey: string): PresetDef {
  const baseLabel = STACK_BASE_LABELS[baseKey];
  if (!baseLabel) {
    throw new Error(`Unknown base preset key: ${baseKey}`);
  }

  return getBase(baseLabel);
}

function getModifierByKey(modifierKey: string): PresetModifier {
  const modifierLabel = STACK_MODIFIER_LABELS[modifierKey];
  if (!modifierLabel) {
    throw new Error(`Unknown modifier key: ${modifierKey}`);
  }

  return getModifier(modifierLabel);
}

export function buildStackedPreset(baseKey: string, modifierKeys: string[]): StackedPresetResult {
  const basePreset = getBaseByKey(baseKey);
  const seenKeys = new Set<string>();
  const modifierDefs: PresetModifier[] = [];

  for (const modifierKey of modifierKeys) {
    if (seenKeys.has(modifierKey)) {
      throw new Error(`Duplicate modifier in stack: ${modifierKey}`);
    }
    seenKeys.add(modifierKey);
    modifierDefs.push(getModifierByKey(modifierKey));
  }

  let stackedPreset: PresetDef = {
    name: basePreset.name,
    patch: clonePatch(basePreset.patch),
    tags: [...(basePreset.tags || [])]
  };

  for (const modifier of modifierDefs) {
    const nextName = `${stackedPreset.name} + ${modifier.name}`;
    stackedPreset = composePreset(stackedPreset, modifier, nextName);
  }

  return {
    key: slugify(stackedPreset.name),
    label: stackedPreset.name,
    json: JSON.stringify(stackedPreset.patch)
  };
}

function applyModuleStateOverrides(base: PatchState, overrides: RecipeModuleStateOverride[], label: string): PatchState {
  const patch = clonePatch(base);

  for (const override of overrides) {
    const mod = patch.modules.find((m) => m.id === override.moduleId);
    if (!mod) {
      throw new Error(`${label}: unknown module for override ${override.moduleId}`);
    }

    mod.state = {
      ...mod.state,
      ...override.state
    };
  }

  validatePatch(patch, label);
  return patch;
}

function applyRecipeMorph(base: PatchState, atMax: RecipeModuleStateOverride[], amount: number, label: string): PatchState {
  const patch = clonePatch(base);
  const t = clamp01(amount);
  if (t <= 0) return patch;

  for (const target of atMax) {
    const mod = patch.modules.find((m) => m.id === target.moduleId);
    if (!mod) {
      throw new Error(`${label}: unknown morph module ${target.moduleId}`);
    }

    for (const [key, targetValue] of Object.entries(target.state)) {
      const currentValue = (mod.state as Record<string, any>)[key];
      if (typeof currentValue === 'number' && typeof targetValue === 'number' && Number.isFinite(currentValue) && Number.isFinite(targetValue)) {
        (mod.state as Record<string, any>)[key] = currentValue + (targetValue - currentValue) * t;
      } else if (t >= 0.5) {
        (mod.state as Record<string, any>)[key] = targetValue;
      }
    }
  }

  validatePatch(patch, label);
  return patch;
}

const RECIPE_DEFS: RecipeDef[] = [
  {
    name: 'Classic Acid Bassline',
    description: 'Subtractive acid voice with envelope pump on amp and high-resonance filter drive.',
    baseKey: 'acid-drive',
    modifierKeys: ['envelope-pump'],
    moduleStateOverrides: [
      { moduleId: 'drive-osc', state: { octave: -1, semitone: 0, cents: 0, mode: 'pitch', type: 'sawtooth' } },
      { moduleId: 'drive-dist', state: { drive: 8.4, mix: 0.72, output: 0.76, driveLog: true } },
      { moduleId: 'drive-filter', state: { cutoff: 420, res: 12.4, type: 'lowpass', cutoffLog: true } },
      { moduleId: 'mod-envelope-pump-gain', state: { level: 0 } },
      { moduleId: 'mod-envelope-pump-adsr', state: { attack: 0.005, decay: 0.16, sustain: 0.03, release: 0.1 } }
    ],
    morph: {
      label: 'Acid Intensity',
      moduleStateAtMax: [
        { moduleId: 'drive-dist', state: { drive: 12.5, mix: 0.84, output: 0.72 } },
        { moduleId: 'drive-filter', state: { cutoff: 980, res: 15.5 } },
        { moduleId: 'mod-envelope-pump-adsr', state: { decay: 0.22, sustain: 0.08, release: 0.14 } }
      ]
    }
  },
  {
    name: 'Dub Techno Chord Bus',
    description: 'Chord stack into delay with gentle modulation and post-delay saturation for classic dub space.',
    baseKey: 'dub-chord-echo',
    modifierKeys: ['slow-wobble', 'drive-boost'],
    moduleStateOverrides: [
      { moduleId: 'dub-osc1', state: { octave: -1, semitone: 0, cents: 0, mode: 'pitch', type: 'triangle' } },
      { moduleId: 'dub-osc2', state: { octave: 0, semitone: 7, cents: 0, mode: 'pitch', type: 'triangle' } },
      { moduleId: 'dub-filter', state: { cutoff: 720, res: 2.6, type: 'lowpass', cutoffLog: true } },
      { moduleId: 'dub-delay', state: { time: 0.56, feedback: 0.78, mix: 0.68 } },
      { moduleId: 'mod-slow-wobble-lfo', state: { rate: 0.28, depth: 0.2, type: 'sine' } },
      { moduleId: 'mod-drive-boost-dist', state: { drive: 2.6, mix: 0.32, output: 0.9, driveLog: true } }
    ],
    morph: {
      label: 'Dub Space',
      moduleStateAtMax: [
        { moduleId: 'dub-delay', state: { time: 0.68, feedback: 0.86, mix: 0.76 } },
        { moduleId: 'mod-drive-boost-dist', state: { drive: 3.8, mix: 0.44 } },
        { moduleId: 'mod-slow-wobble-lfo', state: { depth: 0.28 } }
      ]
    }
  },
  {
    name: 'Subtractive Mono Lead',
    description: 'Classic mono lead chain with expressive envelope gating and subtle LFO filter movement.',
    baseKey: 'classic-mono-lead',
    modifierKeys: ['envelope-pump', 'slow-wobble'],
    moduleStateOverrides: [
      { moduleId: 'mono-osc', state: { octave: 0, semitone: 0, cents: 0, mode: 'pitch', type: 'sawtooth' } },
      { moduleId: 'mono-dist', state: { drive: 5.4, mix: 0.67, output: 0.85, driveLog: true } },
      { moduleId: 'mono-filter', state: { cutoff: 1850, res: 4.3, type: 'lowpass', cutoffLog: true } },
      { moduleId: 'mono-gain', state: { level: 0 } },
      { moduleId: 'mono-delay', state: { time: 0.19, feedback: 0.22, mix: 0.18 } },
      { moduleId: 'mod-envelope-pump-adsr', state: { attack: 0.01, decay: 0.22, sustain: 0.15, release: 0.12 } },
      { moduleId: 'mod-slow-wobble-lfo', state: { rate: 4.2, depth: 0.2, type: 'triangle' } }
    ],
    morph: {
      label: 'Lead Bite',
      moduleStateAtMax: [
        { moduleId: 'mono-dist', state: { drive: 8.8, mix: 0.82 } },
        { moduleId: 'mono-filter', state: { cutoff: 2600, res: 6.6 } },
        { moduleId: 'mod-slow-wobble-lfo', state: { rate: 6.5, depth: 0.3 } },
        { moduleId: 'mod-envelope-pump-adsr', state: { attack: 0.005, decay: 0.15, sustain: 0.1 } }
      ]
    }
  },
  {
    name: 'Evolving Ambient Pad',
    description: 'Long-envelope pad with slow filter drift and deep feedback delay for evolving ambience.',
    baseKey: 'soft-ambient-keys',
    modifierKeys: ['slow-wobble'],
    moduleStateOverrides: [
      { moduleId: 'sak-filter', state: { cutoff: 980, res: 1.3, type: 'lowpass', cutoffLog: true } },
      { moduleId: 'sak-gain', state: { level: 0 } },
      { moduleId: 'sak-adsr', state: { attack: 2.4, decay: 1.8, sustain: 0.78, release: 3.8 } },
      { moduleId: 'sak-delay', state: { time: 0.72, feedback: 0.74, mix: 0.5 } },
      { moduleId: 'mod-slow-wobble-lfo', state: { rate: 0.09, depth: 0.22, type: 'sine' } }
    ],
    morph: {
      label: 'Pad Motion',
      moduleStateAtMax: [
        { moduleId: 'sak-filter', state: { cutoff: 2100, res: 2.1 } },
        { moduleId: 'sak-delay', state: { time: 0.86, feedback: 0.83, mix: 0.66 } },
        { moduleId: 'mod-slow-wobble-lfo', state: { rate: 0.18, depth: 0.35 } }
      ]
    }
  },
  {
    name: 'FM Bell Atmosphere',
    description: 'Two-operator FM bell tone routed into echo for spacious metallic plucks.',
    baseKey: 'electro-fm-bell',
    modifierKeys: ['wide-echo'],
    moduleStateOverrides: [
      { moduleId: 'bell-mod', state: { freq: 240, mode: 'freq', type: 'sine', freqLog: true } },
      { moduleId: 'bell-carrier', state: { octave: 1, semitone: 0, cents: 3, mode: 'pitch', type: 'sine' } },
      { moduleId: 'bell-filter', state: { cutoff: 2800, res: 1, type: 'bandpass', cutoffLog: true } },
      { moduleId: 'mod-wide-echo-delay', state: { time: 0.42, feedback: 0.58, mix: 0.35 } }
    ],
    morph: {
      label: 'Bell Width',
      moduleStateAtMax: [
        { moduleId: 'bell-mod', state: { freq: 380 } },
        { moduleId: 'bell-filter', state: { cutoff: 4200, res: 1.6 } },
        { moduleId: 'mod-wide-echo-delay', state: { time: 0.58, feedback: 0.72, mix: 0.5 } }
      ]
    }
  },
  {
    name: 'Sub Pressure Wobble',
    description: 'Low-end foundation with controlled drive and tempo-friendly filter wobble.',
    baseKey: 'sub-bass',
    modifierKeys: ['drive-boost', 'slow-wobble'],
    moduleStateOverrides: [
      { moduleId: 'sub-osc1', state: { octave: -2, semitone: 0, cents: 0, mode: 'pitch', type: 'square' } },
      { moduleId: 'sub-osc2', state: { octave: -1, semitone: 0, cents: 6, mode: 'pitch', type: 'sawtooth' } },
      { moduleId: 'sub-filter', state: { cutoff: 230, res: 7.2, type: 'lowpass', cutoffLog: true } },
      { moduleId: 'mod-drive-boost-dist', state: { drive: 4.8, mix: 0.62, output: 0.84, driveLog: true } },
      { moduleId: 'mod-slow-wobble-lfo', state: { rate: 1.8, depth: 0.26, type: 'triangle' } }
    ],
    morph: {
      label: 'Wobble Pressure',
      moduleStateAtMax: [
        { moduleId: 'mod-drive-boost-dist', state: { drive: 7.6, mix: 0.74, output: 0.8 } },
        { moduleId: 'sub-filter', state: { cutoff: 480, res: 10.8 } },
        { moduleId: 'mod-slow-wobble-lfo', state: { rate: 3.2, depth: 0.4 } }
      ]
    }
  }
];

const RECIPE_MAP = new Map(RECIPE_DEFS.map((r) => [slugify(r.name), r]));

function buildRecipeJson(recipeDef: RecipeDef, morphAmount: number = 0): string {
  const stacked = buildStackedPreset(recipeDef.baseKey, recipeDef.modifierKeys);
  let patch = parsePatchJson(stacked.json);
  if (recipeDef.moduleStateOverrides && recipeDef.moduleStateOverrides.length > 0) {
    patch = applyModuleStateOverrides(
      patch,
      recipeDef.moduleStateOverrides,
      `${recipeDef.name} overrides`
    );
  }
  if (recipeDef.morph?.moduleStateAtMax?.length) {
    patch = applyRecipeMorph(
      patch,
      recipeDef.morph.moduleStateAtMax,
      morphAmount,
      `${recipeDef.name} morph`
    );
  }
  return JSON.stringify(patch);
}

const recipeResults = RECIPE_DEFS.map((recipeDef) => ({
  key: slugify(recipeDef.name),
  label: recipeDef.name,
  description: recipeDef.description,
  json: buildRecipeJson(recipeDef)
}));

const recipeKeySet = new Set<string>();
for (const recipe of recipeResults) {
  if (recipeKeySet.has(recipe.key)) {
    throw new Error(`Duplicate recipe key generated: ${recipe.key}`);
  }
  recipeKeySet.add(recipe.key);
}

export const RECIPE_ORDER: string[] = recipeResults.map((r) => r.key);
export const RECIPE_LABELS: Record<string, string> = Object.fromEntries(
  recipeResults.map((r) => [r.key, r.label])
);
export const RECIPE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  recipeResults.map((r) => [r.key, r.description])
);
export const RECIPES: Record<string, string> = Object.fromEntries(
  recipeResults.map((r) => [r.key, r.json])
);
export const RECIPE_MORPH_LABELS: Record<string, string> = Object.fromEntries(
  RECIPE_DEFS.map((r) => [slugify(r.name), r.morph?.label || 'Morph'])
);

export function buildRecipePreset(recipeKey: string, morphAmount: number = 0): StackedPresetResult {
  const recipeDef = RECIPE_MAP.get(recipeKey);
  if (!recipeDef) {
    throw new Error(`Unknown recipe key: ${recipeKey}`);
  }

  return {
    key: recipeKey,
    label: recipeDef.name,
    json: buildRecipeJson(recipeDef, morphAmount)
  };
}
