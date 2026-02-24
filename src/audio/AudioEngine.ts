/**
 * AudioEngine Singleton
 * Wraps the Web Audio API context and provides global audio utilities.
 */
export class AudioEngine {
  private static instance: AudioEngine;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private constructor() {}

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /**
   * Initializes the AudioContext. Must be called after a user interaction.
   */
  public async init(): Promise<void> {
    if (this.ctx) return;

    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create master gain and connect to destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8; // default slight headroom
    this.masterGain.connect(this.ctx.destination);
    
    // Resume context if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    
    console.log('AudioEngine initialized', this.ctx.state);
  }

  public getContext(): AudioContext {
    if (!this.ctx) {
      throw new Error('AudioContext not initialized. Call init() first.');
    }
    return this.ctx;
  }

  public getDestination(): AudioNode {
    if (!this.masterGain) {
      throw new Error('AudioContext not initialized.');
    }
    return this.masterGain;
  }

  public suspend(): void {
    this.ctx?.suspend();
  }

  public resume(): void {
    this.ctx?.resume();
  }
}

export const audioEngine = AudioEngine.getInstance();
