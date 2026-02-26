import { memo } from 'react'
import { cn } from '@/lib/utils'

type SegmentToggleProps = {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  className?: string
  fullWidth?: boolean
}

function SegmentToggleInner({ options, value, onChange, className, fullWidth = true }: SegmentToggleProps) {
  return (
    <div
      className={cn(
        "items-center gap-px bg-bg rounded-[10px] border border-border p-[2px]",
        fullWidth ? "flex w-full" : "inline-flex",
        className
      )}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "text-[12px] leading-none uppercase tracking-[0.5px] min-h-[34px] px-3 py-0.5 rounded-[8px] transition-colors cursor-pointer text-center",
            fullWidth ? "flex-1" : "min-w-[30px]",
            opt.value === value
              ? "bg-panel text-text-main font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
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
