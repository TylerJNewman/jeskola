import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';
import { transport } from '../Transport';
import type { TickCallback, StopCallback } from '../Transport';
import { NO_VALUE, createEmptyPattern, midiToCv } from '../sequencer/types';
import type { Pattern, SequencerStep } from '../sequencer/types';

export class SequencerModule extends ModularNode {
  private noteCV: ConstantSourceNode;
  private gateCV: ConstantSourceNode;
  private gateTargets: Set<ModularNode> = new Set();

  public pattern: Pattern;
  private _octaveOffset: number = 0;
  private _gateLength: number = 0.5; // fraction of step duration

  private tickCallback: TickCallback;
  private stopCallback: StopCallback;

  // For playhead UI tracking
  public currentStep: number = -1;
  public onStepChange?: (step: number) => void;

  constructor() {
    super('Sequencer');
    const ctx = audioEngine.getContext();

    this.noteCV = ctx.createConstantSource();
    this.noteCV.offset.value = 0;
    this.noteCV.start();

    this.gateCV = ctx.createConstantSource();
    this.gateCV.offset.value = 0;
    this.gateCV.start();

    // Default output (audio port) = note CV
    this.outputNode = this.noteCV;
    this.inputNode = null;

    // Named output for gate
    this.params.set('gate', this.gateCV);

    this.pattern = createEmptyPattern(16);

    // Register transport callbacks
    this.tickCallback = (tickIndex: number, tickTime: number) => {
      this.onTick(tickIndex, tickTime);
    };
    this.stopCallback = () => {
      this.onTransportStop();
    };

    transport.onTick(this.tickCallback);
    transport.onStop(this.stopCallback);
  }

  public get octaveOffset(): number { return this._octaveOffset; }
  public set octaveOffset(val: number) { this._octaveOffset = val; }

  public get gateLength(): number { return this._gateLength; }
  public set gateLength(val: number) { this._gateLength = Math.max(0.01, Math.min(1.0, val)); }

  public override getOutputForPort(portId: string): AudioNode | null {
    if (portId === 'gate') return this.gateCV;
    if (!portId || portId === 'audio') return this.noteCV;
    return this.noteCV;
  }

  public addGateTarget(m: ModularNode): void {
    this.gateTargets.add(m);
  }

  public removeGateTarget(m: ModularNode): void {
    this.gateTargets.delete(m);
  }

  private onTick(tickIndex: number, tickTime: number): void {
    const stepIndex = tickIndex % this.pattern.length;
    this.currentStep = stepIndex;

    const step = this.pattern.steps[stepIndex];
    const stepDuration = transport.secondsPerTick;

    if (step && step.gate && step.note !== NO_VALUE) {
      const cvValue = midiToCv(step.note + this._octaveOffset * 12);
      const velocity = step.velocity !== NO_VALUE ? step.velocity : 1.0;
      const gateOffTime = tickTime + this._gateLength * stepDuration;

      // Schedule note CV
      this.noteCV.offset.setValueAtTime(cvValue, tickTime);

      // Schedule gate CV
      this.gateCV.offset.setValueAtTime(velocity, tickTime);
      this.gateCV.offset.setValueAtTime(0, gateOffTime);

      // Fire gate signals to connected ADSR modules
      this.gateTargets.forEach(target => {
        if (typeof target.onGateSignal === 'function') {
          target.onGateSignal(true, tickTime);
          target.onGateSignal(false, gateOffTime);
        }
      });
    } else {
      // No note on this step — ensure gate is off
      this.gateCV.offset.setValueAtTime(0, tickTime);
    }

    // Notify UI of step change
    if (this.onStepChange) {
      this.onStepChange(stepIndex);
    }
  }

  private onTransportStop(): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    // Cancel all scheduled values
    this.noteCV.offset.cancelScheduledValues(now);
    this.gateCV.offset.cancelScheduledValues(now);

    // Force gate off
    this.gateCV.offset.setValueAtTime(0, now);

    // Release all ADSR targets
    this.gateTargets.forEach(target => {
      if (typeof target.onGateSignal === 'function') {
        target.onGateSignal(false, now);
      }
    });

    this.currentStep = -1;
    if (this.onStepChange) {
      this.onStepChange(-1);
    }
  }

  public setPattern(pattern: Pattern): void {
    this.pattern = pattern;
  }

  public setStep(index: number, step: Partial<SequencerStep>): void {
    if (index >= 0 && index < this.pattern.steps.length) {
      Object.assign(this.pattern.steps[index], step);
    }
  }

  public setPatternLength(length: number): void {
    const clamped = Math.max(1, Math.min(64, length));
    if (clamped === this.pattern.length) return;

    if (clamped > this.pattern.length) {
      // Extend with empty steps
      for (let i = this.pattern.length; i < clamped; i++) {
        this.pattern.steps.push({ note: NO_VALUE, velocity: 1.0, gate: false });
      }
    } else {
      // Truncate
      this.pattern.steps.length = clamped;
    }
    this.pattern.length = clamped;
  }

  public override destroy(): void {
    // Unregister from transport
    transport.offTick(this.tickCallback);
    transport.offStop(this.stopCallback);

    // Stop and disconnect CV sources
    this.noteCV.stop();
    this.noteCV.disconnect();
    this.gateCV.stop();
    this.gateCV.disconnect();

    this.gateTargets.clear();
    super.destroy();
  }

  public override get state(): Record<string, any> {
    return {
      pattern: {
        name: this.pattern.name,
        length: this.pattern.length,
        steps: this.pattern.steps.map(s => ({ note: s.note, velocity: s.velocity, gate: s.gate }))
      },
      octaveOffset: this._octaveOffset,
      gateLength: this._gateLength
    };
  }

  public override set state(s: Record<string, any>) {
    if (s.pattern) {
      const p = s.pattern;
      this.pattern = {
        name: p.name || 'Pattern 1',
        length: p.length || 16,
        steps: Array.isArray(p.steps)
          ? p.steps.map((st: any) => ({
              note: st.note ?? NO_VALUE,
              velocity: st.velocity ?? 1.0,
              gate: !!st.gate
            }))
          : createEmptyPattern(p.length || 16).steps
      };
    }
    if (typeof s.octaveOffset === 'number') this._octaveOffset = s.octaveOffset;
    if (typeof s.gateLength === 'number') this._gateLength = s.gateLength;
  }
}
