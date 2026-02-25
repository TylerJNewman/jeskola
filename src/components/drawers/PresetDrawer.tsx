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
