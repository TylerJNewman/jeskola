import { audioEngine } from '../AudioEngine';
import { midiToCv } from '../sequencer/types';
import { ModularNode } from './ModularNode';

const MIN_OCTAVE = -2;
const MAX_OCTAVE = 3;
const MIN_MIDI = 0;
const MAX_MIDI = 127;
const RAMP_TIME = 0.005;

export class KeyboardModule extends ModularNode {
  private noteCV: ConstantSourceNode;
  private gateCV: ConstantSourceNode;
  private currentNoteCv = 0;
  private currentGate = 0;

  constructor() {
    super('keyboard');
    const ctx = audioEngine.getContext();

    this.noteCV = ctx.createConstantSource();
    this.noteCV.offset.value = 0;
    this.noteCV.start();

    this.gateCV = ctx.createConstantSource();
    this.gateCV.offset.value = 0;
    this.gateCV.start();

    this.inputNode = null;
    this.outputNode = this.noteCV;
    this.params.set('gate', this.gateCV);

    this._state = {
      octaveOffset: 0,
      baseMidi: 60,
      enabled: true
    };
  }

  public get octaveOffset(): number {
    return this._state.octaveOffset;
  }

  public setOctaveOffset(val: number): void {
    this._state.octaveOffset = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, Math.round(val)));
  }

  public adjustOctave(delta: number): number {
    this.setOctaveOffset(this.octaveOffset + delta);
    return this.octaveOffset;
  }

  public get baseMidi(): number {
    return this._state.baseMidi;
  }

  public get enabled(): boolean {
    return !!this._state.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this._state.enabled = !!enabled;
  }

  public noteOn(midi: number, time: number = audioEngine.getContext().currentTime): void {
    const safeMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, Math.round(midi)));
    const cv = midiToCv(safeMidi);
    this.currentNoteCv = cv;
    this.currentGate = 1;

    this.noteCV.offset.cancelScheduledValues(time);
    this.noteCV.offset.setValueAtTime(this.noteCV.offset.value, time);
    this.noteCV.offset.linearRampToValueAtTime(cv, time + RAMP_TIME);

    this.gateCV.offset.cancelScheduledValues(time);
    this.gateCV.offset.setValueAtTime(this.gateCV.offset.value, time);
    this.gateCV.offset.linearRampToValueAtTime(1, time + RAMP_TIME);
  }

  public noteOff(time: number = audioEngine.getContext().currentTime): void {
    this.currentGate = 0;
    this.gateCV.offset.cancelScheduledValues(time);
    this.gateCV.offset.setValueAtTime(this.gateCV.offset.value, time);
    this.gateCV.offset.linearRampToValueAtTime(0, time + RAMP_TIME);
  }

  public override getOutputForPort(portId: string): AudioNode | null {
    if (portId === 'gate') return this.gateCV;
    if (!portId || portId === 'audio') return this.noteCV;
    return this.noteCV;
  }

  public getDebugValues(): { noteCv: number; gate: number } {
    return {
      noteCv: this.currentNoteCv,
      gate: this.currentGate
    };
  }

  public override get state(): Record<string, any> {
    return {
      octaveOffset: this.octaveOffset,
      baseMidi: this.baseMidi,
      enabled: this.enabled
    };
  }

  public override set state(s: Record<string, any>) {
    const octave = typeof s.octaveOffset === 'number' ? s.octaveOffset : 0;
    const baseMidi = typeof s.baseMidi === 'number' ? s.baseMidi : 60;
    const enabled = typeof s.enabled === 'boolean' ? s.enabled : true;

    this.setOctaveOffset(octave);
    this._state.baseMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, Math.round(baseMidi)));
    this._state.enabled = enabled;
  }

  public override destroy(): void {
    this.noteCV.stop();
    this.noteCV.disconnect();
    this.gateCV.stop();
    this.gateCV.disconnect();
    super.destroy();
  }
}
