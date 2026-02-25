import { useRef } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAudioEngine } from '@/hooks/use-audio-engine'
import { exportPatch, importPatch } from '@/lib/patch-serialization'

export function FileControls() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { initialize, audioState } = useAudioEngine()
  const initialized = useWorkspaceStore(s => s.initialized)

  const handleSave = () => {
    if (!initialized) return
    const json = exportPatch()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'jeskola_patch.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleLoad = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (audioState === 'stopped') await initialize()

    const text = await file.text()
    importPatch(text)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleSave}
        className="text-[10px] uppercase tracking-wide px-2.5 py-1 bg-panel border border-border rounded-[4px] text-text-light hover:border-accent-orange transition-colors cursor-pointer"
      >
        Save
      </button>
      <button
        onClick={handleLoad}
        className="text-[10px] uppercase tracking-wide px-2.5 py-1 bg-panel border border-border rounded-[4px] text-text-light hover:border-accent-orange transition-colors cursor-pointer"
      >
        Load
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
