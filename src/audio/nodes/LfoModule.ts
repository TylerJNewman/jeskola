import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';
import { createSmoothCV } from '../AudioUtils';
import type { SmoothCV } from '../AudioUtils';

export class LfoModule extends ModularNode {
  private oscillator: OscillatorNode;
  private depthGain: GainNode;
  
  private smoothRate: SmoothCV;
  private smoothDepth: SmoothCV;

  constructor() {
    super('LFO');
    const ctx = audioEngine.getContext();
    
    // Core oscillator
    this.oscillator = ctx.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = 0; // Driven by smoothCV
    
    // Depth control (0.0 to 1.0)
    // The oscillator natively outputs -1 to +1. 
    // This gain scales that output directly.
    this.depthGain = ctx.createGain();
    this.depthGain.gain.value = 0; // Driven by smoothCV

    // Route
    this.oscillator.connect(this.depthGain);
    
    // Smooth CV Slew Limiters
    // Use a slightly faster slew rate (30Hz) for LFO so it stays snappy
    this.smoothRate = createSmoothCV(1.0, 30);
    this.smoothRate.node.connect(this.oscillator.frequency);
    
    this.smoothDepth = createSmoothCV(0.5, 30);
    this.smoothDepth.node.connect(this.depthGain.gain);
    
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
    this.smoothRate.setValue(val);
  }

  public setDepth(val: number): void {
    this.smoothDepth.setValue(val);
  }

  public setType(type: OscillatorType): void {
    this.oscillator.type = type;
  }

  public start(): void {
    this.oscillator.start();
  }

  public override destroy(): void {
    this.smoothRate.destroy();
    this.smoothDepth.destroy();
    this.oscillator.stop();
    this.oscillator.disconnect();
    this.depthGain.disconnect();
    super.destroy();
  }
}
