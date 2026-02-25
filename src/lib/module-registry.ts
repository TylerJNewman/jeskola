import type { ModularNode } from '@/audio/nodes/ModularNode'
import { OscillatorModule } from '@/audio/nodes/OscillatorModule'
import { FilterModule } from '@/audio/nodes/FilterModule'
import { DelayModule } from '@/audio/nodes/DelayModule'
import { DistortionModule } from '@/audio/nodes/DistortionModule'
import { GainModule } from '@/audio/nodes/GainModule'
import { AdsrModule } from '@/audio/nodes/AdsrModule'
import { LfoModule } from '@/audio/nodes/LfoModule'
import { SequencerModule } from '@/audio/nodes/SequencerModule'
import { KeyboardModule } from '@/audio/nodes/KeyboardModule'
import { MasterNode } from '@/audio/nodes/MasterNode'

export type ModuleType =
  | 'oscillator'
  | 'filter'
  | 'delay'
  | 'distortion'
  | 'gain'
  | 'adsr'
  | 'lfo'
  | 'sequencer'
  | 'keyboard'

export const MODULE_LABELS: Record<ModuleType, string> = {
  oscillator: 'Oscillator',
  filter: 'Filter',
  delay: 'Delay',
  distortion: 'Distortion',
  gain: 'Gain',
  adsr: 'ADSR',
  lfo: 'LFO',
  sequencer: 'Sequencer',
  keyboard: 'Keyboard',
}

export const MODULE_TYPES: ModuleType[] = [
  'oscillator', 'filter', 'adsr', 'lfo', 'keyboard',
  'delay', 'distortion', 'gain', 'sequencer',
]

export const DEFAULT_STATES: Record<ModuleType, Record<string, unknown>> = {
  oscillator: { octave: 0, semitone: 0, cents: 0, freq: 440, type: 'sine', mode: 'pitch' },
  filter: { cutoff: 1000, res: 1, type: 'lowpass' },
  delay: { time: 0.4, feedback: 0.4, mix: 0.5 },
  distortion: { drive: 1.0, mix: 0.5, output: 0.8 },
  gain: { level: 0.5 },
  adsr: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.5 },
  lfo: { rate: 1.0, depth: 0.5, type: 'sine' },
  sequencer: {},
  keyboard: { octaveOffset: 0, baseMidi: 60, enabled: true },
}

export function createAudioNode(type: ModuleType): ModularNode {
  switch (type) {
    case 'oscillator': return new OscillatorModule()
    case 'filter': return new FilterModule()
    case 'delay': return new DelayModule()
    case 'distortion': return new DistortionModule()
    case 'gain': return new GainModule()
    case 'adsr': return new AdsrModule()
    case 'lfo': return new LfoModule()
    case 'sequencer': return new SequencerModule()
    case 'keyboard': return new KeyboardModule()
    default: throw new Error(`Unknown module type: ${type}`)
  }
}

export function createMasterNode(): MasterNode {
  const master = new MasterNode()
  master.id = 'master'
  return master
}

export function startModuleIfNeeded(node: ModularNode): void {
  if (node instanceof OscillatorModule) node.start()
  if (node instanceof LfoModule) node.start()
}

export type PortDef = {
  id: string
  label: string
  type: 'audio' | 'cv' | 'gate'
}

export type ModulePortConfig = {
  inputs: PortDef[]
  outputs: PortDef[]
}

export const MODULE_PORTS: Record<ModuleType | 'master', ModulePortConfig> = {
  oscillator: {
    inputs: [
      { id: 'freq', label: '1V/OCT', type: 'cv' },
      { id: 'gain', label: 'GAIN', type: 'cv' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'audio' },
    ],
  },
  filter: {
    inputs: [
      { id: 'audio', label: 'IN', type: 'audio' },
      { id: 'cutoff', label: 'CV CUT', type: 'cv' },
      { id: 'res', label: 'CV RES', type: 'cv' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'audio' },
    ],
  },
  delay: {
    inputs: [
      { id: 'audio', label: 'IN', type: 'audio' },
      { id: 'time', label: 'TIME', type: 'cv' },
      { id: 'feedback', label: 'FB', type: 'cv' },
      { id: 'mix', label: 'MIX', type: 'cv' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'audio' },
    ],
  },
  distortion: {
    inputs: [
      { id: 'audio', label: 'IN', type: 'audio' },
      { id: 'drive', label: 'DRIVE', type: 'cv' },
      { id: 'mix', label: 'MIX', type: 'cv' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'audio' },
    ],
  },
  gain: {
    inputs: [
      { id: 'audio', label: 'IN', type: 'audio' },
      { id: 'level', label: 'LEVEL', type: 'cv' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'audio' },
    ],
  },
  adsr: {
    inputs: [
      { id: 'gate', label: 'GATE', type: 'gate' },
    ],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'cv' },
    ],
  },
  lfo: {
    inputs: [],
    outputs: [
      { id: 'audio', label: 'OUT', type: 'cv' },
    ],
  },
  sequencer: {
    inputs: [],
    outputs: [
      { id: 'audio', label: 'NOTE', type: 'cv' },
      { id: 'gate', label: 'GATE', type: 'gate' },
    ],
  },
  keyboard: {
    inputs: [],
    outputs: [
      { id: 'audio', label: 'NOTE', type: 'cv' },
      { id: 'gate', label: 'GATE', type: 'gate' },
    ],
  },
  master: {
    inputs: [
      { id: 'audio', label: 'IN', type: 'audio' },
    ],
    outputs: [],
  },
}
