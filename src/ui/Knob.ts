export class Knob {
  private container: HTMLElement;
  private knobElement: HTMLElement;
  private valueElement: HTMLElement;
  
  private min: number;
  private max: number;
  private currentValue: number;
  private onChange: (val: number) => void;

  private isDragging = false;
  private startY = 0;
  private startValue = 0;

  constructor(
    container: HTMLElement, 
    label: string, 
    min: number, 
    max: number, 
    initialValue: number, 
    onChange: (val: number) => void
  ) {
    this.container = container;
    this.min = min;
    this.max = max;
    this.currentValue = initialValue;
    this.onChange = onChange;

    this.container.classList.add('control-group');
    this.container.innerHTML = `
      <div class="label">${label}</div>
      <div class="knob-container">
        <div class="knob"></div>
      </div>
      <div class="value-display" style="font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums;">${this.formatValue(initialValue)}</div>
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

  private initEvents() {
    const knobContainer = this.container.querySelector('.knob-container') as HTMLElement;

    knobContainer.addEventListener('mousedown', (e) => {
      e.stopPropagation(); // Prevent workspace drag
      this.isDragging = true;
      this.startY = e.clientY;
      this.startValue = this.currentValue;
      document.body.style.cursor = 'ns-resize';
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const deltaY = this.startY - e.clientY;
        // Sensitivity: 150px to go from min to max
        const range = this.max - this.min;
        const valueDelta = (deltaY / 150) * range;
        
        this.currentValue = Math.min(this.max, Math.max(this.min, this.startValue + valueDelta));
        
        this.updateVisuals();
        this.onChange(this.currentValue);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.cursor = '';
      }
    });
  }

  private updateVisuals() {
    this.valueElement.textContent = this.formatValue(this.currentValue);
    
    // Map value to rotation (-135deg to +135deg)
    const percentage = (this.currentValue - this.min) / (this.max - this.min);
    const degrees = -135 + (percentage * 270);
    this.knobElement.style.transform = `rotate(${degrees}deg)`;
  }
}
