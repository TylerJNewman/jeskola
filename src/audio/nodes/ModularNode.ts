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
  public state: Record<string, any> = {};

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

  /**
   * Connects this module's output to another module's input.
   */
  public connect(destination: ModularNode, targetPortId?: string): void {
    if (!this.outputNode) return;

    if (targetPortId && targetPortId !== 'audio' && destination.params.has(targetPortId)) {
      const paramNode = destination.params.get(targetPortId)!;
      this.outputNode.connect(paramNode as any);
      console.log(`Connected ${this.type} to ${destination.type} param ${targetPortId}`);
    } else {
      const destInput = destination.getInputNode();
      if (destInput) {
        this.outputNode.connect(destInput);
        console.log(`Connected ${this.type} to ${destination.type}`);
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
  public disconnect(destination: ModularNode, targetPortId?: string): void {
    if (!this.outputNode) return;

    if (targetPortId && targetPortId !== 'audio' && destination.params.has(targetPortId)) {
      const paramNode = destination.params.get(targetPortId)!;
      try {
        this.outputNode.disconnect(paramNode as any);
      } catch(e) {}
    } else {
      const destInput = destination.getInputNode();
      if (destInput) {
        try {
          this.outputNode.disconnect(destInput);
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
