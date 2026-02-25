import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';
import { createSmoothCV } from '../AudioUtils';
import type { SmoothCV } from '../AudioUtils';

export class GainModule extends ModularNode {
  private gain: GainNode;
  private smoothLevel: SmoothCV;

  constructor() {
    super('Gain');
    const ctx = audioEngine.getContext();
    
    this.gain = ctx.createGain();
    this.gain.gain.value = 0; // Driven by smoothCV completely
    
    this.smoothLevel = createSmoothCV(0.5, 15);
    this.smoothLevel.node.connect(this.gain.gain);
    
    this.inputNode = this.gain;
    this.outputNode = this.gain;

    this.params.set('level', this.gain.gain);
  }

  public setGain(val: number): void {
    this.smoothLevel.setValue(val);
  }

  public override destroy(): void {
    this.smoothLevel.destroy();
    this.gain.disconnect();
    super.destroy();
  }
}
