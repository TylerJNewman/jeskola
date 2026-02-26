# Phase 03 — Knob Component

## Goal
Port the `Knob.ts` class to a React component with identical behavior: vertical drag, lin/log modes, step snapping, double-click reset, 60fps throttled onChange. This is foundational — every module body depends on it.

## Depends On
Phase 00 (Tailwind/styles)

---

## Steps

### 1. Create the Knob component

Create `src/components/controls/Knob.tsx`:

```tsx
import { useRef, useCallback, useEffect, useState, memo } from 'react'
import { cn } from '@/lib/utils'

type KnobProps = {
  label: string
  min: number
  max: number
  value: number
  defaultValue?: number
  onChange: (value: number) => void
  logCapable?: boolean
  isLogMode?: boolean
  onModeChange?: (isLog: boolean) => void
  step?: number
  className?: string
}

function formatValue(val: number): string {
  if (val == null || !Number.isFinite(val)) return '—'
  if (val >= 100) return Math.round(val).toString()
  if (val >= 10) return val.toFixed(1)
  return val.toFixed(2)
}

function KnobInner({
  label,
  min,
  max,
  value,
  defaultValue,
  onChange,
  logCapable = false,
  isLogMode: initialLogMode = false,
  onModeChange,
  step,
  className,
}: KnobProps) {
  const [logMode, setLogMode] = useState(initialLogMode)
  const containerRef = useRef<HTMLDivElement>(null)

  // Drag state in refs (no re-renders during drag)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startLinear = useRef(0)
  const currentLinear = useRef(0)
  const currentValue = useRef(value)
  const pendingRaf = useRef<number | null>(null)

  // Keep currentValue ref in sync with prop
  useEffect(() => {
    if (!isDragging.current) {
      currentValue.current = value
      currentLinear.current = calculateLinearFromValue(value, min, max, logMode)
    }
  }, [value, min, max, logMode])

  // --- Math helpers ---
  function calculateValueFromLinear(linear: number): number {
    if (logMode) {
      const safeMin = Math.max(0.0001, min)
      const safeMax = Math.max(safeMin + 0.0001, max)
      return Math.exp(Math.log(safeMin) + linear * (Math.log(safeMax) - Math.log(safeMin)))
    }
    return min + linear * (max - min)
  }

  // --- Visuals ---
  const visualLinear = (step && step > 0)
    ? calculateLinearFromValue(value, min, max, logMode)
    : calculateLinearFromValue(value, min, max, logMode)
  const degrees = -135 + visualLinear * 270

  // --- Drag handlers ---
  const handleStart = useCallback((clientY: number) => {
    isDragging.current = true
    startY.current = clientY
    startLinear.current = currentLinear.current
    document.body.style.cursor = 'ns-resize'
  }, [])

  const handleMove = useCallback((clientY: number) => {
    if (!isDragging.current) return

    const deltaY = startY.current - clientY
    const valueDelta = deltaY / 150 // 150px = full range

    currentLinear.current = Math.min(1.0, Math.max(0.0, startLinear.current + valueDelta))

    let raw = calculateValueFromLinear(currentLinear.current)
    raw = Math.min(max, Math.max(min, raw))

    if (step && step > 0) {
      raw = Math.round(raw / step) * step
      raw = Math.min(max, Math.max(min, raw))
    }

    currentValue.current = raw

    // Update knob visual immediately (no re-render)
    if (containerRef.current) {
      const knobEl = containerRef.current.querySelector('.knob-indicator') as HTMLElement
      const valueEl = containerRef.current.querySelector('.knob-value') as HTMLElement
      if (knobEl) {
        const lin = (step && step > 0)
          ? calculateLinearFromValue(raw, min, max, logMode)
          : currentLinear.current
        knobEl.style.transform = `rotate(${-135 + lin * 270}deg)`
      }
      if (valueEl) {
        valueEl.textContent = formatValue(raw)
      }
    }

    // Throttle callback to 60fps
    if (pendingRaf.current === null) {
      pendingRaf.current = requestAnimationFrame(() => {
        onChange(currentValue.current)
        pendingRaf.current = null
      })
    }
  }, [min, max, step, logMode, onChange])

  const handleEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    document.body.style.cursor = ''
    // Fire final value
    onChange(currentValue.current)
  }, [onChange])

  // --- Global mouse/touch listeners ---
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging.current) {
        e.preventDefault()
        handleMove(e.touches[0].clientY)
      }
    }
    const onMouseUp = () => handleEnd()
    const onTouchEnd = () => handleEnd()

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      if (pendingRaf.current !== null) {
        cancelAnimationFrame(pendingRaf.current)
      }
    }
  }, [handleMove, handleEnd])

  // --- Double-click reset ---
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const def = defaultValue ?? value
    currentValue.current = def
    currentLinear.current = calculateLinearFromValue(def, min, max, logMode)
    onChange(def)
  }, [defaultValue, value, min, max, logMode, onChange])

  // --- Log mode toggle ---
  const handleToggle = useCallback(() => {
    const next = !logMode
    setLogMode(next)
    // Recalculate value from current linear position under new mode
    const newVal = next
      ? (() => {
          const safeMin = Math.max(0.0001, min)
          const safeMax = Math.max(safeMin + 0.0001, max)
          return Math.exp(Math.log(safeMin) + currentLinear.current * (Math.log(safeMax) - Math.log(safeMin)))
        })()
      : min + currentLinear.current * (max - min)
    const clamped = Math.min(max, Math.max(min, newVal))
    currentValue.current = clamped
    onChange(clamped)
    onModeChange?.(next)
  }, [logMode, min, max, onChange, onModeChange])

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <span className="text-[10px] font-medium uppercase text-text-muted">
        {label}
      </span>

      {/* Knob visual */}
      <div
        ref={containerRef}
        className="w-11 h-11 rounded-full bg-panel border border-border shadow-knob flex items-center justify-center cursor-ns-resize relative"
        onMouseDown={(e) => {
          e.stopPropagation()
          handleStart(e.clientY)
        }}
        onTouchStart={(e) => {
          e.stopPropagation()
          handleStart(e.touches[0].clientY)
        }}
        onDoubleClick={handleDoubleClick}
      >
        {/* Rotation indicator */}
        <div
          className="knob-indicator w-8 h-8 rounded-full bg-panel relative"
          style={{ transform: `rotate(${degrees}deg)` }}
        >
          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-[3px] h-2 rounded-full bg-accent-orange" />
        </div>
      </div>

      {/* Value display + optional lin/log toggle */}
      <div className="flex items-center gap-1">
        <span className="knob-value text-[10px] text-text-muted tabular-nums">
          {formatValue(value)}
        </span>
        {logCapable && (
          <button
            onClick={handleToggle}
            className="text-[8px] uppercase tracking-wide px-1 py-0.5 rounded border border-border-light text-text-muted hover:text-accent-blue cursor-pointer transition-colors"
            title="Toggle Scale"
          >
            {logMode ? 'LOG' : 'LIN'}
          </button>
        )}
      </div>
    </div>
  )
}

// Static helper (used above and by parent components)
function calculateLinearFromValue(
  val: number,
  min: number,
  max: number,
  isLog: boolean
): number {
  if (isLog) {
    const safeMin = Math.max(0.0001, min)
    const safeMax = Math.max(safeMin + 0.0001, max)
    const safeVal = Math.max(safeMin, val)
    return (Math.log(safeVal) - Math.log(safeMin)) / (Math.log(safeMax) - Math.log(safeMin))
  }
  if (max === min) return 0
  return Math.min(1, Math.max(0, (val - min) / (max - min)))
}

export const Knob = memo(KnobInner)
```

### 2. Create SegmentToggle component

Used for waveform type selection, filter type, pitch/freq mode, etc.

Create `src/components/controls/SegmentToggle.tsx`:

```tsx
import { memo } from 'react'
import { cn } from '@/lib/utils'

type SegmentToggleProps = {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  className?: string
}

function SegmentToggleInner({ options, value, onChange, className }: SegmentToggleProps) {
  return (
    <div className={cn("flex bg-bg rounded-[4px] border border-border-light overflow-hidden", className)}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "text-[9px] uppercase tracking-wide px-2 py-1 transition-colors cursor-pointer",
            opt.value === value
              ? "bg-panel text-text-main font-medium"
              : "text-text-muted hover:text-text-light"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export const SegmentToggle = memo(SegmentToggleInner)
```

### 3. Add knob styling to globals.css

Append to `src/styles/globals.css`:

```css
/* === Knob Specific === */

/* Prevent text selection during knob drag */
.cursor-ns-resize {
  touch-action: none;
}

/* Tabular nums for value display */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
```

---

## Files Created/Modified

| Action | File |
|--------|------|
| Create | `src/components/controls/Knob.tsx` |
| Create | `src/components/controls/SegmentToggle.tsx` |
| Modify | `src/styles/globals.css` |

## Verify It Works

Create a temporary test in App.tsx to verify the knob works:

```tsx
// Temporary — add inside the header for testing, remove after verification
const [testVal, setTestVal] = useState(440)
// ...
<Knob label="TEST" min={20} max={2000} value={testVal} onChange={setTestVal} logCapable defaultValue={440} />
```

1. Knob renders with "TEST" label, value shows "440"
2. **Drag up** — value increases, knob rotates clockwise
3. **Drag down** — value decreases, knob rotates counter-clockwise
4. **Click LOG/LIN** — toggles between linear and logarithmic scaling
5. **Double-click** — resets to 440 (default value)
6. Dragging is smooth at 60fps, no jank
7. Value display updates in real-time during drag
8. Releasing the mouse stops dragging (cursor returns to normal)
9. Touch drag works (test in Chrome DevTools mobile mode)

Remove the test knob after verification.
