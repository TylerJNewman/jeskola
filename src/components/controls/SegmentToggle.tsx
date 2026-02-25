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
