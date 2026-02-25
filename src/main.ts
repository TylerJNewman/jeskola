import './style.css';
import { audioEngine } from './audio/AudioEngine';
import { OscillatorModule } from './audio/nodes/OscillatorModule';
import { FilterModule } from './audio/nodes/FilterModule';
import { DelayModule } from './audio/nodes/DelayModule';
import { GainModule } from './audio/nodes/GainModule';
import { AdsrModule } from './audio/nodes/AdsrModule';
import { LfoModule } from './audio/nodes/LfoModule';
import { MasterNode } from './audio/nodes/MasterNode';
import { ModularNode } from './audio/nodes/ModularNode';
import { Workspace } from './ui/Workspace';
import { Knob } from './ui/Knob';
import { PRESETS } from './presets';

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('btn-master-play') as HTMLButtonElement;
  const addButtons = document.querySelectorAll('.add-module-btn');
  
  // Wait for user interaction to start audio (browser policy)
  let initialized = false;

  async function ensureInitialized() {
    if (!initialized) {
      startBtn.textContent = 'INITIALIZING...';
      await audioEngine.init();
      
      // Initialize workspace
      const workspace = new Workspace('workspace', 'cables-layer');
      
      // Expose createModule to Window for Workspace.ts to use during imports
      window._createModule = createModule;
      
      // Master Module
      createMasterModule(workspace);
      
      initialized = true;
      startBtn.textContent = 'STOP AUDIO';
      startBtn.classList.remove('primary');
    }
  }

  startBtn.addEventListener('click', async () => {
    if (!initialized) {
      await ensureInitialized();
    } else {
      const ctx = audioEngine.getContext();
      if (ctx.state === 'running') {
        ctx.suspend();
        startBtn.textContent = 'START AUDIO';
        startBtn.classList.add('primary');
      } else {
        ctx.resume();
        startBtn.textContent = 'STOP AUDIO';
        startBtn.classList.remove('primary');
      }
    }
  });

  // Keep track of total modules added for staggering position
  let moduleCount = 0;

  addButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!initialized) {
        await ensureInitialized();
      }

      const type = btn.getAttribute('data-type');
      if (type) {
        // Find workspace instance (not cleanly scoped here, passing via window for demo or passing to a factory)
        // Simplest way is to define factory inside DOMContentLoaded scope
        createModule(type);
      }
    });
  });

  function getWorkspace(): Workspace | null {
    // Quick hack to grab workspace if initialized (could be structured better)
    // We'll trust the initialized flag
    return window._workspace;
  }

  // --- SAVE / LOAD LOGIC ---
  const saveBtn = document.createElement('button');
  saveBtn.className = 'control-btn';
  saveBtn.innerHTML = '<span>SAVE PATCH</span>';
  saveBtn.style.marginRight = '8px';
  saveBtn.addEventListener('click', () => {
    const ws = getWorkspace();
    if (!ws) return;
    const json = ws.exportState();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jeskola_patch.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  const loadFileBtn = document.createElement('input');
  loadFileBtn.type = 'file';
  loadFileBtn.accept = '.json';
  loadFileBtn.style.display = 'none';
  loadFileBtn.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      const ws = getWorkspace();
      if (ws && typeof re.target?.result === 'string') {
        const result = re.target.result;
        // Make sure audio is initialized before importing 
        ensureInitialized().then(() => {
           ws.importState(result);
        });
      }
    };
    reader.readAsText(file);
    // Reset file input so we can load the same file again if desired
    loadFileBtn.value = '';
  });

  const loadBtn = document.createElement('button');
  loadBtn.className = 'control-btn';
  loadBtn.innerHTML = '<span>LOAD PATCH</span>';
  loadBtn.style.marginRight = '8px';
  loadBtn.addEventListener('click', () => {
    loadFileBtn.click();
  });

  const presetSelect = document.createElement('select');
  presetSelect.className = 'select-preset';
  presetSelect.style.marginRight = '8px';
  presetSelect.style.padding = '4px';
  presetSelect.style.backgroundColor = 'var(--panel-bg)';
  presetSelect.style.color = 'var(--text-light)';
  presetSelect.style.border = '1px solid var(--border-color)';
  presetSelect.innerHTML = `
    <option value="">Select a Preset...</option>
    <option value="sub-bass">Sub Bass (Detuned + Filter)</option>
    <option value="ethereal-drone">Ethereal Drone (Perfect 5th + Delay)</option>
    <option value="sci-fi-fm">Sci-Fi FM Laser (CV Pitch Mod)</option>
    <option value="classic-pluck">Classic Pluck (ADSR + VCA)</option>
    <option value="acid-bass-sweep">Acid Bass Sweep (ADSR + VCF)</option>
    <option value="ambient-pad">Ambient Pad (ADSR + Synth)</option>
    <option value="wobble-bass">Wobble Bass (LFO + VCF)</option>
  `;

  const loadPresetBtn = document.createElement('button');
  loadPresetBtn.className = 'control-btn';
  loadPresetBtn.innerHTML = '<span>LOAD PRESET</span>';
  loadPresetBtn.style.marginRight = '8px';
  loadPresetBtn.addEventListener('click', () => {
    const val = presetSelect.value;
    if (val && PRESETS[val]) {
      const ws = getWorkspace();
      if (ws) {
        ensureInitialized().then(() => {
          ws.importState(PRESETS[val]);
        });
      }
    }
  });

  // Prepend buttons to controls area
  const controlsDiv = document.querySelector('.controls');
  if (controlsDiv) {
    controlsDiv.insertBefore(presetSelect, startBtn);
    controlsDiv.insertBefore(loadPresetBtn, startBtn);
    controlsDiv.insertBefore(saveBtn, startBtn);
    controlsDiv.insertBefore(loadBtn, startBtn);
    controlsDiv.appendChild(loadFileBtn);
  }

  function createMasterModule(ws: Workspace) {
    const master = new MasterNode();
    master.id = 'master'; // Force fixed ID for serialization routing
    const el = document.createElement('div');
    el.className = 'module';
    el.innerHTML = `
      <div class="module-header">
        <h3>Master Out</h3>
      </div>
      <div class="module-body">
         <div class="ports" style="justify-content: flex-start;">
          <div class="port-container">
            <div class="port input" data-port-id="audio"></div>
            <span class="label">IN</span>
          </div>
        </div>
      </div>
    `;
    ws.addModule(master, el, window.innerWidth - 250, window.innerHeight - 150);
    window._workspace = ws; // Save to global scope for module creation
  }

  function createModule(type: string, id?: string, xPos?: number, yPos?: number, state?: Record<string, any>) {
    const ws = getWorkspace();
    if (!ws) return;

    let audioNode: ModularNode | undefined;
    let title = '';
    let bodyHTML = '';
    
    // For manual creation vs loading
    let x = xPos !== undefined ? xPos : 30 + (moduleCount * 20);
    let y = yPos !== undefined ? yPos : 80 + (moduleCount * 20);
    if (xPos === undefined) moduleCount++;

    const el = document.createElement('div');
    el.className = 'module';
    let moduleSetup = (_container: HTMLElement) => {}; // Callback to attach knobs after HTML is parsed

    switch (type) {
      case 'oscillator':
        audioNode = new OscillatorModule();
        title = 'Oscillator';
        bodyHTML = `
          <div class="ports" style="justify-content: space-between;">
            <div class="port-container" style="flex-direction:row; align-items:center;">
              <div class="port input" data-port-id="freq"></div>
              <span class="label" style="font-size:9px; margin-left:4px;">1V/OCT</span>
            </div>
            <div class="port-container">
              <span class="label">OUT</span>
              <div class="port output" data-port-id="audio"></div>
            </div>
          </div>
          <div class="osc-mode-toggle" style="display:flex; justify-content:center; margin-bottom: 8px;">
            <div class="mini-segment" style="width: 100px;">
              <span class="segment active" data-mode="pitch">PITCH</span>
              <span class="segment" data-mode="freq">FREQ</span>
            </div>
          </div>
          <div class="pitch-container" style="display: flex; gap: 8px; justify-content: center; margin-bottom: 8px;">
            <div class="control-group oct-group"></div>
            <div class="control-group coarse-group"></div>
            <div class="control-group fine-group"></div>
          </div>
          <div class="freq-container" style="display: none; justify-content: center; margin-bottom: 8px;">
            <div class="control-group freq-group"></div>
          </div>
          <div class="select-container">
            <select class="type-sel">
              <option value="sine">Sine</option>
              <option value="square">Square</option>
              <option value="sawtooth">Saw</option>
              <option value="triangle">Triangle</option>
            </select>
          </div>
        `;
        moduleSetup = (container) => {
          const osc = audioNode as OscillatorModule;
          if (state) osc.state = { ...state };
          else osc.state = { octave: 0, semitone: 0, cents: 0, freq: 440, type: 'sine', mode: 'pitch' };

          // Handle legacy state patches that might only have "freq" instead of the new tuning arrays
          if (osc.state.octave === undefined) osc.state.octave = 0;
          if (osc.state.semitone === undefined) osc.state.semitone = 0;
          if (osc.state.cents === undefined) osc.state.cents = 0;
          if (osc.state.freq === undefined) osc.state.freq = 440;
          if (osc.state.mode === undefined) osc.state.mode = 'pitch';

          const pitchContainer = container.querySelector('.pitch-container') as HTMLElement;
          const freqContainer = container.querySelector('.freq-container') as HTMLElement;
          
          const octCg = container.querySelector('.oct-group') as HTMLElement;
          new Knob(octCg, 'OCT', -3, 3, osc.state.octave, (val) => {
            osc.setOctave(val);
            osc.state.octave = val;
          }, false, false, undefined, 1, 0);
          
          const coarseCg = container.querySelector('.coarse-group') as HTMLElement;
          new Knob(coarseCg, 'COARSE', -12, 12, osc.state.semitone, (val) => {
            osc.setSemitone(val);
            osc.state.semitone = val;
          }, false, false, undefined, 1, 0);
          
          const fineCg = container.querySelector('.fine-group') as HTMLElement;
          new Knob(fineCg, 'FINE', -100, 100, osc.state.cents, (val) => {
            osc.setCents(val);
            osc.state.cents = val;
          }, false, false, undefined, undefined, 0);

          const freqCg = container.querySelector('.freq-group') as HTMLElement;
          new Knob(freqCg, 'FREQ', 0.1, 2000, osc.state.freq, (val) => {
            osc.setFreq(val);
            osc.state.freq = val;
          }, true, !!osc.state.freqLog, (isLog) => {
            osc.state.freqLog = isLog;
          }, undefined, 440);

          // Mode Toggle UI
          const modeToggle = container.querySelector('.osc-mode-toggle .mini-segment') as HTMLElement;
          const setUIMode = (mode: 'pitch' | 'freq') => {
            const pSeg = modeToggle.querySelector('[data-mode="pitch"]')!;
            const fSeg = modeToggle.querySelector('[data-mode="freq"]')!;
            if (mode === 'pitch') {
              pSeg.classList.add('active'); fSeg.classList.remove('active');
              pitchContainer.style.display = 'flex';
              freqContainer.style.display = 'none';
            } else {
              fSeg.classList.add('active'); pSeg.classList.remove('active');
              pitchContainer.style.display = 'none';
              freqContainer.style.display = 'flex';
            }
          };

          modeToggle.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('segment')) {
              const newMode = target.getAttribute('data-mode') as 'pitch' | 'freq';
              osc.setMode(newMode);
              osc.state.mode = newMode;
              setUIMode(newMode);
            }
          });
          
          // Initial push to engine
          osc.setOctave(osc.state.octave);
          osc.setSemitone(osc.state.semitone);
          osc.setCents(osc.state.cents);
          osc.setFreq(osc.state.freq);
          osc.setMode(osc.state.mode);
          setUIMode(osc.state.mode);
          
          const sel = container.querySelector('.type-sel') as HTMLSelectElement;
          sel.value = osc.state.type;
          sel.addEventListener('change', () => {
            osc.setType(sel.value as OscillatorType);
            osc.state.type = sel.value;
          });
          
          osc.start();
        };
        break;

      case 'filter':
        audioNode = new FilterModule();
        title = 'Filter';
        bodyHTML = `
          <div class="ports">
            <div class="port-container"><div class="port input" data-port-id="audio"></div><span class="label">IN</span></div>
            <div class="port-container"><span class="label">OUT</span><div class="port output" data-port-id="audio"></div></div>
          </div>
          <div class="ports" style="justify-content: flex-start; margin-bottom: 8px; flex-direction: column; gap: 8px;">
            <div class="port-container" style="flex-direction:row; align-items:center;">
              <div class="port input cv" data-port-id="cutoff"></div><span class="label" style="font-size:9px; margin-left:4px;">CV CUT</span>
            </div>
            <div class="port-container" style="flex-direction:row; align-items:center;">
              <div class="port input cv" data-port-id="res"></div><span class="label" style="font-size:9px; margin-left:4px;">CV RES</span>
            </div>
          </div>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <div class="control-group freq-group"></div>
            <div class="control-group res-group"></div>
          </div>
          <div class="select-container">
            <select class="type-sel">
              <option value="lowpass">Lowpass</option>
              <option value="highpass">Highpass</option>
              <option value="bandpass">Band</option>
            </select>
          </div>
        `;
        moduleSetup = (container) => {
          const filt = audioNode as FilterModule;
          if (state) filt.state = { ...state };
          else filt.state = { cutoff: 1000, res: 1, type: 'lowpass' };

          const freqCg = container.querySelector('.freq-group') as HTMLElement;
          new Knob(freqCg, 'CUTOFF', 20, 10000, filt.state.cutoff, (val) => {
            filt.setFrequency(val);
            filt.state.cutoff = val;
          }, true, !!filt.state.cutoffLog, (isLog) => {
            filt.state.cutoffLog = isLog;
          }, undefined, 1000);
          
          const resCg = container.querySelector('.res-group') as HTMLElement;
          new Knob(resCg, 'RES', 0, 20, filt.state.res, (val) => {
            filt.setResonance(val);
            filt.state.res = val;
          }, false, false, undefined, undefined, 1);

          const sel = container.querySelector('.type-sel') as HTMLSelectElement;
          sel.value = filt.state.type;
          sel.addEventListener('change', () => {
            filt.setType(sel.value as BiquadFilterType);
            filt.state.type = sel.value;
          });
        };
        break;

      case 'delay':
        audioNode = new DelayModule();
        title = 'Delay';
        bodyHTML = `
          <div class="ports">
            <div class="port-container"><div class="port input" data-port-id="audio"></div><span class="label">IN</span></div>
            <div class="port-container"><span class="label">OUT</span><div class="port output" data-port-id="audio"></div></div>
          </div>
          <div class="ports" style="justify-content: center; margin-bottom: 8px; gap: 8px;">
            <div class="port-container" style="align-items:center;">
              <div class="port input cv" data-port-id="time"></div>
            </div>
            <div class="port-container" style="align-items:center;">
              <div class="port input cv" data-port-id="feedback"></div>
            </div>
            <div class="port-container" style="align-items:center;">
              <div class="port input cv" data-port-id="mix"></div>
            </div>
          </div>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <div class="control-group time-group"></div>
            <div class="control-group fb-group"></div>
            <div class="control-group mix-group"></div>
          </div>
        `;
        moduleSetup = (container) => {
          const del = audioNode as DelayModule;
          if (state) del.state = { ...state };
          else del.state = { time: 0.4, feedback: 0.4, mix: 0.5 };

          new Knob(container.querySelector('.time-group') as HTMLElement, 'TIME', 0.0, 2.0, del.state.time, (val) => {
            del.setTime(val);
            del.state.time = val;
          }, false, false, undefined, undefined, 0.4);
          new Knob(container.querySelector('.fb-group') as HTMLElement, 'FEEDBACK', 0.0, 1.0, del.state.feedback, (val) => {
            del.setFeedback(val);
            del.state.feedback = val;
          }, false, false, undefined, undefined, 0.4);
          new Knob(container.querySelector('.mix-group') as HTMLElement, 'MIX', 0.0, 1.0, del.state.mix, (val) => {
            del.setMix(val);
            del.state.mix = val;
          }, false, false, undefined, undefined, 0.5);
        };
        break;

      case 'gain':
        audioNode = new GainModule();
        title = 'Gain';
        bodyHTML = `
          <div class="ports">
            <div class="port-container"><div class="port input" data-port-id="audio"></div><span class="label">IN</span></div>
            <div class="port-container"><span class="label">OUT</span><div class="port output" data-port-id="audio"></div></div>
          </div>
          <div class="ports" style="justify-content: center; margin-bottom: 8px;">
            <div class="port input cv" data-port-id="level"></div>
          </div>
          <div class="control-group"></div>
        `;
        moduleSetup = (container) => {
          const gn = audioNode as GainModule;
          if (state) gn.state = { ...state };
          else gn.state = { level: 0.5 };

          new Knob(container.querySelector('.control-group') as HTMLElement, 'LEVEL', 0.0, 2.0, gn.state.level, (val) => {
            gn.setGain(val);
            gn.state.level = val;
          }, false, false, undefined, undefined, 0.5);
        };
        break;

      case 'adsr':
        audioNode = new AdsrModule();
        title = 'ADSR Element';
        bodyHTML = `
          <div class="ports">
            <!-- ADSR has no audio input, only CV output -->
            <div></div> 
            <div class="port-container" style="justify-content: flex-end;">
              <span class="label">OUT</span>
              <div class="port output cv" data-port-id="audio"></div>
            </div>
          </div>

          <button class="gate-btn control-btn primary" style="width: 100%; margin-top: 8px; justify-content: center; font-size: 10px;">GATE (HOLD)</button>

          <div style="display: flex; gap: 8px; justify-content: space-between; margin-top: 8px;">
            <div class="control-group a-group"></div>
            <div class="control-group d-group"></div>
            <div class="control-group s-group"></div>
            <div class="control-group r-group"></div>
          </div>
        `;

        moduleSetup = (container) => {
          const adsr = audioNode as AdsrModule;
          if (state) adsr.state = { ...state };
          else adsr.state = { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.5 };

          const aCg = container.querySelector('.a-group') as HTMLElement;
          new Knob(aCg, 'A', 0.01, 5.0, adsr.state.attack, (val) => {
            adsr.setAttack(val);
            adsr.state.attack = val;
          }, false, false, undefined, undefined, 0.1);
          
          const dCg = container.querySelector('.d-group') as HTMLElement;
          new Knob(dCg, 'D', 0.01, 5.0, adsr.state.decay, (val) => {
            adsr.setDecay(val);
            adsr.state.decay = val;
          }, false, false, undefined, undefined, 0.2);

          const sCg = container.querySelector('.s-group') as HTMLElement;
          new Knob(sCg, 'S', 0.0, 1.0, adsr.state.sustain, (val) => {
            adsr.setSustain(val);
            adsr.state.sustain = val;
          }, false, false, undefined, undefined, 0.5);

          const rCg = container.querySelector('.r-group') as HTMLElement;
          new Knob(rCg, 'R', 0.01, 5.0, adsr.state.release, (val) => {
            adsr.setRelease(val);
            adsr.state.release = val;
          }, false, false, undefined, undefined, 0.5);

          // Gate Button Logic
          const gateBtn = container.querySelector('.gate-btn') as HTMLElement;
          
          const handleAttack = () => {
            gateBtn.classList.add('active');
            adsr.triggerAttack();
          };
          
          const handleRelease = () => {
            gateBtn.classList.remove('active');
            adsr.triggerRelease();
          };
          
          gateBtn.addEventListener('mousedown', handleAttack);
          gateBtn.addEventListener('mouseup', handleRelease);
          gateBtn.addEventListener('mouseleave', handleRelease);

          adsr.setAttack(adsr.state.attack);
          adsr.setDecay(adsr.state.decay);
          adsr.setSustain(adsr.state.sustain);
          adsr.setRelease(adsr.state.release);
        };
        break;

      case 'lfo':
        audioNode = new LfoModule();
        title = 'LFO';
        bodyHTML = `
          <div class="ports">
            <div></div> 
            <div class="port-container" style="justify-content: flex-end;">
              <span class="label">OUT</span>
              <div class="port output cv" data-port-id="audio"></div>
            </div>
          </div>
          <div style="display: flex; gap: 12px; justify-content: center; margin-top: 8px;">
            <div class="control-group rate-group"></div>
            <div class="control-group depth-group"></div>
          </div>
          <div class="select-container" style="margin-top: 8px;">
            <select class="type-sel">
              <option value="sine">Sine</option>
              <option value="square">Square</option>
              <option value="sawtooth">Saw</option>
              <option value="triangle">Triangle</option>
            </select>
          </div>
        `;
        
        moduleSetup = (container) => {
          const lfo = audioNode as LfoModule;
          if (state) lfo.state = { ...state };
          else lfo.state = { rate: 1.0, depth: 0.5, type: 'sine' };

          const rateCg = container.querySelector('.rate-group') as HTMLElement;
          new Knob(rateCg, 'RATE', 0.1, 50.0, lfo.state.rate, (val) => {
            lfo.setRate(val);
            lfo.state.rate = val;
          }, true, true, undefined, undefined, 1.0);
          
          const depthCg = container.querySelector('.depth-group') as HTMLElement;
          new Knob(depthCg, 'DEPTH', 0.0, 1.0, lfo.state.depth, (val) => {
            lfo.setDepth(val);
            lfo.state.depth = val;
          }, false, false, undefined, undefined, 0.5);

          const sel = container.querySelector('.type-sel') as HTMLSelectElement;
          sel.value = lfo.state.type;
          sel.addEventListener('change', () => {
            lfo.setType(sel.value as OscillatorType);
            lfo.state.type = sel.value;
          });
          
          lfo.start();
        };
        break;

      default:
        return;
    }

    if (!audioNode) return;

    if (id) {
      audioNode.id = id;
    }

    el.innerHTML = `
      <div class="module-header">
        <h3>${title}</h3>
        <span class="module-close">×</span>
      </div>
      <div class="module-body">
        ${bodyHTML}
      </div>
    `;

    ws.addModule(audioNode, el, x, y);
    moduleSetup(el);
  }
});

declare global {
  interface Window {
    _workspace: Workspace;
    _createModule: (type: string, id?: string, xPos?: number, yPos?: number, state?: Record<string, any>) => void;
  }
}
