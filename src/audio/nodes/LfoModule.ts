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
    
    this.state = {
      rate: 1.0,     // Hz
      depth: 0.5,    // 0 to 1
      type: 'sine'
    };
  }

  public setRate(val: number): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    this.oscillator.frequency.cancelScheduledValues(now);
    this.oscillator.frequency.setValueAtTime(this.oscillator.frequency.value, now);
    this.oscillator.frequency.setTargetAtTime(val, now, 0.05);
  }

  public setDepth(val: number): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    this.depthGain.gain.cancelScheduledValues(now);
    this.depthGain.gain.setValueAtTime(this.depthGain.gain.value, now);
    this.depthGain.gain.setTargetAtTime(val, now, 0.05);
  }

  public setType(type: OscillatorType): void {
    this.oscillator.type = type;
  }

  public start(): void {
    this.oscillator.start();
  }

  public override destroy(): void {
    this.oscillator.stop();
    this.oscillator.disconnect();
    this.depthGain.disconnect();
    super.destroy();
  }
}
