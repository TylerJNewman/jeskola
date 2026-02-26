import { useCallback, useState } from 'react'
import { Knob } from '@/components/controls/Knob'
import { SegmentToggle } from '@/components/controls/SegmentToggle'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { FilterModule } from '@/audio/nodes/FilterModule'
import { registerModuleBody } from '@/lib/module-body-registry'
import { WORKSPACE_LAYOUT } from '@/lib/workspace-layout'

const FILTER_TYPE_OPTIONS = [
  { value: 'lowpass', label: 'LP' },
  { value: 'highpass', label: 'HP' },
  { value: 'bandpass', label: 'BP' },
]

function FilterBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as FilterModule | undefined

  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate(n => n + 1)

  const handleCutoff = useCallback((val: number) => {
    audio!.setFrequency(val)
    audio!.patchState({ cutoff: val })
  }, [audio])

  const handleCutoffLog = useCallback((isLog: boolean) => {
    audio!.patchState({ cutoffLog: isLog })
  }, [audio])

  const handleRes = useCallback((val: number) => {
    audio!.setResonance(val)
    audio!.patchState({ res: val })
  }, [audio])

  const handleType = useCallback((val: string) => {
    audio!.setType(val as BiquadFilterType)
    audio!.patchState({ type: val })
    rerender()
  }, [audio])

  if (!audio) return null

  const state = audio.state as { cutoff: number; cutoffLog?: boolean; res: number; type: string }

  return (
    <div className="flex flex-col" style={{ gap: WORKSPACE_LAYOUT.module.bodyGap }}>
      <div className="flex justify-center" style={{ gap: WORKSPACE_LAYOUT.module.controlRowGap }}>
        <Knob
          label="CUTOFF"
          min={20} max={10000}
          value={state.cutoff ?? 1000}
          defaultValue={1000}
          onChange={handleCutoff}
          logCapable
          isLogMode={!!state.cutoffLog}
          onModeChange={handleCutoffLog}
        />
        <Knob
          label="RES"
          min={0} max={20}
          value={state.res ?? 1}
          defaultValue={1}
          onChange={handleRes}
        />
      </div>
      <SegmentToggle
        options={FILTER_TYPE_OPTIONS}
        value={state.type ?? 'lowpass'}
        onChange={handleType}
      />
    </div>
  )
}

registerModuleBody('filter', FilterBody)
export { FilterBody }
