import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';

export class DistortionModule extends ModularNode {
  private inputGain: GainNode;
  private shaper: WaveShaperNode;
  private wetGain: GainNode;
  private dryGain: GainNode;
  private outputGain: GainNode;

  constructor() {
    super('Distortion');
    const ctx = audioEngine.getContext();

    this.inputGain = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.outputGain = ctx.createGain();

    this.shaper.curve = this.createSoftClipCurve(1024) as any;
    this.shaper.oversample = 'none';

    this.inputGain.gain.value = 1.0;
    this.wetGain.gain.value = 0.5;
    this.dryGain.gain.value = 0.5;
    this.outputGain.gain.value = 0.8;

    this.inputGain.connect(this.shaper);
    this.shaper.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);

    this.inputNode = this.inputGain;
    this.outputNode = this.outputGain;

    this.params.set('drive', this.inputGain.gain);
    this.params.set('mix', this.wetGain.gain);

    this.state = {
      drive: 1.0,
      mix: 0.5,
      output: 0.8
    };
  }

  private createSoftClipCurve(samples: number): Float32Array {
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i += 1) {
      const x = (i / (samples - 1)) * 2 - 1;
      // Normalized tanh soft clip in range [-1, 1]
      curve[i] = Math.tanh(2.5 * x) / Math.tanh(2.5);
    }
    return curve;
  }

  public setDrive(val: number): void {
    const ctx = audioEngine.getContext();
    const next = Math.max(0.01, Math.min(20, val));
    this.inputGain.gain.setTargetAtTime(next, ctx.currentTime, 0.05);
  }

  public setMix(val: number): void {
    const ctx = audioEngine.getContext();
    const next = Math.max(0, Math.min(1, val));
    this.wetGain.gain.setTargetAtTime(next, ctx.currentTime, 0.05);
    this.dryGain.gain.setTargetAtTime(1 - next, ctx.currentTime, 0.05);
  }

  public setOutput(val: number): void {
    const ctx = audioEngine.getContext();
    const next = Math.max(0, Math.min(2, val));
    this.outputGain.gain.setTargetAtTime(next, ctx.currentTime, 0.05);
  }

  public override destroy(): void {
    this.inputGain.disconnect();
    this.shaper.disconnect();
    this.wetGain.disconnect();
    this.dryGain.disconnect();
    this.outputGain.disconnect();
    super.destroy();
  }
}
