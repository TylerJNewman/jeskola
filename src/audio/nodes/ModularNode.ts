import { audioEngine } from '../AudioEngine';
/**
 * Base class for all modular synthesizer nodes.
 */
export abstract class ModularNode {
  public readonly id: string;
  public readonly type: string;
  
  protected inputNode: AudioNode | null = null;
  protected outputNode: AudioNode | null = null;

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
  public connect(destination: ModularNode): void {
    const destInput = destination.getInputNode();
    if (this.outputNode && destInput) {
      this.outputNode.connect(destInput);
      console.log(`Connected ${this.type} to ${destination.type}`);
    } else {
      console.warn(`Cannot connect ${this.type} to ${destination.type} - missing input/output nodes`);
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
  public disconnect(destination: ModularNode): void {
    const destInput = destination.getInputNode();
    if (this.outputNode && destInput) {
      this.outputNode.disconnect(destInput);
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
