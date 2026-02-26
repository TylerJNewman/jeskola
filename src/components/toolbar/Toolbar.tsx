import { TransportControls } from './TransportControls'
import { FileControls } from './FileControls'
import { AudioToggle } from './AudioToggle'
import { SectionChips } from '@/components/drawers/SectionDrawer'
import type { Section } from '@/components/drawers/SectionDrawer'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

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
    <header className="fixed top-0 left-0 right-0 h-[50px] bg-panel border-b border-border-light shadow-sm z-[100]">
      <div className="h-full w-[calc(100%-96px)] max-w-[1400px] mx-auto px-4 flex items-center gap-5">
        <TransportControls />

        <div className="w-px h-6 bg-border-light" />
        <FileControls />

        <div className="w-px h-6 bg-border-light" />
        <div className="flex items-center gap-2">
          <SectionChips onToggle={onSectionToggle} />
        </div>

        <div className="w-px h-6 bg-border-light" />
        <Button
          onClick={onApplyToggle}
          variant={applyOpen ? 'rams-primary' : 'rams'}
          size="rams-toolbar-box"
          className={cn(
            "transition-colors",
            applyOpen
              ? ""
              : "hover:border-accent-orange"
          )}
        >
          Apply
        </Button>

        <div className="flex-1" />
        <AudioToggle />
      </div>
    </header>
  )
}
