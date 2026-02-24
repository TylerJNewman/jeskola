import { ModularNode } from './ModularNode';
import { audioEngine } from '../AudioEngine';
/**
 * Master output node representation.
 */
export class MasterNode extends ModularNode {
  constructor() {
    super('Master');
    // The master node doesn't output to anything else in our graph
    this.outputNode = null;
    
    // The input node is the engine's master gain
    // We defer gaining access until it's actually requested since 
    // the audio engine might not be init'd at instantiation time
  }

  public override getInputNode(): AudioNode | null {
    try {
      return audioEngine.getDestination();
    } catch (e) {
      return null;
    }
  }
}
