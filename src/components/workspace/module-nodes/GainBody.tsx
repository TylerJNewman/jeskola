import { useCallback } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { GainModule } from '@/audio/nodes/GainModule'
import { registerModuleBody } from '@/lib/module-body-registry'
import { WORKSPACE_LAYOUT } from '@/lib/workspace-layout'

function GainBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as GainModule | undefined

  const handleLevel = useCallback((val: number) => {
    audio!.setGain(val)
    audio!.patchState({ level: val })
  }, [audio])

  if (!audio) return null

  const state = audio.state as { level: number }

  return (
    <div className="flex justify-center" style={{ gap: WORKSPACE_LAYOUT.module.controlRowGap }}>
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
