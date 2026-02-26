import { useCallback } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { DistortionModule } from '@/audio/nodes/DistortionModule'
import { registerModuleBody } from '@/lib/module-body-registry'
import { WORKSPACE_LAYOUT } from '@/lib/workspace-layout'

function DistortionBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as DistortionModule | undefined

  const handleDrive = useCallback((val: number) => {
    audio!.setDrive(val)
    audio!.patchState({ drive: val })
  }, [audio])

  const handleDriveLog = useCallback((isLog: boolean) => {
    audio!.patchState({ driveLog: isLog })
  }, [audio])

  const handleMix = useCallback((val: number) => {
    audio!.setMix(val)
    audio!.patchState({ mix: val })
  }, [audio])

  const handleOutput = useCallback((val: number) => {
    audio!.setOutput(val)
    audio!.patchState({ output: val })
  }, [audio])

  if (!audio) return null

  const state = audio.state as { drive: number; driveLog?: boolean; mix: number; output: number }

  return (
    <div className="flex justify-center" style={{ gap: WORKSPACE_LAYOUT.module.controlRowGap }}>
      <Knob
        label="DRIVE"
        min={0.5} max={20}
        value={state.drive ?? 1}
        defaultValue={1}
        onChange={handleDrive}
        logCapable
        isLogMode={!!state.driveLog}
        onModeChange={handleDriveLog}
      />
      <Knob label="MIX" min={0} max={1} value={state.mix ?? 0.5} defaultValue={0.5} onChange={handleMix} />
      <Knob label="OUTPUT" min={0} max={2} value={state.output ?? 0.8} defaultValue={0.8} onChange={handleOutput} />
    </div>
  )
}

registerModuleBody('distortion', DistortionBody)
export { DistortionBody }
