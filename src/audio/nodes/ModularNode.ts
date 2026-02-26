import { audioEngine } from '../AudioEngine';
/**
 * Base class for all modular synthesizer nodes.
 */
export abstract class ModularNode {
  public id: string;
  public readonly type: string;
  
  protected inputNode: AudioNode | null = null;
  protected outputNode: AudioNode | null = null;
  
  // Specific inputs for Control Voltage or other routing
  public params: Map<string, AudioParam | AudioNode> = new Map();
  
  // Stored parameter values for serialization
  protected _state: Record<string, any> = {};

  constructor(type: string) {
    this.id = crypto.randomUUID();
    this.type = type;
  }

  public getInputNode(): AudioNode | null {
    return this.inputNode;
  }

  public getOutputNode(): AudioNode | null {
    return this.outputNode;
  }

  public get state(): Record<string, any> {
    return this._state;
  }

  public set state(value: Record<string, any>) {
    this._state = value ?? {};
    this.pushStateToAudio();
  }

  /** Merge into _state without triggering pushStateToAudio. Used by UI to persist values for serialization. */
  public patchState(patch: Record<string, any>): void {
    Object.assign(this._state, patch);
  }

  /** Sync _state values to actual AudioParams. Override in subclasses. */
  public pushStateToAudio(): void {
    // Base: no-op. Subclasses override to push _state into their AudioParams.
  }

  /**
   * Returns the audio node for a given output port.
   * Subclasses can override to provide multiple distinct outputs.
   */
  public getOutputForPort(portId: string): AudioNode | null {
    if (!portId || portId === 'audio') return this.outputNode;
    const param = this.params.get(portId);
    if (param instanceof AudioNode) return param;
    return this.outputNode;
  }

  /**
   * Optional gate signal interface for modules that respond to gate events.
   * Implemented by ADSR and similar envelope modules.
   */
  public onGateSignal?(gateOn: boolean, time: number): void;

  /**
   * Connects this module's output to another module's input.
   */
  public connect(destination: ModularNode, targetPortId?: string, sourcePortId?: string): void {
    const output = sourcePortId ? this.getOutputForPort(sourcePortId) : this.outputNode;
    if (!output) return;

    if (targetPortId && targetPortId !== 'audio' && destination.params.has(targetPortId)) {
      const paramNode = destination.params.get(targetPortId)!;
      output.connect(paramNode as any);
      console.log(`Connected ${this.type}:${sourcePortId || 'audio'} to ${destination.type} param ${targetPortId}`);
    } else {
      const destInput = destination.getInputNode();
      if (destInput) {
        output.connect(destInput);
        console.log(`Connected ${this.type}:${sourcePortId || 'audio'} to ${destination.type}`);
      } else {
        console.warn(`Cannot connect ${this.type} to ${destination.type} - missing input node`);
      }
    }
  }

  /**
   * Connects this module directly to the master output.
   */
  public connectToMaster(): void {
    if (this.outputNode) {
      this.outputNode.connect(audioEngine.getDestination());
      console.log(`Connected ${this.type} to Master`);
    }
  }

  /**
   * Disconnects this module's output from another module's input.
   */
  public disconnect(destination: ModularNode, targetPortId?: string, sourcePortId?: string): void {
    const output = sourcePortId ? this.getOutputForPort(sourcePortId) : this.outputNode;
    if (!output) return;

    if (targetPortId && targetPortId !== 'audio' && destination.params.has(targetPortId)) {
      const paramNode = destination.params.get(targetPortId)!;
      try {
        output.disconnect(paramNode as any);
      } catch(e) {}
    } else {
      const destInput = destination.getInputNode();
      if (destInput) {
        try {
          output.disconnect(destInput);
        } catch(e) {}
      }
    }
  }

  /**
   * Cleanup method to release Web Audio resources.
   */
  public destroy(): void {
    if (this.outputNode) {
      this.outputNode.disconnect();
    }
  }
}
