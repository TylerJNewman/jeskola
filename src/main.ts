import './style.css';
import { audioEngine } from './audio/AudioEngine';
import { OscillatorModule } from './audio/nodes/OscillatorModule';
import { FilterModule } from './audio/nodes/FilterModule';
import { DelayModule } from './audio/nodes/DelayModule';
import { GainModule } from './audio/nodes/GainModule';
import { MasterNode } from './audio/nodes/MasterNode';
import { ModularNode } from './audio/nodes/ModularNode';
import { Workspace } from './ui/Workspace';
import { Knob } from './ui/Knob';

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
    a.click();
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

  // Prepend buttons to controls area
  const controlsDiv = document.querySelector('.controls');
  if (controlsDiv) {
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
    ws.addModule(master, el, window.innerWidth - 200, window.innerHeight / 2 - 50);
    window._workspace = ws; // Save to global scope for module creation
  }

  function createModule(type: string, id?: string, xPos?: number, yPos?: number, state?: Record<string, any>) {
    const ws = getWorkspace();
    if (!ws) return;

    let audioNode: ModularNode | undefined;
    let title = '';
    let bodyHTML = '';
    
    // For manual creation vs loading
    let x = xPos !== undefined ? xPos : 220 + (moduleCount * 20);
    let y = yPos !== undefined ? yPos : 100 + (moduleCount * 20);
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
              <span class="label" style="font-size:9px; margin-left:4px;">CV FREQ</span>
            </div>
            <div class="port-container">
              <span class="label">OUT</span>
              <div class="port output" data-port-id="audio"></div>
            </div>
          </div>
          <div class="control-group"></div>
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
          else osc.state = { freq: 440, type: 'sine' };

          const cg = container.querySelector('.control-group') as HTMLElement;
          new Knob(cg, 'FREQ', 0.1, 2000, osc.state.freq, (val) => {
            osc.setFrequency(val);
            osc.state.freq = val;
          }, true);
          
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
          }, true);
          
          const resCg = container.querySelector('.res-group') as HTMLElement;
          new Knob(resCg, 'RES', 0, 20, filt.state.res, (val) => {
            filt.setResonance(val);
            filt.state.res = val;
          });

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
          });
          new Knob(container.querySelector('.fb-group') as HTMLElement, 'FEEDBACK', 0.0, 1.0, del.state.feedback, (val) => {
            del.setFeedback(val);
            del.state.feedback = val;
          });
          new Knob(container.querySelector('.mix-group') as HTMLElement, 'MIX', 0.0, 1.0, del.state.mix, (val) => {
            del.setMix(val);
            del.state.mix = val;
          });
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
          });
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
