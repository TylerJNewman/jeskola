import { ModularNode } from '../audio/nodes/ModularNode';

export interface UIConnection {
  sourceModuleId: string;
  sourceType: 'output';
  targetModuleId: string;
  targetType: 'input';
  svgPath: SVGPathElement;
  sourcePortId?: string;
  targetPortId?: string;
}

export class Workspace {
  private container: HTMLElement;
  private cablesLayer: SVGSVGElement;
  private transform = { x: 0, y: 0, scale: 1 };
  
  private modules: Map<string, { audio: ModularNode, element: HTMLElement }> = new Map();
  private connections: UIConnection[] = [];

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
        // Adjust for workspace transform
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
        // Did we drop on a valid port?
        let targetPort: HTMLElement | null = null;
        let p: HTMLElement | null = null;
        
        if ('changedTouches' in e && (e as TouchEvent).changedTouches.length > 0) {
          const touch = (e as TouchEvent).changedTouches[0];
          p = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
        } else {
          p = e.target as HTMLElement;
        }
        
        // Find valid port up the tree
        while (p && p !== document.body) {
          if (p.classList && p.classList.contains('port')) {
            targetPort = p;
            break;
          }
          p = p.parentElement as HTMLElement;
        }

        if (targetPort && this.tempSourcePort) {
          // Attempt connection
          this.attemptConnection(this.tempSourcePort, targetPort);
        }
        
        // Cleanup temp cable
        this.tempCable.remove();
        this.tempCable = null;
        this.isConnecting = false;
        this.tempSourcePort = null;
      }
    };

    window.addEventListener('mouseup', handlePanEnd);
    window.addEventListener('touchend', handlePanEnd);
    window.addEventListener('touchcancel', handlePanEnd);
  }

  private attemptConnection(portA: HTMLElement, portB: HTMLElement) {
    const isOutA = portA.classList.contains('output');
    const isOutB = portB.classList.contains('output');

    // Must be one output one input
    if (isOutA === isOutB) return;

    const sourcePort = isOutA ? portA : portB;
    const targetPort = isOutA ? portB : portA;

    const sourcePortId = sourcePort.getAttribute('data-port-id') || 'audio';
    const targetPortId = targetPort.getAttribute('data-port-id') || 'audio';

    const sourceModuleId = sourcePort.closest('.module')?.getAttribute('data-id');
    const targetModuleId = targetPort.closest('.module')?.getAttribute('data-id');
    
    if (!sourceModuleId || !targetModuleId || sourceModuleId === targetModuleId) return;

    // Prevent duplicate connections
    const connectionExists = this.connections.some(c => 
      c.sourceModuleId === sourceModuleId && c.targetModuleId === targetModuleId &&
      c.sourcePortId === sourcePortId && c.targetPortId === targetPortId
    );
    if (connectionExists) return;

    const sourceData = this.modules.get(sourceModuleId);
    const targetData = this.modules.get(targetModuleId);

    if (sourceData && targetData) {
      // Connect Audio
      sourceData.audio.connect(targetData.audio, targetPortId);

      // Create permanent UI cable
      const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svgPath.classList.add('cable');
      
      // Make cable clickable to remove it
      svgPath.style.pointerEvents = 'auto'; // SVG is pointer-events: none by default on the layer
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

      svgPath.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeConnection(connectionInfo);
      });

      this.cablesLayer.appendChild(svgPath);
      this.connections.push(connectionInfo);

      this.updateAllCables();
    }
  }

  private removeConnection(conn: UIConnection) {
    const sourceData = this.modules.get(conn.sourceModuleId);
    const targetData = this.modules.get(conn.targetModuleId);

    if (sourceData && targetData) {
      // Disconnect Audio
      sourceData.audio.disconnect(targetData.audio, conn.targetPortId);
    }

    // Clean up UI
    conn.svgPath.remove();
    this.connections = this.connections.filter(c => c !== conn);
    this.updateAllCables();
  }

  private updateTransform() {
    this.container.style.backgroundPosition = `${this.transform.x}px ${this.transform.y}px`;
    // We physically move modules
    this.modules.forEach(data => {
      const el = data.element;
      const baseX = parseFloat(el.getAttribute('data-x') || '0');
      const baseY = parseFloat(el.getAttribute('data-y') || '0');
      el.style.transform = `translate(${baseX + this.transform.x}px, ${baseY + this.transform.y}px)`;
    });
  }

  // Cable drawing logic using bezier curve
  private drawCable(path: SVGPathElement, x1: number, y1: number, x2: number, y2: number) {
    // Distance calculation for curve tightness
    const dx = x2 - x1;
    const absDx = Math.abs(dx);
    const tension = Math.max(50, absDx * 0.4);

    // Output is usually on the right, input on the left
    const d = `M ${x1} ${y1} C ${x1 + tension} ${y1}, ${x2 - tension} ${y2}, ${x2} ${y2}`;
    path.setAttribute('d', d);
  }

  public updateAllCables() {
    this.connections.forEach(conn => {
      const sourceEl = document.querySelector(`.module[data-id="${conn.sourceModuleId}"] .port.output[data-port-id="${conn.sourcePortId || 'audio'}"]`);
      const targetEl = document.querySelector(`.module[data-id="${conn.targetModuleId}"] .port.input[data-port-id="${conn.targetPortId || 'audio'}"]`);

      // Master output edge case
      if (sourceEl && !targetEl && conn.targetModuleId === 'master') {
          // handled differently or dummy position for now
          // For simplicity we will handle master routing outside visual cables or add a Master module UI block.
      } else if (sourceEl && targetEl) {
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

  public addModule(audioNode: ModularNode, element: HTMLElement, x: number, y: number) {
    const id = audioNode.id;
    element.setAttribute('data-id', id);
    element.setAttribute('data-x', x.toString());
    element.setAttribute('data-y', y.toString());
    
    // Initial position
    element.style.transform = `translate(${x + this.transform.x}px, ${y + this.transform.y}px)`;
    
    this.container.appendChild(element);
    this.modules.set(id, { audio: audioNode, element });

    this.setupModuleDragging(element);
    this.setupPortEvents(element);
  }

  private setupModuleDragging(element: HTMLElement) {
    const header = element.querySelector('.module-header') as HTMLElement;
    if (!header) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialX = 0, initialY = 0;

    const handleDragStart = (clientX: number, clientY: number) => {
      isDragging = true;
      startX = clientX;
      startY = clientY;
      initialX = parseFloat(element.getAttribute('data-x') || '0');
      initialY = parseFloat(element.getAttribute('data-y') || '0');
      element.classList.add('dragging');

      // Bring to front among other modules
      this.modules.forEach(m => m.element.style.zIndex = '40');
      element.style.zIndex = '41';
    };

    header.addEventListener('mousedown', (e) => {
      e.stopPropagation(); // prevent workspace panning
      handleDragStart(e.clientX, e.clientY);
    });

    header.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    const handleDragMove = (clientX: number, clientY: number) => {
      if (isDragging) {
        const dx = clientX - startX;
        const dy = clientY - startY;
        const newX = initialX + dx;
        const newY = initialY + dy;
        
        element.setAttribute('data-x', newX.toString());
        element.setAttribute('data-y', newY.toString());
        element.style.transform = `translate(${newX + this.transform.x}px, ${newY + this.transform.y}px)`;
        
        this.updateAllCables();
      }
    };

    window.addEventListener('mousemove', (e) => {
      handleDragMove(e.clientX, e.clientY);
    });

    window.addEventListener('touchmove', (e) => {
      if (isDragging) {
        e.preventDefault();
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    const handleDragEnd = () => {
      if (isDragging) {
        isDragging = false;
        element.classList.remove('dragging');
      }
    };

    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchend', handleDragEnd);
    window.addEventListener('touchcancel', handleDragEnd);
    
    // Handle close
    const closeBtn = element.querySelector('.module-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.removeModule(element.getAttribute('data-id') as string);
      });
    }
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
        
        // Initial draw
        const rect = port.getBoundingClientRect();
        this.drawCable(this.tempCable, rect.left + rect.width/2, rect.top + rect.height/2, clientX, clientY);
      };

      port.addEventListener('mousedown', (e: Event) => {
        const mouseEvent = e as MouseEvent;
        e.stopPropagation();
        startConnection(mouseEvent.clientX, mouseEvent.clientY);
      });

      port.addEventListener('touchstart', (e: Event) => {
        const touchEvent = e as TouchEvent;
        e.stopPropagation();
        touchEvent.preventDefault(); // prevent zoom/scroll
        startConnection(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
      }, { passive: false });
    });
  }

  public removeModule(id: string) {
    const data = this.modules.get(id);
    if (!data) return;

    // cleanup audio
    data.audio.destroy();
    
    // cleanup DOM
    data.element.remove();
    this.modules.delete(id);

    // cleanup connections
    const toRemove = this.connections.filter(c => c.sourceModuleId === id || c.targetModuleId === id);
    toRemove.forEach(c => {
      // Disconnect audio if the deleted module was the target
      if (c.targetModuleId === id && c.sourceModuleId !== id) {
        const sourceData = this.modules.get(c.sourceModuleId);
        if (sourceData) {
          sourceData.audio.disconnect(data.audio, c.targetPortId);
        }
      }
      c.svgPath.remove();
    });
    this.connections = this.connections.filter(c => c.sourceModuleId !== id && c.targetModuleId !== id);
    
    this.updateAllCables();
  }
}
