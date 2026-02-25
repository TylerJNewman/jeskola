import { useState, useEffect, useCallback } from 'react'
import {
  PRESETS, PRESET_LABELS, PRESET_ORDER,
  RECIPE_LABELS, RECIPE_ORDER,
  buildStackedPreset,
  buildRecipePreset,
} from '@/lib/presets'
import { importPatch } from '@/lib/patch-serialization'
import { previewApply, applyPatch } from '@/lib/apply-engine'
import type { ApplyMode, ApplyTarget, ApplySummary } from '@/lib/apply-engine'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAudioEngine } from '@/hooks/use-audio-engine'

const STACK_COMBOS = [
  { label: 'Acid Movement', baseKey: 'acid-drive', modifiers: ['slow-wobble', 'envelope-pump'] },
  { label: 'Dub Motion Bus', baseKey: 'dub-chord-echo', modifiers: ['slow-wobble', 'drive-boost'] },
  { label: 'Mono Lead Plus', baseKey: 'classic-mono-lead', modifiers: ['slow-wobble', 'envelope-pump'] },
  { label: 'Sub Heavy Wobble', baseKey: 'sub-bass', modifiers: ['drive-boost', 'slow-wobble'] },
  { label: 'FM Space Bell', baseKey: 'electro-fm-bell', modifiers: ['wide-echo'] },
]

const MODES: { value: ApplyMode; label: string }[] = [
  { value: 'add_chain', label: 'Add Chain' },
  { value: 'add_modulation', label: 'Add Modulation' },
  { value: 'add_send', label: 'Add Send FX' },
  { value: 'add_layer', label: 'Add Layer' },
  { value: 'replace', label: 'Replace' },
]

const TARGET_TYPES: { value: ApplyTarget; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'before_module', label: 'Before Module' },
  { value: 'after_module', label: 'After Module' },
  { value: 'parallel_to_module', label: 'Parallel To' },
  { value: 'master_send', label: 'Master Send' },
]

export function ApplyDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sourceType, setSourceType] = useState<'preset' | 'stack' | 'recipe'>('preset')
  const [sourceKey, setSourceKey] = useState('')
  const [mode, setMode] = useState<ApplyMode>('add_chain')
  const [targetType, setTargetType] = useState<ApplyTarget>('auto')
  const [targetModuleId, setTargetModuleId] = useState('')
  const [preview, setPreview] = useState<ApplySummary | null>(null)
  const modules = useWorkspaceStore(s => s.listModules())
  const { initialize, audioState } = useAudioEngine()

  const getSourceJson = useCallback((): string => {
    if (sourceType === 'preset') return PRESETS[sourceKey] || ''
    if (sourceType === 'recipe') {
      try {
        return buildRecipePreset(sourceKey, 0).json
      } catch {
        return ''
      }
    }
    const idx = Number(sourceKey)
    const combo = STACK_COMBOS[idx]
    if (!combo) return ''
    try {
      return buildStackedPreset(combo.baseKey, combo.modifiers).json
    } catch {
      return ''
    }
  }, [sourceType, sourceKey])

  useEffect(() => {
    const json = getSourceJson()
    if (!json) {
      setPreview(null)
      return
    }
    const result = previewApply(json, { mode, targetType, targetModuleId: targetModuleId || undefined })
    setPreview(result)
  }, [getSourceJson, mode, targetType, targetModuleId])

  const sourceItems = sourceType === 'preset'
    ? PRESET_ORDER.map(k => ({ value: k, label: PRESET_LABELS[k] || k }))
    : sourceType === 'recipe'
    ? RECIPE_ORDER.map(k => ({ value: k, label: RECIPE_LABELS[k] || k }))
    : STACK_COMBOS.map((c, i) => ({ value: String(i), label: c.label }))

  const handleApply = async () => {
    const json = getSourceJson()
    if (!json) return
    if (audioState === 'stopped') await initialize()

    if (mode === 'replace') {
      importPatch(json)
    } else {
      applyPatch(json, { mode, targetType, targetModuleId: targetModuleId || undefined })
    }
  }

  const handleReplace = async () => {
    const json = getSourceJson()
    if (!json) return
    if (audioState === 'stopped') await initialize()
    importPatch(json)
  }

  if (!open) return null

  return (
    <aside className="fixed right-[140px] top-[44px] w-[260px] bg-panel border-l border-border-light shadow-md z-[90] max-h-[calc(100vh-44px)] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-light">
        <h2 className="text-[11px] font-semibold uppercase tracking-[1px] text-text-muted">Apply</h2>
        <button onClick={onClose} className="text-text-muted hover:text-accent-orange cursor-pointer text-sm">
          ×
        </button>
      </div>

      <div className="p-4 flex flex-col gap-2.5">
        {/* Source type */}
        <select
          value={sourceType}
          onChange={e => { setSourceType(e.target.value as 'preset' | 'stack' | 'recipe'); setSourceKey('') }}
          className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full focus:outline-none focus:border-accent-orange"
        >
          <option value="preset">PRESET</option>
          <option value="stack">STACK</option>
          <option value="recipe">RECIPE</option>
        </select>

        {/* Source item */}
        <select
          value={sourceKey}
          onChange={e => setSourceKey(e.target.value)}
          className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full focus:outline-none focus:border-accent-orange"
        >
          <option value="">Select source...</option>
          {sourceItems.map(item => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>

        {/* Mode */}
        <select
          value={mode}
          onChange={e => setMode(e.target.value as ApplyMode)}
          className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full focus:outline-none focus:border-accent-orange"
        >
          {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        {/* Target type */}
        <select
          value={targetType}
          onChange={e => setTargetType(e.target.value as ApplyTarget)}
          className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full focus:outline-none focus:border-accent-orange"
        >
          {TARGET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Target module */}
        <select
          value={targetModuleId}
          onChange={e => setTargetModuleId(e.target.value)}
          className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full focus:outline-none focus:border-accent-orange"
        >
          <option value="">Target Module (auto)</option>
          {modules.map(m => (
            <option key={m.id} value={m.id}>{m.id} ({m.type})</option>
          ))}
        </select>

        {/* Preview */}
        {preview && (
          <pre className="text-[9px] text-text-muted bg-bg rounded-[4px] p-2 border border-border-light whitespace-pre-wrap">
            {`+${preview.modulesAdded} modules\n+${preview.connectionsAdded} connections\n~${preview.routesRewired} rewired\n${preview.idsRenamed} renamed`}
            {preview.warnings.length > 0 && `\n\n${preview.warnings.join('\n')}`}
          </pre>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleApply}
            disabled={!sourceKey}
            className="flex-1 text-[10px] uppercase tracking-wide py-1.5 bg-accent-orange text-white rounded-[4px] hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer disabled:cursor-default"
          >
            Apply
          </button>
          <button
            onClick={handleReplace}
            disabled={!sourceKey}
            className="text-[10px] uppercase tracking-wide px-2.5 py-1.5 bg-panel border border-border rounded-[4px] text-text-light hover:border-accent-orange disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-default"
          >
            Replace
          </button>
        </div>
      </div>
    </aside>
  )
}
