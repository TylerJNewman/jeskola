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
