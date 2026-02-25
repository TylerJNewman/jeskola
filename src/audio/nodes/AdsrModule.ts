import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';

export class AdsrModule extends ModularNode {
  private cvSource: ConstantSourceNode;

  constructor() {
    super('ADSR');
    const ctx = audioEngine.getContext();
    
    // The ADSR output is just a DC CV signal
    this.cvSource = ctx.createConstantSource();
    this.cvSource.offset.value = 0;
    
    // Envelopes don't have audio inputs
    this.inputNode = null; 
    this.outputNode = this.cvSource;
    
    // Initial State defaults
    this.state = {
      attack: 0.1,  // seconds
      decay: 0.2,   // seconds
      sustain: 0.5, // 0 to 1
      release: 0.5  // seconds
    };

    this.cvSource.start();
  }

  public setAttack(val: number): void { this.state.attack = val; }
  public setDecay(val: number): void { this.state.decay = val; }
  public setSustain(val: number): void { this.state.sustain = val; }
  public setRelease(val: number): void { this.state.release = val; }

  public triggerAttack(): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    // Cancel any scheduled releases
    this.cvSource.offset.cancelScheduledValues(now);
    
    // We want to avoid clicks if triggered mid-release
    const currentValue = this.cvSource.offset.value;
    this.cvSource.offset.setValueAtTime(currentValue, now);
    
    // Attack phase: Ramp up to 1.0 linearly
    // Make sure attack isn't exactly 0 to avoid errors 
    const aTime = Math.max(0.01, this.state.attack);
    this.cvSource.offset.linearRampToValueAtTime(1.0, now + aTime);
    
    // Decay phase: Drop to sustain level
    // We use setTargetAtTime for exponential decay which sounds more natural
    const dTime = Math.max(0.01, this.state.decay);
    this.cvSource.offset.setTargetAtTime(this.state.sustain, now + aTime, dTime / 3);
  }

  public triggerRelease(): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.cvSource.offset.cancelScheduledValues(now);
    
    const currentValue = this.cvSource.offset.value;
    this.cvSource.offset.setValueAtTime(currentValue, now);
    
    // Release phase: Drop to 0
    const rTime = Math.max(0.01, this.state.release);
    this.cvSource.offset.setTargetAtTime(0, now, rTime / 3);
  }

  public override destroy(): void {
    this.cvSource.stop();
    this.cvSource.disconnect();
    super.destroy();
  }
}
