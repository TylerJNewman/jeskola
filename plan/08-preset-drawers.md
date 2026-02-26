# Phase 08 — Preset, Stack, and Recipe Drawers

## Goal
Implement the three preset browsing drawers (Recipe, Preset, Stack) with section chips that toggle floating panels. Port the preset data from `_old_presets.ts` unchanged. After this phase, users can browse and load all 15 base presets, 10 composed presets, 5 stacked presets with custom builder, and 6 recipes with morph sliders.

## Depends On
Phase 07 (toolbar, import/patch serialization)

---

## Steps

### 1. Move preset data

Copy `src/_old_presets.ts` to `src/lib/presets.ts`. This file is pure data and functions — no DOM code. It works as-is. Just rename it:

```bash
cp src/_old_presets.ts src/lib/presets.ts
```

The file exports these constants and functions that the drawers need:
- `PRESETS`, `PRESET_LABELS`, `PRESET_ORDER`
- `RECIPES`, `RECIPE_LABELS`, `RECIPE_ORDER`, `RECIPE_DESCRIPTIONS`, `RECIPE_MORPH_LABELS`
- `STACK_BASE_ORDER`, `STACK_BASE_LABELS`, `STACK_MODIFIER_ORDER`, `STACK_MODIFIER_LABELS`
- `buildStackedPreset(baseKey, modifierKeys[])` → `StackedPresetResult`
- `buildRecipePreset(recipeKey, morphAmount)` → `StackedPresetResult`

No modifications needed — it's pure TypeScript with no UI dependencies.

### 2. Create PresetDrawer

Create `src/components/drawers/PresetDrawer.tsx`:

```tsx
import { useState } from 'react'
import { PRESETS, PRESET_LABELS, PRESET_ORDER } from '@/lib/presets'
import { importPatch } from '@/lib/patch-serialization'
import { useAudioEngine } from '@/hooks/use-audio-engine'

export function PresetDrawer() {
  const [selected, setSelected] = useState('')
  const { initialize, audioState } = useAudioEngine()

  const handleLoad = async () => {
    if (!selected || !PRESETS[selected]) return
    if (audioState === 'stopped') await initialize()
    importPatch(PRESETS[selected])
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full focus:outline-none focus:border-accent-orange"
      >
        <option value="">Select a Preset...</option>
        {PRESET_ORDER.map(key => (
          <option key={key} value={key}>
            {PRESET_LABELS[key] || key}
          </option>
        ))}
      </select>
      <button
        onClick={handleLoad}
        disabled={!selected}
        className="text-[10px] uppercase tracking-wide px-3 py-1.5 bg-panel border border-border rounded-[4px] text-text-light hover:border-accent-orange disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-default"
      >
        Load Preset
      </button>
    </div>
  )
}
```

### 3. Create StackDrawer

Create `src/components/drawers/StackDrawer.tsx`:

```tsx
import { useState } from 'react'
import {
  STACK_BASE_ORDER, STACK_BASE_LABELS,
  STACK_MODIFIER_ORDER, STACK_MODIFIER_LABELS,
  buildStackedPreset,
} from '@/lib/presets'
import { importPatch } from '@/lib/patch-serialization'
import { useAudioEngine } from '@/hooks/use-audio-engine'

const STACK_PRESET_COMBOS = [
  { label: 'Acid Movement', baseKey: 'acid-drive', modifiers: ['slow-wobble', 'envelope-pump'] },
  { label: 'Dub Motion Bus', baseKey: 'dub-chord-echo', modifiers: ['slow-wobble', 'drive-boost'] },
  { label: 'Mono Lead Plus', baseKey: 'classic-mono-lead', modifiers: ['slow-wobble', 'envelope-pump'] },
  { label: 'Sub Heavy Wobble', baseKey: 'sub-bass', modifiers: ['drive-boost', 'slow-wobble'] },
  { label: 'FM Space Bell', baseKey: 'electro-fm-bell', modifiers: ['wide-echo'] },
]

function ModifierSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      title={label}
      className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full focus:outline-none focus:border-accent-orange"
    >
      <option value="">{label}</option>
      {STACK_MODIFIER_ORDER.map(key => (
        <option key={key} value={key}>
          {STACK_MODIFIER_LABELS[key] || key}
        </option>
      ))}
    </select>
  )
}

export function StackDrawer() {
  const [baseKey, setBaseKey] = useState(STACK_BASE_ORDER[0] || '')
  const [mod1, setMod1] = useState('')
  const [mod2, setMod2] = useState('')
  const [mod3, setMod3] = useState('')
  const [comboIndex, setComboIndex] = useState('')
  const { initialize, audioState } = useAudioEngine()

  const loadStack = async () => {
    if (audioState === 'stopped') await initialize()
    const modifiers = [mod1, mod2, mod3].filter(Boolean)
    const unique = [...new Set(modifiers)]
    try {
      const result = buildStackedPreset(baseKey, unique)
      importPatch(result.json)
    } catch (e) {
      console.error('Stack build failed:', e)
    }
  }

  const loadCombo = async () => {
    if (comboIndex === '') return
    const combo = STACK_PRESET_COMBOS[Number(comboIndex)]
    if (!combo) return

    if (audioState === 'stopped') await initialize()

    setBaseKey(combo.baseKey)
    setMod1(combo.modifiers[0] || '')
    setMod2(combo.modifiers[1] || '')
    setMod3(combo.modifiers[2] || '')

    try {
      const result = buildStackedPreset(combo.baseKey, combo.modifiers)
      importPatch(result.json)
    } catch (e) {
      console.error('Stack combo failed:', e)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Quick stack presets */}
      <div className="flex gap-1.5">
        <select
          value={comboIndex}
          onChange={e => setComboIndex(e.target.value)}
          className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light flex-1 focus:outline-none focus:border-accent-orange"
        >
          <option value="">Stack Presets...</option>
          {STACK_PRESET_COMBOS.map((c, i) => (
            <option key={i} value={String(i)}>{c.label}</option>
          ))}
        </select>
        <button
          onClick={loadCombo}
          disabled={comboIndex === ''}
          className="text-[10px] uppercase tracking-wide px-2.5 py-1.5 bg-panel border border-border rounded-[4px] text-text-light hover:border-accent-orange disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-default whitespace-nowrap"
        >
          Load
        </button>
      </div>

      <div className="w-full h-px bg-border-light" />

      {/* Custom stack builder */}
      <span className="text-[9px] text-text-muted uppercase tracking-wide">
        Custom Stack
      </span>

      <select
        value={baseKey}
        onChange={e => setBaseKey(e.target.value)}
        className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full focus:outline-none focus:border-accent-orange"
      >
        {STACK_BASE_ORDER.map(key => (
          <option key={key} value={key}>
            {STACK_BASE_LABELS[key] || key}
          </option>
        ))}
      </select>

      <ModifierSelect label="Modifier 1" value={mod1} onChange={setMod1} />
      <ModifierSelect label="Modifier 2" value={mod2} onChange={setMod2} />
      <ModifierSelect label="Modifier 3" value={mod3} onChange={setMod3} />

      <button
        onClick={loadStack}
        className="text-[10px] uppercase tracking-wide px-3 py-1.5 bg-panel border border-border rounded-[4px] text-text-light hover:border-accent-orange transition-colors cursor-pointer"
      >
        Load Stack
      </button>

      <span className="text-[9px] text-text-muted">
        Pick a base + up to 3 modifiers, or use a Stack Preset.
      </span>
    </div>
  )
}
```

### 4. Create RecipeDrawer

Create `src/components/drawers/RecipeDrawer.tsx`:

```tsx
import { useState, useRef, useCallback } from 'react'
import {
  RECIPES, RECIPE_LABELS, RECIPE_ORDER,
  RECIPE_DESCRIPTIONS, RECIPE_MORPH_LABELS,
  buildRecipePreset,
} from '@/lib/presets'
import { importPatch } from '@/lib/patch-serialization'
import { useAudioEngine } from '@/hooks/use-audio-engine'

export function RecipeDrawer() {
  const [selected, setSelected] = useState('')
  const [activeRecipe, setActiveRecipe] = useState('')
  const [morphValue, setMorphValue] = useState(0)
  const morphTimerRef = useRef<number | null>(null)
  const { initialize, audioState } = useAudioEngine()

  const description = selected ? (RECIPE_DESCRIPTIONS[selected] || '') : ''
  const morphLabel = activeRecipe ? (RECIPE_MORPH_LABELS[activeRecipe] || 'Morph') : 'Morph'

  const applyMorph = useCallback((recipeKey: string, amount: number) => {
    try {
      const result = buildRecipePreset(recipeKey, amount)
      importPatch(result.json)
    } catch (e) {
      console.error('Recipe morph failed:', e)
    }
  }, [])

  const handleLoad = async () => {
    if (!selected || !RECIPES[selected]) return
    if (audioState === 'stopped') await initialize()
    setActiveRecipe(selected)
    setMorphValue(0)
    applyMorph(selected, 0)
  }

  const handleMorphChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setMorphValue(val)

    if (!activeRecipe) return

    // Debounce morph application
    if (morphTimerRef.current !== null) {
      window.clearTimeout(morphTimerRef.current)
    }
    morphTimerRef.current = window.setTimeout(() => {
      applyMorph(activeRecipe, val / 100)
      morphTimerRef.current = null
    }, 50)
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full focus:outline-none focus:border-accent-orange"
      >
        <option value="">Select a Recipe...</option>
        {RECIPE_ORDER.map(key => (
          <option key={key} value={key}>
            {RECIPE_LABELS[key] || key}
          </option>
        ))}
      </select>

      {description && (
        <p className="text-[9px] text-text-muted leading-relaxed">
          {description}
        </p>
      )}

      <button
        onClick={handleLoad}
        disabled={!selected}
        className="text-[10px] uppercase tracking-wide px-3 py-1.5 bg-panel border border-border rounded-[4px] text-text-light hover:border-accent-orange disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-default"
      >
        Load Recipe
      </button>

      {/* Morph slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-text-muted uppercase tracking-wide">
            {morphLabel}
          </span>
          <span className="text-[9px] text-text-muted tabular-nums">
            {morphValue}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={morphValue}
          onChange={handleMorphChange}
          disabled={!activeRecipe}
          className="w-full h-1.5 bg-bg rounded-full appearance-none cursor-pointer accent-accent-orange disabled:opacity-40 disabled:cursor-default"
        />
      </div>
    </div>
  )
}
```

### 5. Create SectionDrawer container with chips

Create `src/components/drawers/SectionDrawer.tsx`:

```tsx
import { useState, useCallback } from 'react'
import { PresetDrawer } from './PresetDrawer'
import { StackDrawer } from './StackDrawer'
import { RecipeDrawer } from './RecipeDrawer'
import { cn } from '@/lib/utils'

type Section = 'recipe' | 'preset' | 'stack'

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
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border-light">
        <h2 className="text-[11px] font-semibold uppercase tracking-[1px] text-text-muted">
          {section}
        </h2>
      </div>

      {/* Body */}
      <div className="p-4">
        {section === 'recipe' && <RecipeDrawer />}
        {section === 'preset' && <PresetDrawer />}
        {section === 'stack' && <StackDrawer />}
      </div>
    </aside>
  )
}
```

### 6. Wire drawers into the Toolbar and App

Update `src/components/toolbar/Toolbar.tsx`:

```tsx
import { TransportControls } from './TransportControls'
import { FileControls } from './FileControls'
import { AudioToggle } from './AudioToggle'
import { SectionChips } from '@/components/drawers/SectionDrawer'

type Section = 'recipe' | 'preset' | 'stack'

export function Toolbar({ onSectionToggle }: { onSectionToggle: (section: Section | null) => void }) {
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

      <div className="flex-1" />
      <AudioToggle />
    </header>
  )
}
```

Update `src/components/App.tsx`:

```tsx
import { useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { WorkspaceCanvas } from './workspace/WorkspaceCanvas'
import { ModulePalette } from './palette/ModulePalette'
import { Toolbar } from './toolbar/Toolbar'
import { SectionPanel } from './drawers/SectionDrawer'
import { useKeyboard } from '@/hooks/use-keyboard'

type Section = 'recipe' | 'preset' | 'stack'

export function App() {
  useKeyboard()
  const [activeSection, setActiveSection] = useState<Section | null>(null)

  const handleSectionToggle = useCallback((section: Section | null) => {
    setActiveSection(section)
  }, [])

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-bg">
        <Toolbar onSectionToggle={handleSectionToggle} />

        {/* Section drawer panel */}
        <SectionPanel section={activeSection} />

        <main className="flex-1 relative" style={{ marginRight: 140 }}>
          <WorkspaceCanvas />
        </main>

        <ModulePalette />
      </div>
    </ReactFlowProvider>
  )
}
```

---

## Files Created/Modified

| Action | File |
|--------|------|
| Copy | `src/_old_presets.ts` → `src/lib/presets.ts` |
| Create | `src/components/drawers/PresetDrawer.tsx` |
| Create | `src/components/drawers/StackDrawer.tsx` |
| Create | `src/components/drawers/RecipeDrawer.tsx` |
| Create | `src/components/drawers/SectionDrawer.tsx` |
| Modify | `src/components/toolbar/Toolbar.tsx` |
| Modify | `src/components/App.tsx` |

## Verify It Works

### Preset drawer
1. Click **Preset** chip in toolbar — drawer slides open on left
2. Select "Sub Bass" from dropdown — click **Load Preset**
3. Workspace clears, Sub Bass modules appear with connections
4. Select "Acid Drive + Slow Wobble" (composed) — loads correctly
5. Click **Preset** chip again — drawer closes

### Stack drawer
1. Click **Stack** chip — drawer opens
2. Select "Acid Movement" from Stack Presets dropdown → click **Load** — loads successfully
3. Custom builder: pick "Sub Bass" base + "Drive Boost" modifier → click **Load Stack**
4. Modules appear: sub bass patch + distortion added

### Recipe drawer
1. Click **Recipe** chip — drawer opens
2. Select "Classic Acid Bassline" — description appears below
3. Click **Load Recipe** — acid bassline patch loads
4. **Morph slider** enables — label shows "Acid Intensity"
5. Drag morph to 50% — patch reimports with interpolated state
6. Drag morph to 100% — fully morphed version loads
7. Select a different recipe — morph resets to 0%

### Cross-drawer
1. Switching between chips closes previous drawer, opens new one
2. Clicking the active chip closes the drawer
3. Drawer doesn't overlap module palette on right
