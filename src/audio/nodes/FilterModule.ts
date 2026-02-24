import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';

export class FilterModule extends ModularNode {
  private filter: BiquadFilterNode;

  constructor() {
    super('Filter');
    const ctx = audioEngine.getContext();
    
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1000;
    this.filter.Q.value = 1;
    
    this.inputNode = this.filter;
    this.outputNode = this.filter;
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
    this.filter.disconnect();
    super.destroy();
  }
}
