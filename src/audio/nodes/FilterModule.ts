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
    
    // Scale incoming CV by 2000Hz for Cutoff
    this.cutoffMod = ctx.createGain();
    this.cutoffMod.gain.value = 2000;
    this.cutoffMod.connect(this.filter.frequency);

    // Scale incoming CV by 10 for Resonance
    this.resMod = ctx.createGain();
    this.resMod.gain.value = 10;
    this.resMod.connect(this.filter.Q);
    
    this.params.set('cutoff', this.cutoffMod);
    this.params.set('res', this.resMod);
  }

  public setFrequency(val: number): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
    this.filter.frequency.setTargetAtTime(val, now, 0.05);
  }

  public setResonance(val: number): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    this.filter.Q.cancelScheduledValues(now);
    this.filter.Q.setValueAtTime(this.filter.Q.value, now);
    this.filter.Q.setTargetAtTime(val, now, 0.05);
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
