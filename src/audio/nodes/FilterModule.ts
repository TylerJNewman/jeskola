import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';
import { createSmoothCV } from '../AudioUtils';
import type { SmoothCV } from '../AudioUtils';

export class FilterModule extends ModularNode {
  private filter: BiquadFilterNode;
  private cutoffMod: GainNode;
  private resMod: GainNode;
  
  private smoothCutoff: SmoothCV;
  private smoothRes: SmoothCV;

  constructor() {
    super('Filter');
    const ctx = audioEngine.getContext();
    
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    
    // Base values are 0 because the SmoothCV will drive them entirely
    this.filter.frequency.value = 0;
    this.filter.Q.value = 0;
    
    // Setup SmoothCV slew limiters (15Hz organic glide)
    this.smoothCutoff = createSmoothCV(1000, 15);
    this.smoothCutoff.node.connect(this.filter.frequency);
    
    this.smoothRes = createSmoothCV(1, 15);
    this.smoothRes.node.connect(this.filter.Q);

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
    this.smoothCutoff.setValue(val);
  }

  public setResonance(val: number): void {
    this.smoothRes.setValue(val);
  }

  public setType(type: BiquadFilterType): void {
    this.filter.type = type;
  }
  
  public override destroy(): void {
    this.smoothCutoff.destroy();
    this.smoothRes.destroy();
    this.cutoffMod.disconnect();
    this.resMod.disconnect();
    this.filter.disconnect();
    super.destroy();
  }
}
