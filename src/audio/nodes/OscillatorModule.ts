import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';

export class OscillatorModule extends ModularNode {
  private osc: OscillatorNode;
  private gain: GainNode;
  private cvPitchMod: GainNode;

  private baseFreq: number = 440;
  private octave: number = 0;
  private semitone: number = 0;
  private cents: number = 0;

  constructor() {
    super('Oscillator');
    const ctx = audioEngine.getContext();
    
    // Internal routing: Oscillator -> Gain -> Output out of module
    this.osc = ctx.createOscillator();
    this.gain = ctx.createGain();
    
    this.osc.type = 'sine';
    this.osc.frequency.value = 440;
    
    this.gain.gain.value = 0.5;
    
    this.osc.connect(this.gain);
    
    // Export nodes
    // Generators usually don't have inputs for audio (except maybe CV/FM later)
    this.inputNode = null; 
    this.outputNode = this.gain;
    
    // Scale incoming CV by 1200 cents for 1V/Octave standard modular tracking
    this.cvPitchMod = ctx.createGain();
    this.cvPitchMod.gain.value = 1200;
    this.cvPitchMod.connect(this.osc.detune);
    
    // Register CV inputs
    this.params.set('freq', this.cvPitchMod);
    this.params.set('gain', this.gain.gain);
  }

  private calculateFrequency() {
    const ctx = audioEngine.getContext();
    const finalFreq = this.baseFreq * Math.pow(2, this.octave) * Math.pow(2, this.semitone / 12);
    // Smooth glide to new frequency
    this.osc.frequency.setTargetAtTime(finalFreq, ctx.currentTime, 0.05);
    // Smooth glide to new fine tune
    this.osc.detune.setTargetAtTime(this.cents, ctx.currentTime, 0.05);
  }

  public setOctave(val: number): void {
    this.octave = val;
    this.calculateFrequency();
  }

  public setSemitone(val: number): void {
    this.semitone = val;
    this.calculateFrequency();
  }

  public setCents(val: number): void {
    this.cents = val;
    this.calculateFrequency();
  }

  public setType(type: OscillatorType): void {
    this.osc.type = type;
  }

  public setVolume(val: number): void {
    const ctx = audioEngine.getContext();
    this.gain.gain.setTargetAtTime(val, ctx.currentTime, 0.05);
  }

  public start(): void {
    try {
      this.osc.start();
    } catch (e) {
      // already started
    }
  }

  public stop(): void {
    try {
      this.osc.stop();
    } catch (e) {
      // not started
    }
  }

  public override destroy(): void {
    this.stop();
    this.cvPitchMod.disconnect();
    this.osc.disconnect();
    this.gain.disconnect();
    super.destroy();
  }
}
