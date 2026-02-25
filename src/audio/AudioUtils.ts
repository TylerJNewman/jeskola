import { audioEngine } from './AudioEngine';

export interface SmoothCV {
  node: AudioNode;
  setValue: (val: number) => void;
  destroy: () => void;
}

/**
 * Creates a "Slew Limiter" (Lag Processor) using native Web Audio nodes.
 * This completely eliminates zipper noise (clicking) when continuously 
 * adjusting parameters via the UI without requiring complex JS scheduling 
 * or WASM AudioWorklets.
 * 
 * Architecture:
 * ConstantSourceNode -> BiquadFilterNode(Lowpass, ~15Hz) -> (Target AudioParam)
 */
export function createSmoothCV(initialValue: number, slewRateHz: number = 15): SmoothCV {
  const ctx = audioEngine.getContext();
  
  // The raw value generator
  const constantSource = ctx.createConstantSource();
  constantSource.offset.value = initialValue;
  constantSource.start();

  // The slew limiter (smoother)
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = slewRateHz;
  // Q=0 prevents any resonant ringing during fast changes
  filter.Q.value = 0;

  constantSource.connect(filter);

  return {
    node: filter, // Connect this to your target AudioParam
    setValue: (val: number) => {
      // Instantly snap the constant source. 
      // The Lowpass filter will organically smooth this jump.
      constantSource.offset.value = val;
    },
    destroy: () => {
      constantSource.stop();
      constantSource.disconnect();
      filter.disconnect();
    }
  };
}
