import { useState, useCallback } from 'react'
import { PresetDrawer } from './PresetDrawer'
import { StackDrawer } from './StackDrawer'
import { RecipeDrawer } from './RecipeDrawer'
import { cn } from '@/lib/utils'

export type Section = 'recipe' | 'preset' | 'stack'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'recipe', label: 'Recipe' },
  { key: 'preset', label: 'Preset' },
  { key: 'stack', label: 'Stack' },
]

export function SectionChips({ onToggle }: { onToggle: (section: Section | null) => void }) {
  const [active, setActive] = useState<Section | null>(null)

  const handleClick = useCallback((section: Section) => {
    const next = active === section ? null : section
    setActive(next)
    onToggle(next)
  }, [active, onToggle])

  return (
    <div className="flex gap-1">
      {SECTIONS.map(s => (
        <button
          key={s.key}
          onClick={() => handleClick(s.key)}
          className={cn(
            "text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer border",
            active === s.key
              ? "bg-chip-active border-border text-text-main"
              : "bg-transparent border-transparent text-text-muted hover:text-text-light"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

export function SectionPanel({ section }: { section: Section | null }) {
  if (!section) return null

  return (
    <aside className="fixed left-0 top-[44px] w-[280px] bg-panel border-r border-border-light shadow-md z-[90] max-h-[calc(100vh-44px)] overflow-y-auto">
      <div className="px-4 py-2.5 border-b border-border-light">
        <h2 className="text-[11px] font-semibold uppercase tracking-[1px] text-text-muted">
          {section}
        </h2>
      </div>

      <div className="p-4">
        {section === 'recipe' && <RecipeDrawer />}
        {section === 'preset' && <PresetDrawer />}
        {section === 'stack' && <StackDrawer />}
      </div>
    </aside>
  )
}
