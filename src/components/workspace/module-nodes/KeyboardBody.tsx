import { useCallback, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { KeyboardModule } from '@/audio/nodes/KeyboardModule'
import { registerModuleBody } from '@/lib/module-body-registry'
import { WORKSPACE_LAYOUT } from '@/lib/workspace-layout'
import { Button } from '@/components/ui/button'

function KeyboardBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as KeyboardModule | undefined
  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate(n => n + 1)

  const handleOctaveDown = useCallback(() => {
    audio!.adjustOctave(-1)
    rerender()
  }, [audio])

  const handleOctaveUp = useCallback(() => {
    audio!.adjustOctave(1)
    rerender()
  }, [audio])

  const handleEnabledToggle = useCallback(() => {
    const next = !audio!.enabled
    audio!.setEnabled(next)
    if (!next) audio!.noteOff()
    rerender()
  }, [audio])

  if (!audio) return null

  const octave = audio.octaveOffset
  const enabled = audio.enabled
  const signedOct = octave >= 0 ? `+${octave}` : String(octave)

  return (
    <div className="flex flex-col" style={{ gap: WORKSPACE_LAYOUT.module.bodyGap }}>
      <div className="flex items-center justify-center" style={{ gap: WORKSPACE_LAYOUT.module.controlRowGap }}>
        <Button
          onClick={handleOctaveDown}
          variant="rams"
          size="rams-tight"
          className="bg-bg hover:border-accent-orange"
        >
          -
        </Button>
        <span className="text-[10px] font-medium text-text-muted tabular-nums min-w-[52px] text-center">
          OCT: {signedOct}
        </span>
        <Button
          onClick={handleOctaveUp}
          variant="rams"
          size="rams-tight"
          className="bg-bg hover:border-accent-orange"
        >
          +
        </Button>
      </div>

      <label className="flex items-center gap-2 justify-center cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleEnabledToggle}
          className="accent-accent-orange"
        />
        <span className="text-[10px] text-text-muted">Enabled</span>
      </label>

      <div className="text-[8px] text-text-muted text-center leading-tight">
        Keys: A W S E D F G<br />
        Octave: Z / X
      </div>
    </div>
  )
}

registerModuleBody('keyboard', KeyboardBody)
export { KeyboardBody }
