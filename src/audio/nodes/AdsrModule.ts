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
    this.triggerAttackAt(audioEngine.getContext().currentTime);
  }

  public triggerRelease(): void {
    this.triggerReleaseAt(audioEngine.getContext().currentTime);
  }

  public triggerAttackAt(time: number): void {
    this.cvSource.offset.cancelScheduledValues(time);
    this.cvSource.offset.setValueAtTime(this.cvSource.offset.value, time);

    const aTime = Math.max(0.01, this.state.attack);
    this.cvSource.offset.linearRampToValueAtTime(1.0, time + aTime);

    const dTime = Math.max(0.01, this.state.decay);
    this.cvSource.offset.setTargetAtTime(this.state.sustain, time + aTime, dTime / 3);
  }

  public triggerReleaseAt(time: number): void {
    this.cvSource.offset.cancelScheduledValues(time);

    try {
      if (typeof this.cvSource.offset.cancelAndHoldAtTime === 'function') {
        this.cvSource.offset.cancelAndHoldAtTime(time);
      } else {
        this.cvSource.offset.setValueAtTime(this.cvSource.offset.value, time);
      }
    } catch(e) { /* fallback */ }

    const rTime = Math.max(0.01, this.state.release);
    this.cvSource.offset.setTargetAtTime(0, time, rTime / 3);
  }

  public onGateSignal(gateOn: boolean, time: number): void {
    if (gateOn) this.triggerAttackAt(time);
    else this.triggerReleaseAt(time);
  }

  public override destroy(): void {
    this.cvSource.stop();
    this.cvSource.disconnect();
    super.destroy();
  }
}
