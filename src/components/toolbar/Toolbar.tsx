import { TransportControls } from './TransportControls'
import { FileControls } from './FileControls'
import { AudioToggle } from './AudioToggle'
import { SectionChips } from '@/components/drawers/SectionDrawer'
import type { Section } from '@/components/drawers/SectionDrawer'
import { cn } from '@/lib/utils'

export function Toolbar({
  onSectionToggle,
  onApplyToggle,
  applyOpen,
}: {
  onSectionToggle: (section: Section | null) => void
  onApplyToggle: () => void
  applyOpen: boolean
}) {
  return (
    <header className="h-[44px] bg-panel border-b border-border-light shadow-sm flex items-center px-4 z-[100] shrink-0 gap-4">
      <h1 className="text-sm font-semibold tracking-[2px] text-text-main mr-2">
        SYNTHESIS
      </h1>

      <div className="w-px h-5 bg-border-light" />
      <TransportControls />

      <div className="w-px h-5 bg-border-light" />
      <FileControls />

      <div className="w-px h-5 bg-border-light" />
      <SectionChips onToggle={onSectionToggle} />

      <div className="w-px h-5 bg-border-light" />
      <button
        onClick={onApplyToggle}
        className={cn(
          "text-[10px] uppercase tracking-wide px-2.5 py-1 border rounded-[4px] transition-colors cursor-pointer",
          applyOpen
            ? "bg-accent-orange text-white border-accent-orange"
            : "bg-panel border-border text-text-light hover:border-accent-orange"
        )}
      >
        Apply
      </button>

      <div className="flex-1" />
      <AudioToggle />
    </header>
  )
}
