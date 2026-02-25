import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';
import { createSmoothCV } from '../AudioUtils';
import type { SmoothCV } from '../AudioUtils';

export class OscillatorModule extends ModularNode {
  private osc: OscillatorNode;
  private gain: GainNode;
  private cvPitchMod: GainNode;

  private smoothFreq: SmoothCV;
  private smoothDetune: SmoothCV;

  private baseFreq: number = 440;
  private octave: number = 0;
  private semitone: number = 0;
  private cents: number = 0;
  
  private rawFreq: number = 440;
  private currentMode: 'pitch' | 'freq' = 'pitch';

  constructor() {
    super('Oscillator');
    const ctx = audioEngine.getContext();
    
    // Internal routing: Oscillator -> Gain -> Output out of module
    this.osc = ctx.createOscillator();
    this.gain = ctx.createGain();
    
    this.osc.type = 'sine';
    
    this.osc.frequency.value = 0; // Driven entirely by SmoothCV
    this.osc.detune.value = 0;   // Driven entirely by SmoothCV
    
    this.smoothFreq = createSmoothCV(440, 15);
    this.smoothFreq.node.connect(this.osc.frequency);
    
    this.smoothDetune = createSmoothCV(0, 15);
    this.smoothDetune.node.connect(this.osc.detune);
    
    this.gain.gain.value = 0.5;
    
    this.osc.connect(this.gain);
    
    // Export nodes
    // Generators usually don't have inputs for audio (except maybe CV/FM later)
    this.inputNode = null; 
    this.outputNode = this.gain;
    
    // Scale incoming CV by 1200 cents for 1V/Octave standard modular tracking
    this.cvPitchMod = ctx.createGain();
    this.cvPitchMod.gain.value = 1200;
    this.cvPitchMod.connect(this.osc.detune);
    
    // Register CV inputs
    this.params.set('freq', this.cvPitchMod);
    this.params.set('gain', this.gain.gain);
  }

  private calculateFrequency() {
    if (this.currentMode === 'pitch') {
      const finalFreq = this.baseFreq * Math.pow(2, this.octave) * Math.pow(2, this.semitone / 12);
      this.smoothFreq.setValue(finalFreq);
      this.smoothDetune.setValue(this.cents);
    } else {
      this.smoothFreq.setValue(this.rawFreq);
      this.smoothDetune.setValue(0);
    }
  }

  public setMode(mode: 'pitch' | 'freq'): void {
    this.currentMode = mode;
    this.calculateFrequency();
  }

  public setFreq(val: number): void {
    this.rawFreq = val;
    this.calculateFrequency();
  }

  public setOctave(val: number): void {
    this.octave = val;
    this.calculateFrequency();
  }

  public setSemitone(val: number): void {
    this.semitone = val;
    this.calculateFrequency();
  }

  public setCents(val: number): void {
    this.cents = val;
    this.calculateFrequency();
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
    this.smoothFreq.destroy();
    this.smoothDetune.destroy();
    this.cvPitchMod.disconnect();
    this.osc.disconnect();
    this.gain.disconnect();
    super.destroy();
  }
}
