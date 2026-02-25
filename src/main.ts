import './style.css';
import { audioEngine } from './audio/AudioEngine';
import { OscillatorModule } from './audio/nodes/OscillatorModule';
import { FilterModule } from './audio/nodes/FilterModule';
import { DelayModule } from './audio/nodes/DelayModule';
import { DistortionModule } from './audio/nodes/DistortionModule';
import { GainModule } from './audio/nodes/GainModule';
import { AdsrModule } from './audio/nodes/AdsrModule';
import { LfoModule } from './audio/nodes/LfoModule';
import { MasterNode } from './audio/nodes/MasterNode';
import { ModularNode } from './audio/nodes/ModularNode';
import { Workspace } from './ui/Workspace';
import { Knob } from './ui/Knob';
import {
  PRESETS,
  PRESET_LABELS,
  PRESET_ORDER,
  RECIPES,
  RECIPE_LABELS,
  RECIPE_ORDER,
  RECIPE_DESCRIPTIONS,
  RECIPE_MORPH_LABELS,
  STACK_BASE_ORDER,
  STACK_BASE_LABELS,
  STACK_MODIFIER_ORDER,
  STACK_MODIFIER_LABELS,
  buildStackedPreset,
  buildRecipePreset
} from './presets';
import { transport } from './audio/Transport';
import { SequencerModule } from './audio/nodes/SequencerModule';
import { NO_VALUE, midiToNoteName } from './audio/sequencer/types';

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
  const defaultPresetOpt = document.createElement('option');
  defaultPresetOpt.value = '';
  defaultPresetOpt.textContent = 'Select a Preset...';
  presetSelect.appendChild(defaultPresetOpt);

  PRESET_ORDER.forEach((key) => {
    if (!PRESETS[key]) return;
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = PRESET_LABELS[key] || key;
    presetSelect.appendChild(opt);
  });

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

  const stackBaseSelect = document.createElement('select');
  stackBaseSelect.className = 'select-preset';
  stackBaseSelect.style.marginRight = '8px';
  stackBaseSelect.style.padding = '4px';
  stackBaseSelect.style.backgroundColor = 'var(--panel-bg)';
  stackBaseSelect.style.color = 'var(--text-light)';
  stackBaseSelect.style.border = '1px solid var(--border-color)';

  STACK_BASE_ORDER.forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = STACK_BASE_LABELS[key] || key;
    stackBaseSelect.appendChild(opt);
  });

  const createStackModifierSelect = (title: string) => {
    const sel = document.createElement('select');
    sel.className = 'select-preset';
    sel.title = title;
    sel.style.marginRight = '8px';
    sel.style.padding = '4px';
    sel.style.backgroundColor = 'var(--panel-bg)';
    sel.style.color = 'var(--text-light)';
    sel.style.border = '1px solid var(--border-color)';

    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = title;
    sel.appendChild(emptyOpt);

    STACK_MODIFIER_ORDER.forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = STACK_MODIFIER_LABELS[key] || key;
      sel.appendChild(opt);
    });
    return sel;
  };

  const stackModifierSelectA = createStackModifierSelect('Modifier 1');
  const stackModifierSelectB = createStackModifierSelect('Modifier 2');
  const stackModifierSelectC = createStackModifierSelect('Modifier 3');

  const STACK_PRESET_COMBOS: Array<{ label: string; baseKey: string; modifiers: string[] }> = [
    { label: 'Acid Movement', baseKey: 'acid-drive', modifiers: ['slow-wobble', 'envelope-pump'] },
    { label: 'Dub Motion Bus', baseKey: 'dub-chord-echo', modifiers: ['slow-wobble', 'drive-boost'] },
    { label: 'Mono Lead Plus', baseKey: 'classic-mono-lead', modifiers: ['slow-wobble', 'envelope-pump'] },
    { label: 'Sub Heavy Wobble', baseKey: 'sub-bass', modifiers: ['drive-boost', 'slow-wobble'] },
    { label: 'FM Space Bell', baseKey: 'electro-fm-bell', modifiers: ['wide-echo'] }
  ];

  const stackPresetSelect = document.createElement('select');
  stackPresetSelect.className = 'select-preset stack-preset-select';
  stackPresetSelect.title = 'Try a ready-made stack combination';
  const stackPresetDefaultOpt = document.createElement('option');
  stackPresetDefaultOpt.value = '';
  stackPresetDefaultOpt.textContent = 'Try a Stack Preset...';
  stackPresetSelect.appendChild(stackPresetDefaultOpt);
  STACK_PRESET_COMBOS.forEach((combo, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = combo.label;
    stackPresetSelect.appendChild(opt);
  });

  const applyStackFromControls = () => {
    const ws = getWorkspace();
    if (!ws) return;

    const baseKey = stackBaseSelect.value;
    const modifierKeysRaw = [
      stackModifierSelectA.value,
      stackModifierSelectB.value,
      stackModifierSelectC.value
    ].filter((v) => v.length > 0);
    const modifierKeys = Array.from(new Set(modifierKeysRaw));

    let stacked;
    try {
      stacked = buildStackedPreset(baseKey, modifierKeys);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown stack build error';
      window.alert(`Could not build stack: ${message}`);
      return;
    }

    ensureInitialized().then(() => {
      ws.importState(stacked.json);
    });
  };

  const loadStackBtn = document.createElement('button');
  loadStackBtn.className = 'control-btn';
  loadStackBtn.innerHTML = '<span>LOAD STACK</span>';
  loadStackBtn.style.marginRight = '8px';
  loadStackBtn.addEventListener('click', applyStackFromControls);

  const loadStackPresetBtn = document.createElement('button');
  loadStackPresetBtn.className = 'control-btn';
  loadStackPresetBtn.innerHTML = '<span>LOAD STACK PRESET</span>';
  loadStackPresetBtn.style.marginRight = '8px';
  loadStackPresetBtn.addEventListener('click', () => {
    const rawIndex = stackPresetSelect.value;
    if (rawIndex === '') return;
    const index = Number(rawIndex);
    const combo = STACK_PRESET_COMBOS[index];
    if (!combo) return;

    stackBaseSelect.value = combo.baseKey;
    stackModifierSelectA.value = combo.modifiers[0] || '';
    stackModifierSelectB.value = combo.modifiers[1] || '';
    stackModifierSelectC.value = combo.modifiers[2] || '';
    applyStackFromControls();
  });

  const stackHint = document.createElement('span');
  stackHint.className = 'toolbar-hint';
  stackHint.textContent = 'Pick base + modifiers, or use a Stack Preset.';

  const recipeSelect = document.createElement('select');
  recipeSelect.className = 'select-preset';
  recipeSelect.style.marginRight = '8px';
  recipeSelect.style.padding = '4px';
  recipeSelect.style.backgroundColor = 'var(--panel-bg)';
  recipeSelect.style.color = 'var(--text-light)';
  recipeSelect.style.border = '1px solid var(--border-color)';

  const defaultRecipeOpt = document.createElement('option');
  defaultRecipeOpt.value = '';
  defaultRecipeOpt.textContent = 'Select a Recipe...';
  recipeSelect.appendChild(defaultRecipeOpt);

  RECIPE_ORDER.forEach((key) => {
    if (!RECIPES[key]) return;
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = RECIPE_LABELS[key] || key;
    opt.title = RECIPE_DESCRIPTIONS[key] || '';
    recipeSelect.appendChild(opt);
  });

  const refreshRecipeDescription = () => {
    const key = recipeSelect.value;
    recipeSelect.title = key ? (RECIPE_DESCRIPTIONS[key] || '') : '';
  };
  recipeSelect.addEventListener('change', refreshRecipeDescription);
  refreshRecipeDescription();

  const loadRecipeBtn = document.createElement('button');
  loadRecipeBtn.className = 'control-btn';
  loadRecipeBtn.innerHTML = '<span>LOAD RECIPE</span>';
  loadRecipeBtn.style.marginRight = '8px';
  const recipeMorphWrap = document.createElement('label');
  recipeMorphWrap.style.display = 'inline-flex';
  recipeMorphWrap.style.alignItems = 'center';
  recipeMorphWrap.style.gap = '6px';
  recipeMorphWrap.style.marginRight = '8px';

  const recipeMorphText = document.createElement('span');
  recipeMorphText.style.fontSize = '11px';
  recipeMorphText.textContent = 'Morph';

  const recipeMorphSlider = document.createElement('input');
  recipeMorphSlider.type = 'range';
  recipeMorphSlider.min = '0';
  recipeMorphSlider.max = '100';
  recipeMorphSlider.step = '1';
  recipeMorphSlider.value = '0';
  recipeMorphSlider.style.width = '140px';
  recipeMorphSlider.disabled = true;

  recipeMorphWrap.appendChild(recipeMorphText);
  recipeMorphWrap.appendChild(recipeMorphSlider);

  let activeRecipeKey = '';
  let morphTimer: number | null = null;

  const updateRecipeMorphUi = () => {
    const hasRecipe = !!recipeSelect.value;
    recipeMorphSlider.disabled = !hasRecipe;
    const key = recipeSelect.value;
    recipeMorphText.textContent = key ? (RECIPE_MORPH_LABELS[key] || 'Morph') : 'Morph';
  };

  const applyActiveRecipeMorph = () => {
    const ws = getWorkspace();
    if (!ws || !activeRecipeKey) return;
    const morphAmount = Number(recipeMorphSlider.value) / 100;
    try {
      const built = buildRecipePreset(activeRecipeKey, morphAmount);
      ws.importState(built.json);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown recipe morph error';
      window.alert(`Could not morph recipe: ${message}`);
    }
  };

  recipeMorphSlider.addEventListener('input', () => {
    if (!activeRecipeKey) return;
    if (morphTimer !== null) {
      window.clearTimeout(morphTimer);
    }
    morphTimer = window.setTimeout(() => {
      applyActiveRecipeMorph();
      morphTimer = null;
    }, 50);
  });

  recipeSelect.addEventListener('change', () => {
    if (!recipeSelect.value) {
      activeRecipeKey = '';
      recipeMorphSlider.value = '0';
    }
    updateRecipeMorphUi();
  });
  updateRecipeMorphUi();

  loadRecipeBtn.addEventListener('click', () => {
    const val = recipeSelect.value;
    if (val && RECIPES[val]) {
      const ws = getWorkspace();
      if (ws) {
        activeRecipeKey = val;
        ensureInitialized().then(() => {
          applyActiveRecipeMorph();
        });
      }
    }
  });

  // --- TRANSPORT CONTROLS ---
  const transportPlayBtn = document.createElement('button');
  transportPlayBtn.className = 'control-btn transport-btn';
  transportPlayBtn.innerHTML = '<span>&#9654; PLAY</span>';
  transportPlayBtn.style.marginRight = '4px';
  transportPlayBtn.addEventListener('click', async () => {
    if (!initialized) await ensureInitialized();
    if (transport.isPlaying) {
      transport.stop();
      transportPlayBtn.innerHTML = '<span>&#9654; PLAY</span>';
      transportPlayBtn.classList.remove('primary');
    } else {
      transport.play();
      transportPlayBtn.innerHTML = '<span>&#9632; STOP</span>';
      transportPlayBtn.classList.add('primary');
    }
  });

  const bpmInput = document.createElement('input');
  bpmInput.type = 'number';
  bpmInput.id = 'bpm-input';
  bpmInput.className = 'bpm-input';
  bpmInput.value = '120';
  bpmInput.min = '20';
  bpmInput.max = '300';
  bpmInput.title = 'BPM';
  bpmInput.addEventListener('change', () => {
    transport.setBpm(parseInt(bpmInput.value, 10) || 120);
  });
  bpmInput.addEventListener('input', () => {
    transport.setBpm(parseInt(bpmInput.value, 10) || 120);
  });

  const bpmLabel = document.createElement('span');
  bpmLabel.className = 'bpm-label';
  bpmLabel.textContent = 'BPM';

  const tier1Global = document.querySelector('.tier1-global');
  const sectionChips = document.querySelector('.toolbar-section-chips');
  const sectionPanels = document.querySelector('.toolbar-sections');

  if (tier1Global && sectionChips && sectionPanels) {
    const transportGroup = document.createElement('div');
    transportGroup.className = 'toolbar-group toolbar-group-transport';
    transportGroup.append(transportPlayBtn, bpmInput, bpmLabel);

    const fileGroup = document.createElement('div');
    fileGroup.className = 'toolbar-group toolbar-group-file';
    fileGroup.append(saveBtn, loadBtn, loadFileBtn);

    const audioGroup = document.createElement('div');
    audioGroup.className = 'toolbar-group toolbar-group-audio';
    audioGroup.appendChild(startBtn);

    tier1Global.replaceChildren(transportGroup, fileGroup, audioGroup);

    type ToolbarSectionKey = 'recipe' | 'preset' | 'stack';
    const activeSectionDefault: ToolbarSectionKey = 'recipe';
    let activeSection: ToolbarSectionKey = activeSectionDefault;

    const chips = new Map<ToolbarSectionKey, HTMLButtonElement>();
    const panels = new Map<ToolbarSectionKey, HTMLElement>();

    const createSectionChip = (key: ToolbarSectionKey, label: string) => {
      const chip = document.createElement('button');
      chip.className = 'toolbar-section-chip';
      chip.setAttribute('data-section', key);
      chip.textContent = label;
      chip.addEventListener('click', () => setActiveSection(key));
      chips.set(key, chip);
      return chip;
    };

    const createSectionPanel = (key: ToolbarSectionKey) => {
      const panel = document.createElement('div');
      panel.className = 'toolbar-section-panel';
      panel.setAttribute('data-section', key);
      panels.set(key, panel);
      return panel;
    };

    const recipeChip = createSectionChip('recipe', 'Recipe');
    const presetChip = createSectionChip('preset', 'Preset');
    const stackChip = createSectionChip('stack', 'Stack');
    sectionChips.replaceChildren(recipeChip, presetChip, stackChip);

    const recipePanel = createSectionPanel('recipe');
    recipePanel.append(recipeSelect, loadRecipeBtn, recipeMorphWrap);

    const presetPanel = createSectionPanel('preset');
    presetPanel.append(presetSelect, loadPresetBtn);

    const stackPanel = createSectionPanel('stack');
    stackPanel.append(
      stackPresetSelect,
      loadStackPresetBtn,
      stackBaseSelect,
      stackModifierSelectA,
      stackModifierSelectB,
      stackModifierSelectC,
      loadStackBtn,
      stackHint
    );

    sectionPanels.replaceChildren(recipePanel, presetPanel, stackPanel);

    const compactMq = window.matchMedia('(max-width: 1400px)');

    const syncSectionVisibility = () => {
      const isCompact = compactMq.matches;
      document.body.classList.toggle('toolbar-compact', isCompact);
      (['recipe', 'preset', 'stack'] as ToolbarSectionKey[]).forEach((key) => {
        const chip = chips.get(key);
        const panel = panels.get(key);
        if (!chip || !panel) return;
        const isActive = key === activeSection;
        chip.classList.toggle('active', isActive);
        panel.classList.toggle('active', isActive);
        panel.classList.toggle('hidden', isCompact && !isActive);
      });
    };

    const setActiveSection = (key: ToolbarSectionKey) => {
      activeSection = key;
      syncSectionVisibility();
    };

    compactMq.addEventListener('change', syncSectionVisibility);
    setActiveSection(activeSectionDefault);
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

  function createModule(type: string, id?: string, xPos?: number, yPos?: number, state?: Record<string, any>): boolean {
    const ws = getWorkspace();
    if (!ws) return false;

    let audioNode: ModularNode | undefined;
    let title = '';
    let bodyHTML = '';
    
    // For manual creation vs loading
    let x = xPos !== undefined ? xPos : 30 + (moduleCount * 20);
    let y = yPos !== undefined ? yPos : 112 + (moduleCount * 20);
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
          osc.setType(osc.state.type as OscillatorType);
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

          filt.setFrequency(filt.state.cutoff);
          filt.setResonance(filt.state.res);

          const sel = container.querySelector('.type-sel') as HTMLSelectElement;
          sel.value = filt.state.type;
          filt.setType(filt.state.type as BiquadFilterType);
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

          del.setTime(del.state.time);
          del.setFeedback(del.state.feedback);
          del.setMix(del.state.mix);
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

          gn.setGain(gn.state.level);
        };
        break;

      case 'distortion':
        audioNode = new DistortionModule();
        title = 'Distortion';
        bodyHTML = `
          <div class="ports">
            <div class="port-container"><div class="port input" data-port-id="audio"></div><span class="label">IN</span></div>
            <div class="port-container"><span class="label">OUT</span><div class="port output" data-port-id="audio"></div></div>
          </div>
          <div class="ports" style="justify-content: center; margin-bottom: 8px; gap: 8px;">
            <div class="port-container" style="align-items:center;">
              <div class="port input cv" data-port-id="drive"></div>
            </div>
            <div class="port-container" style="align-items:center;">
              <div class="port input cv" data-port-id="mix"></div>
            </div>
          </div>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <div class="control-group drive-group"></div>
            <div class="control-group mix-group"></div>
            <div class="control-group out-group"></div>
          </div>
        `;
        moduleSetup = (container) => {
          const dist = audioNode as DistortionModule;
          if (state) dist.state = { ...state };
          else dist.state = { drive: 1.0, mix: 0.5, output: 0.8 };

          if (dist.state.drive === undefined) dist.state.drive = 1.0;
          if (dist.state.mix === undefined) dist.state.mix = 0.5;
          if (dist.state.output === undefined) dist.state.output = 0.8;

          new Knob(container.querySelector('.drive-group') as HTMLElement, 'DRIVE', 0.5, 20.0, dist.state.drive, (val) => {
            dist.setDrive(val);
            dist.state.drive = val;
          }, true, !!dist.state.driveLog, (isLog) => {
            dist.state.driveLog = isLog;
          }, undefined, 1.0);
          new Knob(container.querySelector('.mix-group') as HTMLElement, 'MIX', 0.0, 1.0, dist.state.mix, (val) => {
            dist.setMix(val);
            dist.state.mix = val;
          }, false, false, undefined, undefined, 0.5);
          new Knob(container.querySelector('.out-group') as HTMLElement, 'OUTPUT', 0.0, 2.0, dist.state.output, (val) => {
            dist.setOutput(val);
            dist.state.output = val;
          }, false, false, undefined, undefined, 0.8);

          dist.setDrive(dist.state.drive);
          dist.setMix(dist.state.mix);
          dist.setOutput(dist.state.output);
        };
        break;

      case 'adsr':
        audioNode = new AdsrModule();
        title = 'ADSR Element';
        bodyHTML = `
          <div class="ports">
            <div class="port-container">
              <div class="port input cv" data-port-id="gate"></div>
              <span class="label">GATE</span>
            </div>
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

          lfo.setRate(lfo.state.rate);
          lfo.setDepth(lfo.state.depth);

          const sel = container.querySelector('.type-sel') as HTMLSelectElement;
          sel.value = lfo.state.type;
          lfo.setType(lfo.state.type as OscillatorType);
          sel.addEventListener('change', () => {
            lfo.setType(sel.value as OscillatorType);
            lfo.state.type = sel.value;
          });

          lfo.start();
        };
        break;

      case 'sequencer': {
        audioNode = new SequencerModule();
        title = 'Sequencer';
        bodyHTML = `
          <div class="ports" style="justify-content: flex-end; gap: 28px; padding-right: 6px;">
            <div class="port-container">
              <span class="label">NOTE</span>
              <div class="port output cv" data-port-id="audio"></div>
            </div>
            <div class="port-container">
              <span class="label">GATE</span>
              <div class="port output cv" data-port-id="gate"></div>
            </div>
          </div>
          <div class="seq-controls">
            <span class="label" style="font-size:9px;">STEPS</span>
            <select class="seq-length-select">
              <option value="4">4</option>
              <option value="8">8</option>
              <option value="16" selected>16</option>
              <option value="32">32</option>
            </select>
          </div>
          <div class="seq-grid"></div>
          <div style="display: flex; gap: 12px; justify-content: center; margin-top: 8px;">
            <div class="control-group oct-group"></div>
            <div class="control-group gate-len-group"></div>
          </div>
        `;

        moduleSetup = (container) => {
          const seq = audioNode as SequencerModule;
          if (state) seq.state = { ...state };

          const grid = container.querySelector('.seq-grid') as HTMLElement;
          const lengthSelect = container.querySelector('.seq-length-select') as HTMLSelectElement;

          // Set the length select to match state
          lengthSelect.value = String(seq.pattern.length);

          let activePicker: HTMLElement | null = null;

          function closePicker() {
            if (activePicker) {
              activePicker.remove();
              activePicker = null;
            }
          }

          function renderGrid() {
            closePicker();
            grid.innerHTML = '';
            for (let i = 0; i < seq.pattern.length; i++) {
              const step = seq.pattern.steps[i];
              const cell = document.createElement('div');
              cell.className = 'seq-step' + (step.gate ? ' active' : '');
              cell.setAttribute('data-step', String(i));

              if (step.gate && step.note !== NO_VALUE) {
                cell.textContent = midiToNoteName(step.note);
              }

              // Left click: toggle gate
              cell.addEventListener('click', (e) => {
                e.stopPropagation();
                closePicker();
                if (step.gate) {
                  step.gate = false;
                  step.note = NO_VALUE;
                  cell.classList.remove('active');
                  cell.textContent = '';
                } else {
                  step.gate = true;
                  step.note = step.note === NO_VALUE ? 60 : step.note; // Default C4
                  step.velocity = 1.0;
                  cell.classList.add('active');
                  cell.textContent = midiToNoteName(step.note);
                }
              });

              // Right click: note picker
              cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!step.gate) return;
                closePicker();
                showNotePicker(cell, step, i);
              });

              // Scroll wheel: change note
              cell.addEventListener('wheel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!step.gate) return;
                const delta = e.deltaY < 0 ? 1 : -1;
                step.note = Math.max(0, Math.min(127, (step.note === NO_VALUE ? 60 : step.note) + delta));
                cell.textContent = midiToNoteName(step.note);
              });

              grid.appendChild(cell);
            }
          }

          function showNotePicker(cell: HTMLElement, step: typeof seq.pattern.steps[0], _stepIndex: number) {
            const picker = document.createElement('div');
            picker.className = 'seq-note-picker';

            const currentNote = step.note === NO_VALUE ? 60 : step.note;
            const currentOctave = Math.floor(currentNote / 12) - 1;
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

            // Octave selector row
            const octRow = document.createElement('div');
            octRow.style.cssText = 'display:flex; gap:2px; margin-bottom:4px; justify-content:center;';
            const octDown = document.createElement('button');
            octDown.textContent = '-';
            octDown.style.cssText = 'width:18px; font-size:10px;';
            const octLabel = document.createElement('span');
            octLabel.textContent = `Oct ${currentOctave}`;
            octLabel.style.cssText = 'font-size:8px; display:flex; align-items:center; color:var(--text-muted);';
            const octUp = document.createElement('button');
            octUp.textContent = '+';
            octUp.style.cssText = 'width:18px; font-size:10px;';

            let pickerOctave = currentOctave;
            const updatePicker = () => {
              octLabel.textContent = `Oct ${pickerOctave}`;
              picker.querySelectorAll('.note-btn').forEach((btn) => {
                const midi = parseInt(btn.getAttribute('data-midi') || '0');
                const newMidi = (pickerOctave + 1) * 12 + (midi % 12);
                btn.setAttribute('data-midi', String(newMidi));
                if (newMidi === step.note) btn.classList.add('selected');
                else btn.classList.remove('selected');
              });
            };

            octDown.addEventListener('click', (e) => { e.stopPropagation(); pickerOctave = Math.max(-1, pickerOctave - 1); updatePicker(); });
            octUp.addEventListener('click', (e) => { e.stopPropagation(); pickerOctave = Math.min(9, pickerOctave + 1); updatePicker(); });

            octRow.appendChild(octDown);
            octRow.appendChild(octLabel);
            octRow.appendChild(octUp);
            picker.appendChild(octRow);

            // Note buttons
            for (let n = 11; n >= 0; n--) {
              const midi = (pickerOctave + 1) * 12 + n;
              const btn = document.createElement('button');
              btn.className = 'note-btn' + (midi === currentNote ? ' selected' : '');
              btn.textContent = noteNames[n];
              btn.setAttribute('data-midi', String(midi));
              btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const midiVal = parseInt(btn.getAttribute('data-midi') || '60');
                step.note = Math.max(0, Math.min(127, midiVal));
                cell.textContent = midiToNoteName(step.note);
                closePicker();
              });
              picker.appendChild(btn);
            }

            cell.style.position = 'relative';
            cell.appendChild(picker);
            activePicker = picker;

            // Close picker on outside click
            const closeOnOutside = (e: MouseEvent) => {
              if (!picker.contains(e.target as Node) && e.target !== cell) {
                closePicker();
                document.removeEventListener('click', closeOnOutside);
              }
            };
            setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
          }

          renderGrid();

          // Length change
          lengthSelect.addEventListener('change', () => {
            seq.setPatternLength(parseInt(lengthSelect.value, 10));
            renderGrid();
          });

          // Knobs: octave offset, gate length
          const octCg = container.querySelector('.oct-group') as HTMLElement;
          new Knob(octCg, 'OCT', -3, 3, seq.octaveOffset, (val) => {
            seq.octaveOffset = val;
          }, false, false, undefined, 1, 0);

          const gateCg = container.querySelector('.gate-len-group') as HTMLElement;
          new Knob(gateCg, 'GATE', 0.05, 1.0, seq.gateLength, (val) => {
            seq.gateLength = val;
          }, false, false, undefined, undefined, 0.5);

          // Playhead animation
          let animFrameId: number | null = null;
          let lastHighlightedStep = -1;

          const updatePlayhead = () => {
            const step = seq.currentStep;
            if (step !== lastHighlightedStep) {
              // Remove old highlight
              if (lastHighlightedStep >= 0) {
                const oldCell = grid.children[lastHighlightedStep] as HTMLElement;
                if (oldCell) oldCell.classList.remove('playing');
              }
              // Add new highlight
              if (step >= 0 && step < grid.children.length) {
                const newCell = grid.children[step] as HTMLElement;
                if (newCell) newCell.classList.add('playing');
              }
              lastHighlightedStep = step;
            }
            animFrameId = requestAnimationFrame(updatePlayhead);
          };

          animFrameId = requestAnimationFrame(updatePlayhead);

          // Store dispose for cleanup
          const elAny = el as any;
          const originalDisposeUi = elAny._seqDispose;
          elAny._seqDispose = () => {
            if (originalDisposeUi) originalDisposeUi();
            if (animFrameId !== null) cancelAnimationFrame(animFrameId);
            closePicker();
          };
        };
        break;
      }

      default:
        return false;
    }

    if (!audioNode) return false;

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

    const disposeUi = () => {
      if ((el as any)._seqDispose) (el as any)._seqDispose();
    };
    const added = ws.addModule(audioNode, el, x, y, disposeUi);
    if (!added) {
      audioNode.destroy();
      return false;
    }
    moduleSetup(el);
    return true;
  }
});

declare global {
  interface Window {
    _workspace: Workspace;
    _createModule: (type: string, id?: string, xPos?: number, yPos?: number, state?: Record<string, any>) => boolean;
  }
}
