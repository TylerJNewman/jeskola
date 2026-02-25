import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';

export class LfoModule extends ModularNode {
  private oscillator: OscillatorNode;
  private depthGain: GainNode;

  constructor() {
    super('LFO');
    const ctx = audioEngine.getContext();
    
    // Core oscillator
    this.oscillator = ctx.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = 1.0; // 1 Hz default
    
    // Depth control (0.0 to 1.0)
    // The oscillator natively outputs -1 to +1. 
    // This gain scales that output directly.
    this.depthGain = ctx.createGain();
    this.depthGain.gain.value = 0.5;

    // Route
    this.oscillator.connect(this.depthGain);
    
    // An LFO has no audio inputs, only CV output
    this.inputNode = null; 
    this.outputNode = this.depthGain;
    
    this._state = {
      rate: 1.0,     // Hz
      depth: 0.5,    // 0 to 1
      type: 'sine'
    };
  }

  public setRate(val: number): void {
    const ctx = audioEngine.getContext();
    this.oscillator.frequency.setTargetAtTime(val, ctx.currentTime, 0.05);
  }

  public setDepth(val: number): void {
    const ctx = audioEngine.getContext();
    this.depthGain.gain.setTargetAtTime(val, ctx.currentTime, 0.05);
  }

  public setType(type: OscillatorType): void {
    this.oscillator.type = type;
  }

  public start(): void {
    try {
      this.oscillator.start();
    } catch (e) {
      // already started
    }
  }

  public override pushStateToAudio(): void {
    const s = this._state;
    const ctx = audioEngine.getContext();
    if (typeof s.rate === 'number') {
      this.oscillator.frequency.setValueAtTime(s.rate, ctx.currentTime);
    }
    if (typeof s.depth === 'number') {
      this.depthGain.gain.setValueAtTime(s.depth, ctx.currentTime);
    }
    if (s.type) this.oscillator.type = s.type;
  }

  public override destroy(): void {
    this.oscillator.stop();
    this.oscillator.disconnect();
    this.depthGain.disconnect();
    super.destroy();
  }
}
