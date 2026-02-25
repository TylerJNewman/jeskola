import { audioEngine } from './AudioEngine';

export type TickCallback = (tickIndex: number, tickTime: number) => void;
export type StopCallback = () => void;

export class Transport {
  private static instance: Transport;

  private _bpm: number = 120;
  private _ticksPerBeat: number = 4; // 16th notes
  private _swing: number = 0.5; // 0.5 = no swing

  private playing: boolean = false;
  private tickIndex: number = 0;
  private nextTickTime: number = 0;
  private timerId: number | null = null;

  private tickListeners: Set<TickCallback> = new Set();
  private stopListeners: Set<StopCallback> = new Set();

  // Lookahead scheduling parameters
  private readonly scheduleAheadTime = 0.1; // seconds
  private readonly schedulerInterval = 25;  // ms

  private constructor() {}

  public static getInstance(): Transport {
    if (!Transport.instance) {
      Transport.instance = new Transport();
    }
    return Transport.instance;
  }

  public get bpm(): number { return this._bpm; }
  public get ticksPerBeat(): number { return this._ticksPerBeat; }
  public get swing(): number { return this._swing; }
  public get isPlaying(): boolean { return this.playing; }
  public get currentTick(): number { return this.tickIndex; }

  public get secondsPerTick(): number {
    return 60 / (this._bpm * this._ticksPerBeat);
  }

  public setBpm(bpm: number): void {
    const clamped = Math.max(20, Math.min(300, bpm));
    if (this.playing) {
      // Recalculate nextTickTime from the last tick boundary
      const oldSpt = this.secondsPerTick;
      this._bpm = clamped;
      const newSpt = this.secondsPerTick;
      // Adjust next tick time proportionally
      const ctx = audioEngine.getContext();
      const elapsed = ctx.currentTime - (this.nextTickTime - oldSpt);
      this.nextTickTime = ctx.currentTime + (newSpt - (elapsed % newSpt));
    } else {
      this._bpm = clamped;
    }
  }

  public setTicksPerBeat(tpb: number): void {
    this._ticksPerBeat = Math.max(1, Math.min(16, tpb));
  }

  public setSwing(val: number): void {
    this._swing = Math.max(0, Math.min(1, val));
  }

  public onTick(cb: TickCallback): void {
    this.tickListeners.add(cb);
  }

  public offTick(cb: TickCallback): void {
    this.tickListeners.delete(cb);
  }

  public onStop(cb: StopCallback): void {
    this.stopListeners.add(cb);
  }

  public offStop(cb: StopCallback): void {
    this.stopListeners.delete(cb);
  }

  public play(): void {
    if (this.playing) return;

    const ctx = audioEngine.getContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    this.playing = true;
    this.tickIndex = 0;
    this.nextTickTime = ctx.currentTime;
    this.scheduler();
  }

  public stop(): void {
    if (!this.playing) return;
    this.playing = false;

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    // Notify all stop listeners
    this.stopListeners.forEach(cb => cb());
    this.tickIndex = 0;
  }

  private scheduler(): void {
    if (!this.playing) return;

    const ctx = audioEngine.getContext();
    const deadline = ctx.currentTime + this.scheduleAheadTime;

    while (this.nextTickTime < deadline) {
      // Apply swing to odd-numbered ticks
      let tickTime = this.nextTickTime;
      if (this.tickIndex % 2 === 1 && this._swing !== 0.5) {
        tickTime += (this._swing - 0.5) * this.secondsPerTick;
      }

      // Fire all tick listeners
      this.tickListeners.forEach(cb => cb(this.tickIndex, tickTime));

      this.tickIndex++;
      this.nextTickTime += this.secondsPerTick;
    }

    this.timerId = window.setTimeout(() => this.scheduler(), this.schedulerInterval);
  }
}

export const transport = Transport.getInstance();
