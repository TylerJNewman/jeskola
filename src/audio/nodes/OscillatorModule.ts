import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';

export class OscillatorModule extends ModularNode {
  private osc: OscillatorNode;
  private gain: GainNode;

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
  }

  public setFrequency(val: number): void {
    const ctx = audioEngine.getContext();
    this.osc.frequency.setTargetAtTime(val, ctx.currentTime, 0.05);
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
    this.osc.disconnect();
    this.gain.disconnect();
    super.destroy();
  }
}
