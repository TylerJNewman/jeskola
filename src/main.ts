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

  function createMasterModule(ws: Workspace) {
    const master = new MasterNode();
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

  function createModule(type: string) {
    const ws = getWorkspace();
    if (!ws) return;

    let audioNode: ModularNode | undefined;
    let title = '';
    let bodyHTML = '';
    let x = 220 + (moduleCount * 20);
    let y = 100 + (moduleCount * 20);
    moduleCount++;

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
          const cg = container.querySelector('.control-group') as HTMLElement;
          new Knob(cg, 'FREQ', 0.1, 2000, 440, (val) => osc.setFrequency(val), true);
          
          const sel = container.querySelector('.type-sel') as HTMLSelectElement;
          sel.addEventListener('change', () => osc.setType(sel.value as OscillatorType));
          
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
          const freqCg = container.querySelector('.freq-group') as HTMLElement;
          new Knob(freqCg, 'CUTOFF', 20, 10000, 1000, (val) => filt.setFrequency(val), true);
          
          const resCg = container.querySelector('.res-group') as HTMLElement;
          new Knob(resCg, 'RES', 0, 20, 1, (val) => filt.setResonance(val));

          const sel = container.querySelector('.type-sel') as HTMLSelectElement;
          sel.addEventListener('change', () => filt.setType(sel.value as BiquadFilterType));
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
          new Knob(container.querySelector('.time-group') as HTMLElement, 'TIME', 0.0, 2.0, 0.4, (val) => del.setTime(val));
          new Knob(container.querySelector('.fb-group') as HTMLElement, 'FEEDBACK', 0.0, 1.0, 0.4, (val) => del.setFeedback(val));
          new Knob(container.querySelector('.mix-group') as HTMLElement, 'MIX', 0.0, 1.0, 0.5, (val) => del.setMix(val));
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
          new Knob(container.querySelector('.control-group') as HTMLElement, 'LEVEL', 0.0, 2.0, 0.5, (val) => gn.setGain(val));
        };
        break;

      default:
        return;
    }

    if (!audioNode) return;

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
  }
}
