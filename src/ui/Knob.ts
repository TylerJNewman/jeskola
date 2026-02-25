export class Knob {
  private container: HTMLElement;
  private knobElement: HTMLElement;
  private valueElement: HTMLElement;
  
  private min: number;
  private max: number;
  private currentValue: number;
  private onChange: (val: number) => void;

  private isDragging = false;
  private startValue = 0;
  private startY = 0;

  private logCapable: boolean;
  private isLogMode: boolean = false;
  // Linear 0.0 to 1.0 tracker to prevent position jumping when toggling modes
  private currentLinearPosition: number = 0;

  constructor(
    container: HTMLElement, 
    label: string, 
    min: number, 
    max: number, 
    initialValue: number, 
    onChange: (val: number) => void,
    logCapable: boolean = false
  ) {
    this.container = container;
    this.min = min;
    this.max = max;
    this.currentValue = initialValue;
    this.onChange = onChange;
    this.logCapable = logCapable;
    
    // Calculate initial linear position based on initialValue
    this.currentLinearPosition = (initialValue - min) / (max - min);

    this.container.classList.add('control-group');
    
    const toggleHtml = this.logCapable ? 
      `<div class="mini-segment mode-toggle" title="Toggle Scale">
         <span class="segment active" data-mode="lin">LIN</span>
         <span class="segment" data-mode="log">LOG</span>
       </div>` : '';

    this.container.innerHTML = `
      <div class="label">${label}</div>
      <div class="knob-container">
        <div class="knob"></div>
      </div>
      <div style="display:flex; align-items:center;">
        <div class="value-display" style="font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums;">${this.formatValue(initialValue)}</div>
        ${toggleHtml}
      </div>
    `;

    this.knobElement = this.container.querySelector('.knob') as HTMLElement;
    this.valueElement = this.container.querySelector('.value-display') as HTMLElement;

    this.updateVisuals();
    this.initEvents();
  }

  private formatValue(val: number): string {
    // Basic formatting, could be expanded based on parameter type (Hz, ms, etc)
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

  private initEvents() {
    const knobContainer = this.container.querySelector('.knob-container') as HTMLElement;
    const toggleBtn = this.container.querySelector('.mode-toggle') as HTMLElement;

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
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
      });
    }

    const handleStart = (clientY: number) => {
      this.isDragging = true;
      this.startY = clientY;
      // Capture the linear position as the starting point for dragging mechanics
      this.startValue = this.currentLinearPosition;
      document.body.style.cursor = 'ns-resize';
    };

    knobContainer.addEventListener('mousedown', (e) => {
      e.stopPropagation(); // Prevent workspace drag
      handleStart(e.clientY);
    });

    knobContainer.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      handleStart(e.touches[0].clientY);
    }, { passive: false });

    const handleMove = (clientY: number) => {
      if (this.isDragging) {
        const deltaY = this.startY - clientY;
        // Sensitivity: 150px to go from min to max linear percentage
        const valueDelta = deltaY / 150;
        
        // Update the linear percentage tracker
        this.currentLinearPosition = Math.min(1.0, Math.max(0.0, this.startValue + valueDelta));
        
        // Translate linear percentage into final mapped physical value
        this.currentValue = this.calculateValueFromLinear(this.currentLinearPosition);
        this.currentValue = Math.min(this.max, Math.max(this.min, this.currentValue));
        
        this.updateVisuals();
        this.onChange(this.currentValue);
      }
    };

    window.addEventListener('mousemove', (e) => {
      handleMove(e.clientY);
    });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging) {
        e.preventDefault(); // prevent scrolling while twisting knob
        handleMove(e.touches[0].clientY);
      }
    }, { passive: false });

    const handleEnd = () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
  }

  private updateVisuals() {
    this.valueElement.textContent = this.formatValue(this.currentValue);
    
    // Map linear percentage to rotation (-135deg to +135deg)
    const degrees = -135 + (this.currentLinearPosition * 270);
    this.knobElement.style.transform = `rotate(${degrees}deg)`;
  }
}
