import { ModularNode } from '../audio/nodes/ModularNode';
import { transport } from '../audio/Transport';

export interface UIConnection {
  sourceModuleId: string;
  sourceType: 'output';
  targetModuleId: string;
  targetType: 'input';
  svgPath: SVGPathElement;
  sourcePortId?: string;
  targetPortId?: string;
}

export interface PatchModule {
  id: string;
  type: string;
  x: number;
  y: number;
  state: Record<string, unknown>;
}

export interface PatchConnection {
  sourceModuleId: string;
  targetModuleId: string;
  sourcePortId: string;
  targetPortId: string;
}

export interface PatchState {
  modules: PatchModule[];
  connections: PatchConnection[];
}

export interface ImportStateResult {
  modulesCreated: number;
  connectionsCreated: number;
  warnings: string[];
}

export type ApplyMode = 'replace' | 'add_chain' | 'add_modulation' | 'add_send' | 'add_layer';
export type ApplyTarget = 'before_module' | 'after_module' | 'parallel_to_module' | 'master_send' | 'auto';

export interface ApplyOptions {
  mode: ApplyMode;
  targetType?: ApplyTarget;
  targetModuleId?: string;
  safeRename?: boolean;
  dryRun?: boolean;
}

export interface ApplySummary {
  modulesAdded: number;
  connectionsAdded: number;
  routesRewired: number;
  idsRenamed: number;
  warnings: string[];
}

export interface ApplyStateResult extends ImportStateResult {
  summary: ApplySummary;
}

interface WorkspaceModule {
  audio: ModularNode;
  element: HTMLElement;
  disposeUi?: () => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clonePatchState(state: PatchState): PatchState {
  return JSON.parse(JSON.stringify(state)) as PatchState;
}

type PlannedConnection = {
  sourceModuleId: string;
  targetModuleId: string;
  sourcePortId: string;
  targetPortId: string;
};

type PlannedApply = {
  patch: PatchState;
  warnings: string[];
  idsRenamed: number;
  connectionsToRemove: PlannedConnection[];
  connectionsToAdd: PlannedConnection[];
};

export class Workspace {
  private container: HTMLElement;
  private cablesLayer: SVGSVGElement;
  private transform = { x: 0, y: 0, scale: 1 };
  private static MIN_SCALE = 0.15;
  private static MAX_SCALE = 2.0;

  private modules: Map<string, WorkspaceModule> = new Map();
  private connections: UIConnection[] = [];
  private importVersion = 0;

  // Dragging state
  private isPanning = false;
  private startPanX = 0;
  private startPanY = 0;

  // Connecting state
  private isConnecting = false;
  private tempSourcePort: HTMLElement | null = null;
  private tempCable: SVGPathElement | null = null;

  constructor(containerId: string, cablesLayerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement;
    this.cablesLayer = document.getElementById(cablesLayerId) as unknown as SVGSVGElement;

    this.initEvents();
  }

  public hasModule(id: string): boolean {
    if (this.modules.has(id)) return true;
    return !!this.container.querySelector(`.module[data-id="${id}"]`);
  }

  public listModules(): Array<{ id: string; type: string }> {
    return Array.from(this.modules.entries())
      .filter(([id]) => id !== 'master')
      .map(([id, data]) => ({ id, type: data.audio.type.toLowerCase() }));
  }

  public getModuleById<T extends ModularNode = ModularNode>(id: string): T | undefined {
    const module = this.modules.get(id);
    if (!module) return undefined;
    return module.audio as T;
  }

  public getModulesByType<T extends ModularNode = ModularNode>(type: string): T[] {
    const normalized = type.toLowerCase();
    return Array.from(this.modules.values())
      .map((entry) => entry.audio)
      .filter((audio) => audio.type.toLowerCase() === normalized) as T[];
  }

  private initEvents() {
    // Panning
    const handlePanStart = (clientX: number, clientY: number) => {
      this.isPanning = true;
      this.startPanX = clientX - this.transform.x;
      this.startPanY = clientY - this.transform.y;
    };

    this.container.addEventListener('mousedown', (e) => {
      if (e.target === this.container || e.target === this.cablesLayer) {
        handlePanStart(e.clientX, e.clientY);
      }
    });

    this.container.addEventListener('touchstart', (e) => {
      if (e.target === this.container || e.target === this.cablesLayer) {
        handlePanStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    const handlePanMove = (clientX: number, clientY: number) => {
      if (this.isPanning) {
        this.transform.x = clientX - this.startPanX;
        this.transform.y = clientY - this.startPanY;
        this.updateTransform();
        this.updateAllCables();
      }

      if (this.isConnecting && this.tempSourcePort && this.tempCable) {
        const sourceRect = this.tempSourcePort.getBoundingClientRect();
        const sourceX = sourceRect.left + sourceRect.width / 2;
        const sourceY = sourceRect.top + sourceRect.height / 2;

        this.drawCable(this.tempCable, sourceX, sourceY, clientX, clientY);
      }
    };

    window.addEventListener('mousemove', (e) => {
      handlePanMove(e.clientX, e.clientY);
    });

    window.addEventListener('touchmove', (e) => {
      if (this.isPanning || this.isConnecting) {
        e.preventDefault();
        handlePanMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    const handlePanEnd = (e: Event | MouseEvent) => {
      this.isPanning = false;

      if (this.isConnecting && this.tempCable) {
        let targetPort: HTMLElement | null = null;
        let p: HTMLElement | null = null;

        if ('changedTouches' in e && (e as TouchEvent).changedTouches.length > 0) {
          const touch = (e as TouchEvent).changedTouches[0];
          p = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
        } else {
          p = e.target as HTMLElement;
        }

        while (p && p !== document.body) {
          if (p.classList && p.classList.contains('port')) {
            targetPort = p;
            break;
          }
          p = p.parentElement as HTMLElement;
        }

        if (targetPort && this.tempSourcePort) {
          this.attemptConnection(this.tempSourcePort, targetPort);
        }

        this.tempCable.remove();
        this.tempCable = null;
        this.isConnecting = false;
        this.tempSourcePort = null;
      }
    };

    window.addEventListener('mouseup', handlePanEnd);
    window.addEventListener('touchend', handlePanEnd);
    window.addEventListener('touchcancel', handlePanEnd);

    // Zoom (scroll wheel / trackpad pinch)
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();

      // Get cursor position relative to viewport
      const rect = this.container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      // Determine zoom factor
      const delta = e.ctrlKey ? -e.deltaY * 0.01 : -e.deltaY * 0.002;
      const newScale = Math.max(Workspace.MIN_SCALE, Math.min(Workspace.MAX_SCALE,
        this.transform.scale * (1 + delta)
      ));
      const scaleRatio = newScale / this.transform.scale;

      // Zoom toward cursor: adjust pan so the point under cursor stays fixed
      this.transform.x = cursorX - scaleRatio * (cursorX - this.transform.x);
      this.transform.y = cursorY - scaleRatio * (cursorY - this.transform.y);
      this.transform.scale = newScale;

      this.updateTransform();
      this.updateAllCables();
    }, { passive: false });
  }

  private attemptConnection(portA: HTMLElement, portB: HTMLElement): boolean {
    const isOutA = portA.classList.contains('output');
    const isOutB = portB.classList.contains('output');

    // Must be one output one input
    if (isOutA === isOutB) return false;

    const sourcePort = isOutA ? portA : portB;
    const targetPort = isOutA ? portB : portA;

    const sourcePortId = sourcePort.getAttribute('data-port-id') || 'audio';
    const targetPortId = targetPort.getAttribute('data-port-id') || 'audio';

    const sourceModuleId = sourcePort.closest('.module')?.getAttribute('data-id');
    const targetModuleId = targetPort.closest('.module')?.getAttribute('data-id');

    if (!sourceModuleId || !targetModuleId || sourceModuleId === targetModuleId) return false;

    // Prevent duplicate connections
    const connectionExists = this.connections.some(c =>
      c.sourceModuleId === sourceModuleId && c.targetModuleId === targetModuleId &&
      c.sourcePortId === sourcePortId && c.targetPortId === targetPortId
    );
    if (connectionExists) return false;

    const sourceData = this.modules.get(sourceModuleId);
    const targetData = this.modules.get(targetModuleId);

    if (sourceData && targetData) {
      // Register gate targets for sequencer -> module gate connections
      const isGateConnection = (sourcePortId === 'gate' || targetPortId === 'gate')
        && typeof targetData.audio.onGateSignal === 'function';

      if (isGateConnection) {
        // Gate connections use the onGateSignal interface, not audio routing
        if (typeof (sourceData.audio as any).addGateTarget === 'function') {
          (sourceData.audio as any).addGateTarget(targetData.audio);
        }
      } else {
        sourceData.audio.connect(targetData.audio, targetPortId, sourcePortId);
      }

      const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svgPath.classList.add('cable');
      svgPath.style.pointerEvents = 'auto';
      svgPath.style.cursor = 'pointer';

      const connectionInfo: UIConnection = {
        sourceModuleId,
        sourceType: 'output',
        targetModuleId,
        targetType: 'input',
        svgPath,
        sourcePortId,
        targetPortId
      };

      const handleCableClick = (e: MouseEvent) => {
        e.stopPropagation();
        this.removeConnection(connectionInfo);
      };
      svgPath.addEventListener('click', handleCableClick);

      this.cablesLayer.appendChild(svgPath);
      this.connections.push(connectionInfo);

      this.updateAllCables();
      return true;
    }

    return false;
  }

  private removeConnection(conn: UIConnection) {
    const sourceData = this.modules.get(conn.sourceModuleId);
    const targetData = this.modules.get(conn.targetModuleId);

    if (sourceData && targetData) {
      const isGateConnection = (conn.sourcePortId === 'gate' || conn.targetPortId === 'gate')
        && typeof targetData.audio.onGateSignal === 'function';

      if (isGateConnection) {
        if (typeof (sourceData.audio as any).removeGateTarget === 'function') {
          (sourceData.audio as any).removeGateTarget(targetData.audio);
        }
      } else {
        sourceData.audio.disconnect(targetData.audio, conn.targetPortId, conn.sourcePortId);
      }
    }

    conn.svgPath.remove();
    this.connections = this.connections.filter(c => c !== conn);
    this.updateAllCables();
  }

  private updateTransform() {
    const { x, y, scale } = this.transform;
    const gridSize = 20 * scale;
    this.container.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    this.container.style.backgroundPosition = `${x}px ${y}px`;
    this.modules.forEach(data => {
      const el = data.element;
      const baseX = parseFloat(el.getAttribute('data-x') || '0');
      const baseY = parseFloat(el.getAttribute('data-y') || '0');
      el.style.transform = `translate(${baseX * scale + x}px, ${baseY * scale + y}px) scale(${scale})`;
      el.style.transformOrigin = '0 0';
    });
  }

  private drawCable(path: SVGPathElement, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const absDx = Math.abs(dx);
    const tension = Math.max(50, absDx * 0.4);

    const d = `M ${x1} ${y1} C ${x1 + tension} ${y1}, ${x2 - tension} ${y2}, ${x2} ${y2}`;
    path.setAttribute('d', d);
  }

  public updateAllCables() {
    this.connections.forEach(conn => {
      const sourceEl = this.container.querySelector(`.module[data-id="${conn.sourceModuleId}"] .port.output[data-port-id="${conn.sourcePortId || 'audio'}"]`);
      const targetEl = this.container.querySelector(`.module[data-id="${conn.targetModuleId}"] .port.input[data-port-id="${conn.targetPortId || 'audio'}"]`);

      if (sourceEl && targetEl) {
        const sr = sourceEl.getBoundingClientRect();
        const tr = targetEl.getBoundingClientRect();
        this.drawCable(
          conn.svgPath,
          sr.left + sr.width / 2,
          sr.top + sr.height / 2,
          tr.left + tr.width / 2,
          tr.top + tr.height / 2
        );
      }
    });
  }

  public addModule(audioNode: ModularNode, element: HTMLElement, x: number, y: number, disposeUi?: () => void): boolean {
    const id = audioNode.id;

    if (this.hasModule(id)) {
      return false;
    }

    element.setAttribute('data-id', id);
    element.setAttribute('data-x', x.toString());
    element.setAttribute('data-y', y.toString());

    const { x: tx, y: ty, scale } = this.transform;
    element.style.transform = `translate(${x * scale + tx}px, ${y * scale + ty}px) scale(${scale})`;
    element.style.transformOrigin = '0 0';

    this.container.appendChild(element);

    const dragCleanup = this.setupModuleDragging(element);
    this.setupPortEvents(element);

    const combinedDispose = () => {
      if (dragCleanup) dragCleanup();
      if (disposeUi) disposeUi();
    };

    this.modules.set(id, { audio: audioNode, element, disposeUi: combinedDispose });
    return true;
  }

  private setupModuleDragging(element: HTMLElement): (() => void) | undefined {
    const header = element.querySelector('.module-header') as HTMLElement;
    if (!header) return undefined;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    const handleDragStart = (clientX: number, clientY: number) => {
      isDragging = true;
      startX = clientX;
      startY = clientY;
      initialX = parseFloat(element.getAttribute('data-x') || '0');
      initialY = parseFloat(element.getAttribute('data-y') || '0');
      element.classList.add('dragging');

      this.modules.forEach(m => m.element.style.zIndex = '40');
      element.style.zIndex = '41';
    };

    const handleHeaderMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
      handleDragStart(e.clientX, e.clientY);
    };

    const handleHeaderTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleDragMove = (clientX: number, clientY: number) => {
      if (isDragging) {
        const dx = (clientX - startX) / this.transform.scale;
        const dy = (clientY - startY) / this.transform.scale;
        const newX = initialX + dx;
        const newY = initialY + dy;

        element.setAttribute('data-x', newX.toString());
        element.setAttribute('data-y', newY.toString());
        const { x: tx, y: ty, scale } = this.transform;
        element.style.transform = `translate(${newX * scale + tx}px, ${newY * scale + ty}px) scale(${scale})`;

        this.updateAllCables();
      }
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleDragEnd = () => {
      if (isDragging) {
        isDragging = false;
        element.classList.remove('dragging');
      }
    };

    const closeBtn = element.querySelector('.module-close');
    const handleClose = () => {
      this.removeModule(element.getAttribute('data-id') as string);
    };

    header.addEventListener('mousedown', handleHeaderMouseDown);
    header.addEventListener('touchstart', handleHeaderTouchStart, { passive: false });
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchend', handleDragEnd);
    window.addEventListener('touchcancel', handleDragEnd);
    if (closeBtn) {
      closeBtn.addEventListener('click', handleClose);
    }

    return () => {
      header.removeEventListener('mousedown', handleHeaderMouseDown);
      header.removeEventListener('touchstart', handleHeaderTouchStart);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('touchcancel', handleDragEnd);
      if (closeBtn) {
        closeBtn.removeEventListener('click', handleClose);
      }
    };
  }

  private setupPortEvents(element: HTMLElement) {
    const ports = element.querySelectorAll('.port');
    ports.forEach(port => {
      const startConnection = (clientX: number, clientY: number) => {
        this.isConnecting = true;
        this.tempSourcePort = port as HTMLElement;

        this.tempCable = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempCable.classList.add('cable', 'active');
        this.cablesLayer.appendChild(this.tempCable);

        const rect = port.getBoundingClientRect();
        this.drawCable(this.tempCable, rect.left + rect.width / 2, rect.top + rect.height / 2, clientX, clientY);
      };

      port.addEventListener('mousedown', (e: Event) => {
        const mouseEvent = e as MouseEvent;
        e.stopPropagation();
        startConnection(mouseEvent.clientX, mouseEvent.clientY);
      });

      port.addEventListener('touchstart', (e: Event) => {
        const touchEvent = e as TouchEvent;
        e.stopPropagation();
        touchEvent.preventDefault();
        startConnection(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
      }, { passive: false });
    });
  }

  public removeModule(id: string) {
    const data = this.modules.get(id);
    if (!data) return;

    data.disposeUi?.();
    data.audio.destroy();

    data.element.remove();
    this.modules.delete(id);

    const toRemove = this.connections.filter(c => c.sourceModuleId === id || c.targetModuleId === id);
    toRemove.forEach(c => {
      if (c.targetModuleId === id && c.sourceModuleId !== id) {
        const sourceData = this.modules.get(c.sourceModuleId);
        if (sourceData) {
          const isGate = (c.sourcePortId === 'gate' || c.targetPortId === 'gate')
            && typeof data.audio.onGateSignal === 'function';
          if (isGate) {
            if (typeof (sourceData.audio as any).removeGateTarget === 'function') {
              (sourceData.audio as any).removeGateTarget(data.audio);
            }
          } else {
            sourceData.audio.disconnect(data.audio, c.targetPortId, c.sourcePortId);
          }
        }
      }
      c.svgPath.remove();
    });
    this.connections = this.connections.filter(c => c.sourceModuleId !== id && c.targetModuleId !== id);

    this.updateAllCables();
  }

  public exportState(): string {
    const state = {
      transport: {
        bpm: transport.bpm,
        ticksPerBeat: transport.ticksPerBeat
      },
      modules: Array.from(this.modules.values())
        .filter(data => data.audio.id !== 'master')
        .map(data => ({
          id: data.audio.id,
          type: data.audio.type.toLowerCase(),
          x: parseFloat(data.element.getAttribute('data-x') || '0'),
          y: parseFloat(data.element.getAttribute('data-y') || '0'),
          state: data.audio.state
        })),
      connections: this.connections.map(c => ({
        sourceModuleId: c.sourceModuleId,
        targetModuleId: c.targetModuleId,
        sourcePortId: c.sourcePortId,
        targetPortId: c.targetPortId
      }))
    };
    return JSON.stringify(state);
  }

  private normalizePatchState(raw: unknown): { state: PatchState; warnings: string[] } {
    const warnings: string[] = [];
    const empty: PatchState = { modules: [], connections: [] };

    if (!isObject(raw)) {
      warnings.push('Patch root must be an object.');
      return { state: empty, warnings };
    }

    const rawModules = raw.modules;
    const rawConnections = raw.connections;

    if (!Array.isArray(rawModules)) {
      warnings.push('Patch missing modules array.');
    }
    if (!Array.isArray(rawConnections)) {
      warnings.push('Patch missing connections array.');
    }

    const seenIds = new Set<string>();
    const modules: PatchModule[] = [];
    for (const item of Array.isArray(rawModules) ? rawModules : []) {
      if (!isObject(item)) {
        warnings.push('Skipped module entry: not an object.');
        continue;
      }

      const id = asString(item.id);
      const type = asString(item.type);
      if (!id || !type) {
        warnings.push('Skipped module entry: id/type missing.');
        continue;
      }
      if (id === 'master') {
        warnings.push('Skipped module entry: id "master" is reserved.');
        continue;
      }
      if (seenIds.has(id)) {
        warnings.push(`Skipped duplicate module id "${id}".`);
        continue;
      }

      seenIds.add(id);
      modules.push({
        id,
        type,
        x: asNumber(item.x, 0),
        y: asNumber(item.y, 0),
        state: isObject(item.state) ? item.state : {}
      });
    }

    const validIds = new Set(modules.map(m => m.id));
    validIds.add('master');

    const connections: PatchConnection[] = [];
    for (const item of Array.isArray(rawConnections) ? rawConnections : []) {
      if (!isObject(item)) {
        warnings.push('Skipped connection entry: not an object.');
        continue;
      }

      const sourceModuleId = asString(item.sourceModuleId);
      const targetModuleId = asString(item.targetModuleId);
      if (!sourceModuleId || !targetModuleId) {
        warnings.push('Skipped connection entry: source/target missing.');
        continue;
      }
      if (!validIds.has(sourceModuleId) || !validIds.has(targetModuleId)) {
        warnings.push(`Skipped connection ${sourceModuleId} -> ${targetModuleId}: unknown endpoint.`);
        continue;
      }

      const sourcePortId = asString(item.sourcePortId) || 'audio';
      const targetPortId = asString(item.targetPortId) || 'audio';
      connections.push({ sourceModuleId, targetModuleId, sourcePortId, targetPortId });
    }

    return { state: { modules, connections }, warnings };
  }

  private remapPatchIdsForCollision(patch: PatchState, safeRename: boolean): { patch: PatchState; idsRenamed: number } {
    if (!safeRename) return { patch, idsRenamed: 0 };

    const next = clonePatchState(patch);
    const idMap = new Map<string, string>();
    const existing = new Set(Array.from(this.modules.keys()));
    let idsRenamed = 0;

    const makeUnique = (base: string): string => {
      let index = 1;
      let candidate = `${base}-${index}`;
      while (existing.has(candidate)) {
        index += 1;
        candidate = `${base}-${index}`;
      }
      return candidate;
    };

    for (const mod of next.modules) {
      const oldId = mod.id;
      if (!existing.has(oldId) && !idMap.has(oldId)) {
        existing.add(oldId);
        idMap.set(oldId, oldId);
        continue;
      }

      const uniqueId = makeUnique(oldId);
      mod.id = uniqueId;
      existing.add(uniqueId);
      idMap.set(oldId, uniqueId);
      idsRenamed += 1;
    }

    next.connections = next.connections.map((c) => ({
      ...c,
      sourceModuleId: idMap.get(c.sourceModuleId) || c.sourceModuleId,
      targetModuleId: idMap.get(c.targetModuleId) || c.targetModuleId
    }));

    return { patch: next, idsRenamed };
  }

  private findFirstConnection(predicate: (c: UIConnection) => boolean): UIConnection | undefined {
    return this.connections.find(predicate);
  }

  private getCvPortIdsForModule(moduleId: string): string[] {
    const moduleEl = this.container.querySelector(`.module[data-id="${moduleId}"]`);
    if (!moduleEl) return [];
    const cvPorts = Array.from(moduleEl.querySelectorAll('.port.input.cv[data-port-id]'));
    return cvPorts
      .map((p) => p.getAttribute('data-port-id'))
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
  }

  private inferEntryModuleId(patch: PatchState): string | null {
    if (patch.modules.length === 0) return null;
    const incomingAudio = new Set(
      patch.connections
        .filter((c) => c.targetPortId === 'audio' && c.targetModuleId !== 'master')
        .map((c) => c.targetModuleId)
    );
    const entry = patch.modules.find((m) => !incomingAudio.has(m.id));
    return entry?.id || patch.modules[0].id;
  }

  private inferExitModuleId(patch: PatchState): string | null {
    if (patch.modules.length === 0) return null;
    const toMaster = patch.connections.find((c) => c.targetModuleId === 'master' && c.targetPortId === 'audio');
    if (toMaster) return toMaster.sourceModuleId;

    const hasOutgoingAudio = new Set(
      patch.connections
        .filter((c) => c.sourcePortId === 'audio' && c.targetModuleId !== 'master')
        .map((c) => c.sourceModuleId)
    );
    const exit = patch.modules.find((m) => !hasOutgoingAudio.has(m.id));
    return exit?.id || patch.modules[patch.modules.length - 1].id;
  }

  private inferModulationSourceId(patch: PatchState): string | null {
    const preferred = patch.modules.find((m) =>
      m.type === 'lfo' || m.type === 'adsr' || m.type === 'sequencer'
    );
    if (preferred) return preferred.id;
    return this.inferEntryModuleId(patch);
  }

  private buildApplyPlan(patch: PatchState, options: ApplyOptions): PlannedApply {
    const warnings: string[] = [];
    const mode: ApplyMode = options.mode || 'replace';
    const targetType: ApplyTarget = options.targetType || 'auto';
    const safeRename = options.safeRename !== false;

    const remapped = this.remapPatchIdsForCollision(patch, safeRename);
    const nextPatch = remapped.patch;
    const connectionsToRemove: PlannedConnection[] = [];
    const connectionsToAdd: PlannedConnection[] = [...nextPatch.connections];

    if (mode === 'replace') {
      return {
        patch: nextPatch,
        warnings,
        idsRenamed: remapped.idsRenamed,
        connectionsToRemove,
        connectionsToAdd
      };
    }

    const entryId = this.inferEntryModuleId(nextPatch);
    const exitId = this.inferExitModuleId(nextPatch);
    const targetModuleId = options.targetModuleId;

    if (!entryId || !exitId) {
      warnings.push('Incoming patch has no modules to apply.');
      return {
        patch: nextPatch,
        warnings,
        idsRenamed: remapped.idsRenamed,
        connectionsToRemove,
        connectionsToAdd
      };
    }

    // Ignore incoming routes to master for additive modes; these are re-attached based on target strategy.
    const filteredAdds = connectionsToAdd.filter((c) => c.targetModuleId !== 'master');
    connectionsToAdd.length = 0;
    connectionsToAdd.push(...filteredAdds);

    const addConnection = (sourceModuleId: string, targetModuleIdValue: string, sourcePortId = 'audio', targetPortId = 'audio') => {
      connectionsToAdd.push({
        sourceModuleId,
        targetModuleId: targetModuleIdValue,
        sourcePortId,
        targetPortId
      });
    };

    const removeUiConnection = (conn: UIConnection) => {
      connectionsToRemove.push({
        sourceModuleId: conn.sourceModuleId,
        targetModuleId: conn.targetModuleId,
        sourcePortId: conn.sourcePortId || 'audio',
        targetPortId: conn.targetPortId || 'audio'
      });
    };

    const resolveChainTarget = (): { source?: UIConnection; dest?: UIConnection; targetId?: string } => {
      if (targetType === 'master_send') return {};
      if (targetModuleId) {
        const incoming = this.findFirstConnection((c) =>
          c.targetModuleId === targetModuleId &&
          (c.targetPortId || 'audio') === 'audio' &&
          (c.sourcePortId || 'audio') === 'audio'
        );
        const outgoing = this.findFirstConnection((c) =>
          c.sourceModuleId === targetModuleId &&
          (c.sourcePortId || 'audio') === 'audio' &&
          (c.targetPortId || 'audio') === 'audio'
        );
        return { source: incoming, dest: outgoing, targetId: targetModuleId };
      }

      const toMaster = this.findFirstConnection((c) =>
        c.targetModuleId === 'master' &&
        (c.targetPortId || 'audio') === 'audio' &&
        (c.sourcePortId || 'audio') === 'audio'
      );
      return { dest: toMaster, targetId: toMaster?.sourceModuleId };
    };

    if (mode === 'add_chain') {
      const target = resolveChainTarget();

      if (targetType === 'before_module' && target.source && target.targetId) {
        removeUiConnection(target.source);
        addConnection(target.source.sourceModuleId, entryId);
        addConnection(exitId, target.targetId);
      } else if ((targetType === 'after_module' || targetType === 'auto') && target.dest) {
        removeUiConnection(target.dest);
        addConnection(target.dest.sourceModuleId, entryId);
        addConnection(exitId, target.dest.targetModuleId);
      } else if (targetType === 'parallel_to_module' && target.targetId) {
        addConnection(target.targetId, entryId);
        addConnection(exitId, 'master');
      } else if (targetType === 'master_send') {
        const seed = target.targetId || targetModuleId;
        if (seed) {
          addConnection(seed, entryId);
        }
        addConnection(exitId, 'master');
      } else {
        warnings.push('No valid chain target found; attached chain output to master.');
        addConnection(exitId, 'master');
      }
    } else if (mode === 'add_send') {
      let sendSourceId = targetModuleId || resolveChainTarget().targetId;
      if (!sendSourceId) {
        const toMaster = this.findFirstConnection((c) => c.targetModuleId === 'master');
        sendSourceId = toMaster?.sourceModuleId;
      }
      if (sendSourceId) {
        addConnection(sendSourceId, entryId);
      } else {
        warnings.push('No send source found; send chain will output only.');
      }
      addConnection(exitId, 'master');
    } else if (mode === 'add_layer') {
      if (targetModuleId && (targetType === 'parallel_to_module' || targetType === 'before_module' || targetType === 'after_module')) {
        addConnection(targetModuleId, entryId);
      }
      addConnection(exitId, 'master');
    } else if (mode === 'add_modulation') {
      const modSource = this.inferModulationSourceId(nextPatch);
      const candidateTargetId = targetModuleId || this.listModules()[0]?.id;
      if (!modSource || !candidateTargetId) {
        warnings.push('No modulation source/target available.');
      } else {
        const cvPorts = this.getCvPortIdsForModule(candidateTargetId);
        const preferredOrder = ['cutoff', 'level', 'freq', 'res', 'drive', 'mix', 'time', 'feedback'];
        const targetPort = preferredOrder.find((p) => cvPorts.includes(p)) || cvPorts[0];
        if (targetPort) {
          addConnection(modSource, candidateTargetId, 'audio', targetPort);
        } else {
          warnings.push(`Target module "${candidateTargetId}" has no CV input ports.`);
        }
      }
    }

    return {
      patch: nextPatch,
      warnings,
      idsRenamed: remapped.idsRenamed,
      connectionsToRemove,
      connectionsToAdd
    };
  }

  private applyPlannedConnections(plan: PlannedApply, warnings: string[]): number {
    for (const rm of plan.connectionsToRemove) {
      const existing = this.connections.find((c) =>
        c.sourceModuleId === rm.sourceModuleId &&
        c.targetModuleId === rm.targetModuleId &&
        (c.sourcePortId || 'audio') === rm.sourcePortId &&
        (c.targetPortId || 'audio') === rm.targetPortId
      );
      if (existing) this.removeConnection(existing);
    }

    let created = 0;
    for (const conn of plan.connectionsToAdd) {
      const sourcePort = this.container.querySelector(`.module[data-id="${conn.sourceModuleId}"] .port.output[data-port-id="${conn.sourcePortId}"]`) as HTMLElement | null;
      const targetPort = this.container.querySelector(`.module[data-id="${conn.targetModuleId}"] .port.input[data-port-id="${conn.targetPortId}"]`) as HTMLElement | null;
      if (!sourcePort || !targetPort) {
        warnings.push(`Could not apply connection ${conn.sourceModuleId}:${conn.sourcePortId} -> ${conn.targetModuleId}:${conn.targetPortId}.`);
        continue;
      }
      if (this.attemptConnection(sourcePort, targetPort)) {
        created += 1;
      }
    }
    return created;
  }

  public previewApplyState(jsonString: string, options: ApplyOptions): ApplySummary {
    const warnings: string[] = [];
    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown parse error';
      return {
        modulesAdded: 0,
        connectionsAdded: 0,
        routesRewired: 0,
        idsRenamed: 0,
        warnings: [`Failed to parse patch JSON: ${message}`]
      };
    }

    const normalized = this.normalizePatchState(parsed);
    warnings.push(...normalized.warnings);
    const planned = this.buildApplyPlan(normalized.state, options);
    warnings.push(...planned.warnings);

    return {
      modulesAdded: planned.patch.modules.length,
      connectionsAdded: planned.connectionsToAdd.length,
      routesRewired: planned.connectionsToRemove.length,
      idsRenamed: planned.idsRenamed,
      warnings
    };
  }

  public applyState(jsonString: string, options: ApplyOptions): ApplyStateResult {
    const mode: ApplyMode = options.mode || 'replace';
    if (mode === 'replace') {
      const replaced = this.importState(jsonString);
      return {
        ...replaced,
        summary: {
          modulesAdded: replaced.modulesCreated,
          connectionsAdded: replaced.connectionsCreated,
          routesRewired: 0,
          idsRenamed: 0,
          warnings: [...replaced.warnings]
        }
      };
    }

    const warnings: string[] = [];
    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown parse error';
      warnings.push(`Failed to parse patch JSON: ${message}`);
      return {
        modulesCreated: 0,
        connectionsCreated: 0,
        warnings,
        summary: {
          modulesAdded: 0,
          connectionsAdded: 0,
          routesRewired: 0,
          idsRenamed: 0,
          warnings: [...warnings]
        }
      };
    }

    const normalized = this.normalizePatchState(parsed);
    warnings.push(...normalized.warnings);
    const planned = this.buildApplyPlan(normalized.state, options);
    warnings.push(...planned.warnings);

    // Stop transport before mutating graph
    if (transport.isPlaying) {
      transport.stop();
    }

    let modulesCreated = 0;
    for (const mod of planned.patch.modules) {
      if (!window._createModule) {
        warnings.push('Module creation callback is unavailable.');
        break;
      }
      const created = window._createModule(mod.type, mod.id, mod.x, mod.y, mod.state);
      if (created) {
        modulesCreated += 1;
      } else {
        warnings.push(`Failed to create module ${mod.id} (${mod.type}).`);
      }
    }

    const connectionsCreated = this.applyPlannedConnections(planned, warnings);

    return {
      modulesCreated,
      connectionsCreated,
      warnings,
      summary: {
        modulesAdded: planned.patch.modules.length,
        connectionsAdded: planned.connectionsToAdd.length,
        routesRewired: planned.connectionsToRemove.length,
        idsRenamed: planned.idsRenamed,
        warnings: [...warnings]
      }
    };
  }

  public importState(jsonString: string): ImportStateResult {
    const warnings: string[] = [];
    let parsed: unknown;

    this.importVersion += 1;
    const importVersion = this.importVersion;

    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown parse error';
      warnings.push(`Failed to parse patch JSON: ${message}`);
      return { modulesCreated: 0, connectionsCreated: 0, warnings };
    }

    // Restore transport state if present (backward compatible)
    if (isObject(parsed) && isObject((parsed as any).transport)) {
      const t = (parsed as any).transport;
      if (typeof t.bpm === 'number') {
        transport.setBpm(t.bpm);
        const bpmInput = document.getElementById('bpm-input') as HTMLInputElement | null;
        if (bpmInput) bpmInput.value = String(t.bpm);
      }
      if (typeof t.ticksPerBeat === 'number') transport.setTicksPerBeat(t.ticksPerBeat);
    }

    // Stop transport before clearing modules to avoid dangling callbacks
    if (transport.isPlaying) {
      transport.stop();
    }

    const normalized = this.normalizePatchState(parsed);
    warnings.push(...normalized.warnings);

    const existingIds = Array.from(this.modules.keys());
    existingIds.forEach(id => {
      if (id !== 'master') {
        this.removeModule(id);
      }
    });

    let modulesCreated = 0;
    for (const mod of normalized.state.modules) {
      if (!window._createModule) {
        warnings.push('Module creation callback is unavailable.');
        break;
      }

      const created = window._createModule(mod.type, mod.id, mod.x, mod.y, mod.state);
      if (created) {
        modulesCreated += 1;
      } else {
        warnings.push(`Failed to create module ${mod.id} (${mod.type}).`);
      }
    }

    // Ignore stale import requests if any future async behavior is introduced.
    if (importVersion !== this.importVersion) {
      warnings.push('Stale import aborted.');
      return { modulesCreated, connectionsCreated: 0, warnings };
    }

    let connectionsCreated = 0;
    for (const conn of normalized.state.connections) {
      const sourcePort = this.container.querySelector(`.module[data-id="${conn.sourceModuleId}"] .port.output[data-port-id="${conn.sourcePortId}"]`) as HTMLElement | null;
      const targetPort = this.container.querySelector(`.module[data-id="${conn.targetModuleId}"] .port.input[data-port-id="${conn.targetPortId}"]`) as HTMLElement | null;

      if (sourcePort && targetPort) {
        const connected = this.attemptConnection(sourcePort, targetPort);
        if (connected) {
          connectionsCreated += 1;
        } else {
          warnings.push(`Skipped connection ${conn.sourceModuleId}:${conn.sourcePortId} -> ${conn.targetModuleId}:${conn.targetPortId}.`);
        }
      } else {
        warnings.push(`Could not restore connection ${conn.sourceModuleId}:${conn.sourcePortId} -> ${conn.targetModuleId}:${conn.targetPortId}: port not found.`);
      }
    }

    return { modulesCreated, connectionsCreated, warnings };
  }
}
