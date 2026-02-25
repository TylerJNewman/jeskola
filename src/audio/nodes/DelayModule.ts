import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';
import { createSmoothCV } from '../AudioUtils';
import type { SmoothCV } from '../AudioUtils';

export class DelayModule extends ModularNode {
  private delay: DelayNode;
  private feedback: GainNode;
  private mix: GainNode;
  private dry: GainNode;
  private inputGain: GainNode;
  private outputGain: GainNode;
  
  private smoothTime: SmoothCV;
  private smoothFeedback: SmoothCV;
  private smoothMix: SmoothCV;

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

    // Default params driven by SmoothCV completely
    this.delay.delayTime.value = 0;
    this.feedback.gain.value = 0;
    this.mix.gain.value = 0;
    this.dry.gain.value = 0;
    
    // Slew limiters
    this.smoothTime = createSmoothCV(0.4, 15);
    this.smoothTime.node.connect(this.delay.delayTime);
    
    this.smoothFeedback = createSmoothCV(0.4, 15);
    this.smoothFeedback.node.connect(this.feedback.gain);
    
    this.smoothMix = createSmoothCV(0.5, 15);
    this.smoothMix.node.connect(this.mix.gain);

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
    this.smoothTime.setValue(val);
  }

  public setFeedback(val: number): void {
    this.smoothFeedback.setValue(val);
  }

  public setMix(val: number): void {
    this.smoothMix.setValue(val);
    
    // Inverse relationship for dry signal to maintain volume roughly.
    // We can just use the fast Web Audio param setter here since it's just inverse 
    // of wet, but let's let SmoothMix handle wet and gracefully handle the dry drop.
    const ctx = audioEngine.getContext();
    this.dry.gain.setTargetAtTime(1 - val, ctx.currentTime, 0.05);
  }

  public override destroy(): void {
    this.smoothTime.destroy();
    this.smoothFeedback.destroy();
    this.smoothMix.destroy();    
    this.inputGain.disconnect();
    this.delay.disconnect();
    this.feedback.disconnect();
    this.mix.disconnect();
    this.dry.disconnect();
    this.outputGain.disconnect();
    super.destroy();
  }
}
