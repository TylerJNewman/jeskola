import { useState } from 'react'
import { PRESETS, PRESET_LABELS, PRESET_ORDER } from '@/lib/presets'
import { importPatch } from '@/lib/patch-serialization'
import { useAudioEngine } from '@/hooks/use-audio-engine'
import { Button } from '@/components/ui/button'

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
        className="control-select text-[11px] bg-bg border border-border rounded-[4px] text-text-light w-full focus:outline-none focus:border-accent-orange"
      >
        <option value="">Select a Preset...</option>
        {PRESET_ORDER.map(key => (
          <option key={key} value={key}>
            {PRESET_LABELS[key] || key}
          </option>
        ))}
      </select>
      <Button
        onClick={handleLoad}
        disabled={!selected}
        variant="rams"
        size="rams"
        className="w-full transition-colors hover:border-accent-orange disabled:opacity-40"
      >
        Load Preset
      </Button>
    </div>
  )
}
