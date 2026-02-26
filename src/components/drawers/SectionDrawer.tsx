import { useState, useCallback } from 'react'
import { PresetDrawer } from './PresetDrawer'
import { StackDrawer } from './StackDrawer'
import { RecipeDrawer } from './RecipeDrawer'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
    <div className="flex items-center gap-3">
      {SECTIONS.map(s => (
        <Button
          key={s.key}
          onClick={() => handleClick(s.key)}
          variant="rams-text"
          size="rams-toolbar-box"
          className={cn(
            "transition-colors px-4.5 tracking-[0.55px]",
            active === s.key
              ? "text-text-main"
              : "text-text-muted hover:text-text-main"
          )}
        >
          {s.label}
        </Button>
      ))}
    </div>
  )
}

export function SectionPanel({ section }: { section: Section | null }) {
  if (!section) return null

  return (
    <aside className="fixed left-0 top-[48px] w-[280px] z-[90] max-h-[calc(100vh-48px)]">
      <Card variant="rams" className="h-full max-h-[calc(100vh-48px)] overflow-y-auto rounded-none border-l-0 border-t-0 border-b-0 border-r border-border-light shadow-md">
      <CardHeader className="px-4 py-2.5 border-b border-border-light">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-[1px] text-text-muted">
          {section}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4">
        {section === 'recipe' && <RecipeDrawer />}
        {section === 'preset' && <PresetDrawer />}
        {section === 'stack' && <StackDrawer />}
      </CardContent>
      </Card>
    </aside>
  )
}
