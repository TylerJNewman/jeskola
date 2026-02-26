import { useCallback } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { DelayModule } from '@/audio/nodes/DelayModule'
import { registerModuleBody } from '@/lib/module-body-registry'
import { WORKSPACE_LAYOUT } from '@/lib/workspace-layout'

function DelayBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as DelayModule | undefined

  const handleTime = useCallback((val: number) => {
    audio!.setTime(val)
    audio!.patchState({ time: val })
  }, [audio])

  const handleFeedback = useCallback((val: number) => {
    audio!.setFeedback(val)
    audio!.patchState({ feedback: val })
  }, [audio])

  const handleMix = useCallback((val: number) => {
    audio!.setMix(val)
    audio!.patchState({ mix: val })
  }, [audio])

  if (!audio) return null

  const state = audio.state as { time: number; feedback: number; mix: number }

  return (
    <div className="flex justify-center" style={{ gap: WORKSPACE_LAYOUT.module.controlRowGap }}>
      <Knob label="TIME" min={0} max={2} value={state.time ?? 0.4} defaultValue={0.4} onChange={handleTime} />
      <Knob label="FB" min={0} max={1} value={state.feedback ?? 0.4} defaultValue={0.4} onChange={handleFeedback} />
      <Knob label="MIX" min={0} max={1} value={state.mix ?? 0.5} defaultValue={0.5} onChange={handleMix} />
    </div>
  )
}

registerModuleBody('delay', DelayBody)
export { DelayBody }
