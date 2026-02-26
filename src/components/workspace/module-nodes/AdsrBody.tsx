import { useCallback, useRef } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { AdsrModule } from '@/audio/nodes/AdsrModule'
import { registerModuleBody } from '@/lib/module-body-registry'

function AdsrBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as AdsrModule | undefined
  const gateActive = useRef(false)

  const handleAttack = useCallback((val: number) => {
    audio!.setAttack(val)
    audio!.state = { ...audio!.state, attack: val }
  }, [audio])

  const handleDecay = useCallback((val: number) => {
    audio!.setDecay(val)
    audio!.state = { ...audio!.state, decay: val }
  }, [audio])

  const handleSustain = useCallback((val: number) => {
    audio!.setSustain(val)
    audio!.state = { ...audio!.state, sustain: val }
  }, [audio])

  const handleRelease = useCallback((val: number) => {
    audio!.setRelease(val)
    audio!.state = { ...audio!.state, release: val }
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
    <div className="flex flex-col gap-2">
      <button
        onMouseDown={handleGateDown}
        onMouseUp={handleGateUp}
        onMouseLeave={handleGateUp}
        className="w-full text-[10px] uppercase tracking-wide py-1.5 bg-bg border border-border rounded-[4px] text-text-light hover:bg-accent-orange hover:text-white active:bg-accent-orange active:text-white transition-colors cursor-pointer text-center"
      >
        Gate (Hold)
      </button>

      <div className="flex gap-1.5 justify-between">
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
