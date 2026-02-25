import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';

export class FilterModule extends ModularNode {
  private filter: BiquadFilterNode;
  private cutoffMod: GainNode;
  private resMod: GainNode;

  constructor() {
    super('Filter');
    const ctx = audioEngine.getContext();
    
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1000;
    this.filter.Q.value = 1;
    
    this.inputNode = this.filter;
    this.outputNode = this.filter;
    
    // Scale incoming CV exponentially via Detune (4800 cents = 4 octaves)
    this.cutoffMod = ctx.createGain();
    this.cutoffMod.gain.value = 4800;
    this.cutoffMod.connect(this.filter.detune);

    // Scale incoming CV by 10 for Resonance
    this.resMod = ctx.createGain();
    this.resMod.gain.value = 10;
    this.resMod.connect(this.filter.Q);
    
    this.params.set('cutoff', this.cutoffMod);
    this.params.set('res', this.resMod);
  }

  public setFrequency(val: number): void {
    const ctx = audioEngine.getContext();
    this.filter.frequency.setTargetAtTime(val, ctx.currentTime, 0.05);
  }

  public setResonance(val: number): void {
    const ctx = audioEngine.getContext();
    this.filter.Q.setTargetAtTime(val, ctx.currentTime, 0.05);
  }

  public setType(type: BiquadFilterType): void {
    this.filter.type = type;
  }
  
  public override destroy(): void {
    this.cutoffMod.disconnect();
    this.resMod.disconnect();
    this.filter.disconnect();
    super.destroy();
  }
}
