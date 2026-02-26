import { useState, useRef, useCallback, useEffect } from 'react'
import {
  RECIPE_LABELS, RECIPE_ORDER,
  RECIPE_DESCRIPTIONS, RECIPE_MORPH_LABELS,
  buildRecipePreset,
} from '@/lib/presets'
import { importPatch } from '@/lib/patch-serialization'
import { useAudioEngine } from '@/hooks/use-audio-engine'
import { Button } from '@/components/ui/button'

export function RecipeDrawer() {
  const [selected, setSelected] = useState('')
  const [activeRecipe, setActiveRecipe] = useState('')
  const [morphValue, setMorphValue] = useState(0)
  const morphTimerRef = useRef<number | null>(null)
  const { initialize, audioState } = useAudioEngine()

  useEffect(() => {
    return () => {
      if (morphTimerRef.current !== null) {
        window.clearTimeout(morphTimerRef.current)
      }
    }
  }, [])

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
    if (!selected) return
    if (audioState === 'stopped') await initialize()
    setActiveRecipe(selected)
    setMorphValue(0)
    applyMorph(selected, 0)
  }

  const handleMorphChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setMorphValue(val)

    if (!activeRecipe) return

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
        className="control-select text-[11px] bg-bg border border-border rounded-[4px] text-text-light w-full focus:outline-none focus:border-accent-orange"
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

      <Button
        onClick={handleLoad}
        disabled={!selected}
        variant="rams"
        size="rams"
        className="w-full transition-colors hover:border-accent-orange disabled:opacity-40"
      >
        Load Recipe
      </Button>

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
