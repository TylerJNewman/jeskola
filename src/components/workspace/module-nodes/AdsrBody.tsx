import { useCallback, useRef } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { AdsrModule } from '@/audio/nodes/AdsrModule'
import { registerModuleBody } from '@/lib/module-body-registry'
import { WORKSPACE_LAYOUT } from '@/lib/workspace-layout'
import { Button } from '@/components/ui/button'

function AdsrBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as AdsrModule | undefined
  const gateActive = useRef(false)

  const handleAttack = useCallback((val: number) => {
    audio!.setAttack(val)
    audio!.patchState({ attack: val })
  }, [audio])

  const handleDecay = useCallback((val: number) => {
    audio!.setDecay(val)
    audio!.patchState({ decay: val })
  }, [audio])

  const handleSustain = useCallback((val: number) => {
    audio!.setSustain(val)
    audio!.patchState({ sustain: val })
  }, [audio])

  const handleRelease = useCallback((val: number) => {
    audio!.setRelease(val)
    audio!.patchState({ release: val })
  }, [audio])

  const handleGateDown = useCallback(() => {
    if (!gateActive.current) {
      gateActive.current = true
      audio!.triggerAttack()
    }
  }, [audio])

  const handleGateUp = useCallback(() => {
    if (gateActive.current) {
      gateActive.current = false
      audio!.triggerRelease()
    }
  }, [audio])

  if (!audio) return null

  const state = audio.state as { attack: number; decay: number; sustain: number; release: number }

  return (
    <div className="flex flex-col" style={{ gap: WORKSPACE_LAYOUT.module.bodyGap }}>
      <Button
        onMouseDown={handleGateDown}
        onMouseUp={handleGateUp}
        onMouseLeave={handleGateUp}
        variant="rams"
        size="rams"
        className="w-full bg-bg hover:bg-accent-orange hover:text-white active:bg-accent-orange active:text-white text-center"
      >
        Gate (Hold)
      </Button>

      <div className="flex justify-between" style={{ gap: WORKSPACE_LAYOUT.module.compactRowGap }}>
        <Knob label="A" min={0.01} max={5} value={state.attack ?? 0.1} defaultValue={0.1} onChange={handleAttack} />
        <Knob label="D" min={0.01} max={5} value={state.decay ?? 0.2} defaultValue={0.2} onChange={handleDecay} />
        <Knob label="S" min={0} max={1} value={state.sustain ?? 0.5} defaultValue={0.5} onChange={handleSustain} />
        <Knob label="R" min={0.01} max={5} value={state.release ?? 0.5} defaultValue={0.5} onChange={handleRelease} />
      </div>
    </div>
  )
}

registerModuleBody('adsr', AdsrBody)
export { AdsrBody }
