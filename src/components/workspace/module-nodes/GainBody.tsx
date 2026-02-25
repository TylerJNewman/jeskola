import { useCallback } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { GainModule } from '@/audio/nodes/GainModule'
import { registerModuleBody } from '@/lib/module-body-registry'

function GainBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as GainModule | undefined
  if (!audio) return null

  const state = audio.state as { level: number }

  const handleLevel = useCallback((val: number) => {
    audio.setGain(val)
    audio.state = { ...audio.state, level: val }
  }, [audio])

  return (
    <div className="flex justify-center">
      <Knob
        label="LEVEL"
        min={0}
        max={2}
        value={state.level ?? 0.5}
        defaultValue={0.5}
        onChange={handleLevel}
      />
    </div>
  )
}

registerModuleBody('gain', GainBody)
export { GainBody }
