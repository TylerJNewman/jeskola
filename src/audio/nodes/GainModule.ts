import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';

export class GainModule extends ModularNode {
  private gain: GainNode;

  constructor() {
    super('Gain');
    const ctx = audioEngine.getContext();
    
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.5;
    
    this.inputNode = this.gain;
    this.outputNode = this.gain;

    this.params.set('level', this.gain.gain);
  }

  public setGain(val: number): void {
    const ctx = audioEngine.getContext();
    this.gain.gain.setTargetAtTime(val, ctx.currentTime, 0.05);
  }

  public override pushStateToAudio(): void {
    const s = this._state;
    if (typeof s.level === 'number') {
      this.gain.gain.setValueAtTime(s.level, audioEngine.getContext().currentTime);
    }
  }

  public override destroy(): void {
    this.gain.disconnect();
    super.destroy();
  }
}
