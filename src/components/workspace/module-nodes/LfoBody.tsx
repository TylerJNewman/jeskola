import { useCallback, useState } from 'react'
import { Knob } from '@/components/controls/Knob'
import { SegmentToggle } from '@/components/controls/SegmentToggle'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { LfoModule } from '@/audio/nodes/LfoModule'
import { registerModuleBody } from '@/lib/module-body-registry'

const WAVEFORM_OPTIONS = [
  { value: 'sine', label: 'Sin' },
  { value: 'square', label: 'Sq' },
  { value: 'sawtooth', label: 'Saw' },
  { value: 'triangle', label: 'Tri' },
]

function LfoBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as LfoModule | undefined

  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate(n => n + 1)

  const handleRate = useCallback((val: number) => {
    audio!.setRate(val)
    audio!.state = { ...audio!.state, rate: val }
  }, [audio])

  const handleDepth = useCallback((val: number) => {
    audio!.setDepth(val)
    audio!.state = { ...audio!.state, depth: val }
  }, [audio])

  const handleType = useCallback((val: string) => {
    audio!.setType(val as OscillatorType)
    audio!.state = { ...audio!.state, type: val }
    rerender()
  }, [audio])

  if (!audio) return null

  const state = audio.state as { rate: number; depth: number; type: string }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 justify-center">
        <Knob
          label="RATE"
          min={0.1}
          max={50}
          value={state.rate ?? 1}
          defaultValue={1}
          onChange={handleRate}
          logCapable
          isLogMode
        />
        <Knob
          label="DEPTH"
          min={0}
          max={1}
          value={state.depth ?? 0.5}
          defaultValue={0.5}
          onChange={handleDepth}
        />
      </div>
      <SegmentToggle
        options={WAVEFORM_OPTIONS}
        value={state.type ?? 'sine'}
        onChange={handleType}
      />
    </div>
  )
}

registerModuleBody('lfo', LfoBody)
export { LfoBody }
