export class Knob {
  private container: HTMLElement;
  private knobElement: HTMLElement;
  private valueElement: HTMLElement;
  
  private min: number;
  private max: number;
  private currentValue: number;
  private defaultValue: number;
  private onChange: (val: number) => void;

  private isDragging = false;
  private startValue = 0;
  private startY = 0;

  private logCapable: boolean;
  private isLogMode: boolean;
  private onModeChange?: (isLog: boolean) => void;
  private step?: number;
  // Linear 0.0 to 1.0 tracker to prevent position jumping when toggling modes
  private currentLinearPosition: number = 0;
  
  private pendingAnimationFrame: number | null = null;
  private cleanupCallbacks: Array<() => void> = [];
  private isDisposed = false;

  constructor(
    container: HTMLElement, 
    label: string, 
    min: number, 
    max: number, 
    initialValue: number, 
    onChange: (val: number) => void,
    logCapable: boolean = false,
    initialLogMode: boolean = false,
    onModeChange?: (isLog: boolean) => void,
    step?: number,
    defaultValue?: number
  ) {
    this.container = container;
    this.min = min;
    this.max = max;
    this.currentValue = Number.isFinite(initialValue) ? initialValue : min;
    this.onChange = onChange;
    this.logCapable = logCapable;
    this.isLogMode = initialLogMode;
    this.onModeChange = onModeChange;
    this.step = step;
    this.defaultValue = defaultValue !== undefined ? defaultValue : this.currentValue;

    // Calculate initial linear position based on currentValue and mode
    const safeInitial = this.currentValue;
    if (this.isLogMode) {
      const safeMin = Math.max(0.0001, this.min);
      const safeMax = Math.max(safeMin + 0.0001, this.max);
      this.currentLinearPosition = (Math.log(safeInitial) - Math.log(safeMin)) / (Math.log(safeMax) - Math.log(safeMin));
    } else {
      this.currentLinearPosition = (safeInitial - min) / (max - min);
    }
    this.currentLinearPosition = Math.min(1.0, Math.max(0.0, this.currentLinearPosition));

    this.container.classList.add('control-group');
    
    const toggleHtml = this.logCapable ? 
      `<div class="mini-segment mode-toggle" title="Toggle Scale">
         <span class="segment ${!this.isLogMode ? 'active' : ''}" data-mode="lin">LIN</span>
         <span class="segment ${this.isLogMode ? 'active' : ''}" data-mode="log">LOG</span>
       </div>` : '';

    this.container.innerHTML = `
      <div class="label">${label}</div>
      <div class="knob-container">
        <div class="knob"></div>
      </div>
      <div style="display:flex; align-items:center;">
        <div class="value-display" style="font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums;">${this.formatValue(this.currentValue)}</div>
        ${toggleHtml}
      </div>
    `;

    this.knobElement = this.container.querySelector('.knob') as HTMLElement;
    this.valueElement = this.container.querySelector('.value-display') as HTMLElement;

    this.updateVisuals();
    this.initEvents();
  }

  private formatValue(val: number): string {
    if (val == null || !Number.isFinite(val)) return '—';
    if (val >= 100) return Math.round(val).toString();
    if (val >= 10) return val.toFixed(1);
    return val.toFixed(2);
  }
  
  private calculateValueFromLinear(linearPos: number): number {
    if (this.isLogMode) {
      // Map 0.0 - 1.0 to log range min - max
      // Ensure min is > 0 for log scaling. If min is 0 or negative, we treat it as small positive for log math.
      const safeMin = Math.max(0.0001, this.min);
      const safeMax = Math.max(safeMin + 0.0001, this.max);
      return Math.exp(Math.log(safeMin) + linearPos * (Math.log(safeMax) - Math.log(safeMin)));
    } else {
      return this.min + linearPos * (this.max - this.min);
    }
  }

  private calculateLinearFromValue(val: number): number {
    if (this.isLogMode) {
      const safeMin = Math.max(0.0001, this.min);
      const safeMax = Math.max(safeMin + 0.0001, this.max);
      return (Math.log(val) - Math.log(safeMin)) / (Math.log(safeMax) - Math.log(safeMin));
    } else {
      return (val - this.min) / (this.max - this.min);
    }
  }

  private initEvents() {
    const knobContainer = this.container.querySelector('.knob-container') as HTMLElement;
    const toggleBtn = this.container.querySelector('.mode-toggle') as HTMLElement;

    if (toggleBtn) {
      const handleToggleClick = () => {
        if (this.isDisposed) return;
        this.isLogMode = !this.isLogMode;
        
        const linSeg = toggleBtn.querySelector('[data-mode="lin"]')!;
        const logSeg = toggleBtn.querySelector('[data-mode="log"]')!;
        
        if (this.isLogMode) {
          linSeg.classList.remove('active');
          logSeg.classList.add('active');
        } else {
          logSeg.classList.remove('active');
          linSeg.classList.add('active');
        }
        
        // When toggling, we recalculate the current actual physical value 
        // based on the EXISTING visual linear knob position, so the knob value jumps 
        // rather than the visual graphical knob violently snapping to a new angle.
        this.currentValue = this.calculateValueFromLinear(this.currentLinearPosition);
        this.currentValue = Math.min(this.max, Math.max(this.min, this.currentValue));
        
        this.updateVisuals();
        this.onChange(this.currentValue);
        if (this.onModeChange) this.onModeChange(this.isLogMode);
      };
      toggleBtn.addEventListener('click', handleToggleClick);
      this.cleanupCallbacks.push(() => toggleBtn.removeEventListener('click', handleToggleClick));
    }

    const handleStart = (clientY: number) => {
      this.isDragging = true;
      this.startY = clientY;
      // Capture the linear position as the starting point for dragging mechanics
      this.startValue = this.currentLinearPosition;
      document.body.style.cursor = 'ns-resize';
    };

    const handleMouseDown = (e: MouseEvent) => {
      e.stopPropagation(); // Prevent workspace drag
      handleStart(e.clientY);
    };
    knobContainer.addEventListener('mousedown', handleMouseDown);
    this.cleanupCallbacks.push(() => knobContainer.removeEventListener('mousedown', handleMouseDown));

    const handleTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      handleStart(e.touches[0].clientY);
    };
    knobContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    this.cleanupCallbacks.push(() => knobContainer.removeEventListener('touchstart', handleTouchStart));

    // Double-click to reset
    const handleDoubleClick = (e: MouseEvent) => {
      e.stopPropagation();
      this.currentValue = this.defaultValue;
      this.currentLinearPosition = this.calculateLinearFromValue(this.defaultValue);
      this.updateVisuals();
      this.onChange(this.currentValue);
    };
    knobContainer.addEventListener('dblclick', handleDoubleClick);
    this.cleanupCallbacks.push(() => knobContainer.removeEventListener('dblclick', handleDoubleClick));

    const handleMove = (clientY: number) => {
      if (this.isDragging) {
        const deltaY = this.startY - clientY;
        // Sensitivity: 150px to go from min to max linear percentage
        const valueDelta = deltaY / 150;
        
        // Update the linear percentage tracker
        this.currentLinearPosition = Math.min(1.0, Math.max(0.0, this.startValue + valueDelta));
        
        // Translate linear percentage into final mapped physical value
        let rawValue = this.calculateValueFromLinear(this.currentLinearPosition);
        rawValue = Math.min(this.max, Math.max(this.min, rawValue));
        
        // Handle optional step snapping
        if (this.step && this.step > 0) {
          this.currentValue = Math.round(rawValue / this.step) * this.step;
          this.currentValue = Math.min(this.max, Math.max(this.min, this.currentValue));
        } else {
          this.currentValue = rawValue;
        }
        
        this.updateVisuals();
        
        // Throttle the actual callback to 60fps to prevent overloading the Web Audio API param queues
        if (this.pendingAnimationFrame === null) {
          this.pendingAnimationFrame = requestAnimationFrame(() => {
            this.onChange(this.currentValue);
            this.pendingAnimationFrame = null;
          });
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    this.cleanupCallbacks.push(() => window.removeEventListener('mousemove', handleMouseMove));

    const handleTouchMove = (e: TouchEvent) => {
      if (this.isDragging) {
        e.preventDefault(); // prevent scrolling while twisting knob
        handleMove(e.touches[0].clientY);
      }
    };
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    this.cleanupCallbacks.push(() => window.removeEventListener('touchmove', handleTouchMove));

    const handleEnd = () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
    this.cleanupCallbacks.push(() => window.removeEventListener('mouseup', handleEnd));
    this.cleanupCallbacks.push(() => window.removeEventListener('touchend', handleEnd));
    this.cleanupCallbacks.push(() => window.removeEventListener('touchcancel', handleEnd));
  }

  private updateVisuals() {
    this.valueElement.textContent = this.formatValue(this.currentValue);
    
    // Snap the visual position if a step is defined, otherwise use the smooth linear tracker
    const visualLinearPos = (this.step && this.step > 0) 
      ? this.calculateLinearFromValue(this.currentValue) 
      : this.currentLinearPosition;
      
    // Map linear percentage to rotation (-135deg to +135deg)
    const degrees = -135 + (visualLinearPos * 270);
    this.knobElement.style.transform = `rotate(${degrees}deg)`;
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.pendingAnimationFrame !== null) {
      cancelAnimationFrame(this.pendingAnimationFrame);
      this.pendingAnimationFrame = null;
    }

    this.isDragging = false;
    document.body.style.cursor = '';

    this.cleanupCallbacks.forEach(cleanup => cleanup());
    this.cleanupCallbacks = [];
  }
}
