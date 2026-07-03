import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyPatch, previewApply } from '@/lib/apply-engine'
import type { ApplyMode, ApplySummary, ApplyTarget } from '@/lib/apply-engine'
import { exportSelectedPatch } from '@/lib/patch-serialization'
import {
  loadCustomVoiceLibrary,
  upsertCustomVoicePreset,
  renameCustomVoicePreset,
  duplicateCustomVoicePreset,
  deleteCustomVoicePreset,
  type CustomVoicePreset,
} from '@/lib/custom-voices'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAudioEngine } from '@/hooks/use-audio-engine'
import { Button } from '@/components/ui/button'

const MODES: { value: ApplyMode; label: string }[] = [
  { value: 'add_chain', label: 'Add Chain' },
  { value: 'add_modulation', label: 'Add Modulation' },
  { value: 'add_send', label: 'Add Send FX' },
  { value: 'add_layer', label: 'Add Layer' },
]

const TARGET_TYPES: { value: ApplyTarget; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'before_module', label: 'Before Module' },
  { value: 'after_module', label: 'After Module' },
  { value: 'parallel_to_module', label: 'Parallel To' },
  { value: 'master_send', label: 'Master Send' },
]

export function VoiceDrawer() {
  const [name, setName] = useState('')
  const [library, setLibrary] = useState<CustomVoicePreset[]>([])
  const [mode, setMode] = useState<ApplyMode>('add_chain')
  const [targetType, setTargetType] = useState<ApplyTarget>('auto')
  const [targetModuleId, setTargetModuleId] = useState('')
  const [activeId, setActiveId] = useState('')
  const [preview, setPreview] = useState<ApplySummary | null>(null)
  const [message, setMessage] = useState('')
  const selectedCount = useWorkspaceStore(s => s.selectedModuleIds.size)
  const modulesMap = useWorkspaceStore(s => s.modules)
  const { initialize, audioState } = useAudioEngine()

  const modules = useMemo(() =>
    Array.from(modulesMap.entries())
      .filter(([id]) => id !== 'master')
      .map(([id, m]) => ({ id, type: m.type })),
    [modulesMap]
  )

  const refresh = useCallback(() => {
    const loaded = loadCustomVoiceLibrary().items
    setLibrary(loaded)
    if (loaded.length === 0) {
      setActiveId('')
      return
    }
    if (!loaded.some(item => item.id === activeId)) {
      setActiveId(loaded[0].id)
    }
  }, [activeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const activePreset = useMemo(
    () => library.find(item => item.id === activeId) || null,
    [library, activeId]
  )

  useEffect(() => {
    if (!activePreset) {
      setPreview(null)
      return
    }

    const result = previewApply(JSON.stringify(activePreset.patch), {
      mode,
      targetType,
      targetModuleId: targetModuleId || undefined,
    })
    setPreview(result)
  }, [activePreset, mode, targetType, targetModuleId])

  const handleSaveSelection = () => {
    const json = exportSelectedPatch()
    if (!json) {
      setMessage('Select at least one non-master module to save.')
      return
    }

    try {
      const saved = upsertCustomVoicePreset({
        name: name.trim() || 'Untitled Voice',
        patch: JSON.parse(json),
      })
      setName(saved.name)
      setActiveId(saved.id)
      setMessage(`Saved "${saved.name}".`)
      refresh()
    } catch (error) {
      setMessage((error as Error).message || 'Failed to save voice.')
    }
  }

  const handleApply = async (item: CustomVoicePreset) => {
    if (audioState === 'stopped') await initialize()

    const summary = applyPatch(JSON.stringify(item.patch), {
      mode,
      targetType,
      targetModuleId: targetModuleId || undefined,
    })
    setPreview(summary)
    setMessage(`Applied "${item.name}".`)
  }

  const handleRename = (item: CustomVoicePreset) => {
    const nextName = window.prompt('Rename voice preset', item.name)
    if (nextName == null) return
    const trimmed = nextName.trim()
    if (!trimmed) return
    const renamed = renameCustomVoicePreset(item.id, trimmed)
    if (!renamed) {
      setMessage('Voice preset not found.')
      return
    }
    setMessage(`Renamed to "${renamed.name}".`)
    refresh()
  }

  const handleDuplicate = (item: CustomVoicePreset) => {
    const duplicated = duplicateCustomVoicePreset(item.id)
    if (!duplicated) {
      setMessage('Voice preset not found.')
      return
    }
    setActiveId(duplicated.id)
    setMessage(`Duplicated "${duplicated.name}".`)
    refresh()
  }

  const handleDelete = (item: CustomVoicePreset) => {
    const confirmed = window.confirm(`Delete "${item.name}"?`)
    if (!confirmed) return
    if (!deleteCustomVoicePreset(item.id)) {
      setMessage('Voice preset not found.')
      return
    }
    setMessage(`Deleted "${item.name}".`)
    refresh()
  }

  return (
    <div className="flex flex-col gap-3" data-testid="voice-drawer">
      <div className="flex flex-col gap-2">
        <input
          data-testid="voice-name-input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Voice name..."
          className="h-8 text-[11px] bg-bg border border-border rounded-[4px] px-2 text-text-main focus:outline-none focus:border-accent-orange"
        />
        <Button
          data-testid="voice-save-selection"
          onClick={handleSaveSelection}
          disabled={selectedCount === 0}
          variant="rams"
          size="rams"
          className="w-full transition-colors hover:border-accent-orange disabled:opacity-40"
        >
          Save Selection ({selectedCount})
        </Button>
      </div>

      <div className="w-full h-px bg-border-light" />

      <div className="flex flex-col gap-2">
        <span className="text-[9px] text-text-muted uppercase tracking-wide">
          Apply Settings
        </span>
        <select
          data-testid="voice-apply-mode"
          value={mode}
          onChange={e => setMode(e.target.value as ApplyMode)}
          className="control-select text-[11px] bg-bg border border-border rounded-[4px] text-text-light w-full focus:outline-none focus:border-accent-orange"
        >
          {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select
          data-testid="voice-apply-target-type"
          value={targetType}
          onChange={e => setTargetType(e.target.value as ApplyTarget)}
          className="control-select text-[11px] bg-bg border border-border rounded-[4px] text-text-light w-full focus:outline-none focus:border-accent-orange"
        >
          {TARGET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          data-testid="voice-apply-target-module"
          value={targetModuleId}
          onChange={e => setTargetModuleId(e.target.value)}
          className="control-select text-[11px] bg-bg border border-border rounded-[4px] text-text-light w-full focus:outline-none focus:border-accent-orange"
        >
          <option value="">Target Module (auto)</option>
          {modules.map(m => (
            <option key={m.id} value={m.id}>{m.id} ({m.type})</option>
          ))}
        </select>
      </div>

      {preview && (
        <pre className="text-[9px] text-text-muted bg-bg rounded-[4px] p-2 border border-border-light whitespace-pre-wrap" data-testid="voice-preview">
          {`+${preview.modulesAdded} modules\n+${preview.connectionsAdded} connections\n~${preview.routesRewired} rewired\n${preview.idsRenamed} renamed`}
          {preview.warnings.length > 0 && `\n\n${preview.warnings.join('\n')}`}
        </pre>
      )}

      {message && (
        <p className="text-[9px] text-text-muted" data-testid="voice-message">
          {message}
        </p>
      )}

      <div className="w-full h-px bg-border-light" />

      <div className="flex flex-col gap-2.5">
        <span className="text-[9px] text-text-muted uppercase tracking-wide">
          Library ({library.length})
        </span>
        {library.length === 0 && (
          <p className="text-[9px] text-text-muted">
            No saved voices yet.
          </p>
        )}
        {library.map(item => (
          <div
            key={item.id}
            data-testid={`voice-item-${item.id}`}
            className={`border rounded-[4px] p-2.5 ${activeId === item.id ? 'border-accent-orange' : 'border-border-light'}`}
          >
            <button
              onClick={() => setActiveId(item.id)}
              className="text-[11px] text-left w-full text-text-main cursor-pointer"
            >
              {item.name}
            </button>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button
                onClick={() => handleApply(item)}
                variant="rams-primary"
                size="rams"
                className="h-6 px-2 text-[9px]"
              >
                Apply
              </Button>
              <Button
                onClick={() => handleRename(item)}
                variant="rams"
                size="rams"
                className="h-6 px-2 text-[9px] transition-colors hover:border-accent-orange"
              >
                Rename
              </Button>
              <Button
                onClick={() => handleDuplicate(item)}
                variant="rams"
                size="rams"
                className="h-6 px-2 text-[9px] transition-colors hover:border-accent-orange"
              >
                Duplicate
              </Button>
              <Button
                onClick={() => handleDelete(item)}
                variant="rams"
                size="rams"
                className="h-6 px-2 text-[9px] transition-colors hover:border-accent-orange"
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

