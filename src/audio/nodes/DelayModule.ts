import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';

export class DelayModule extends ModularNode {
  private delay: DelayNode;
  private feedback: GainNode;
  private mix: GainNode;
  private dry: GainNode;
  private inputGain: GainNode;
  private outputGain: GainNode;

  constructor() {
    super('Delay');
    const ctx = audioEngine.getContext();
    
    // Nodes
    this.inputGain = ctx.createGain();
    this.delay = ctx.createDelay(10.0); // max 10s delay
    this.feedback = ctx.createGain();
    this.mix = ctx.createGain(); // Wet
    this.dry = ctx.createGain(); // Dry
    this.outputGain = ctx.createGain();

    // Default params
    this.delay.delayTime.value = 0.4;
    this.feedback.gain.value = 0.4;
    this.mix.gain.value = 0.5;
    this.dry.gain.value = 0.8;

    // Routing
    // Input splits into Dry and Delay
    this.inputGain.connect(this.dry);
    this.inputGain.connect(this.delay);

    // Delay feeds into Feedback loop and Mix
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delay.connect(this.mix);

    // Dry and Mix feed into Output
    this.dry.connect(this.outputGain);
    this.mix.connect(this.outputGain);

    this.inputNode = this.inputGain;
    this.outputNode = this.outputGain;

    this.params.set('time', this.delay.delayTime);
    this.params.set('feedback', this.feedback.gain);
    // Note: mix doesn't perfectly work with just AudioParam CV because of the inverted dry 
    // connection, but for experimental modular synthesis, it will still modulate the wet signal.
    this.params.set('mix', this.mix.gain);
  }

  public setTime(val: number): void {
    const ctx = audioEngine.getContext();
    this.delay.delayTime.setTargetAtTime(val, ctx.currentTime, 0.05);
  }

  public setFeedback(val: number): void {
    const ctx = audioEngine.getContext();
    this.feedback.gain.setTargetAtTime(val, ctx.currentTime, 0.05);
  }

  public setMix(val: number): void {
    const ctx = audioEngine.getContext();
    this.mix.gain.setTargetAtTime(val, ctx.currentTime, 0.05);
    // Inverse relationship for dry signal to maintain volume roughly
    this.dry.gain.setTargetAtTime(1 - val, ctx.currentTime, 0.05);
  }

  public override pushStateToAudio(): void {
    const s = this._state;
    const ctx = audioEngine.getContext();
    if (typeof s.time === 'number') {
      this.delay.delayTime.setValueAtTime(s.time, ctx.currentTime);
    }
    if (typeof s.feedback === 'number') {
      this.feedback.gain.setValueAtTime(s.feedback, ctx.currentTime);
    }
    if (typeof s.mix === 'number') {
      this.mix.gain.setValueAtTime(s.mix, ctx.currentTime);
      this.dry.gain.setValueAtTime(1 - s.mix, ctx.currentTime);
    }
  }

  public override destroy(): void {
    this.inputGain.disconnect();
    this.delay.disconnect();
    this.feedback.disconnect();
    this.mix.disconnect();
    this.dry.disconnect();
    this.outputGain.disconnect();
    super.destroy();
  }
}
