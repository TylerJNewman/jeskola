import { useEffect } from 'react'
import { useKeyboardStore, KEY_TO_SEMITONE, OCTAVE_DOWN_KEY, OCTAVE_UP_KEY } from '@/stores/keyboard-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAudioEngine } from '@/hooks/use-audio-engine'
import type { KeyboardModule } from '@/audio/nodes/KeyboardModule'

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return !!target.closest('[contenteditable="true"]')
}

export function useKeyboard() {
  const { initialize, audioState } = useAudioEngine()

  useEffect(() => {
    const getEnabledModules = (): KeyboardModule[] => {
      return useWorkspaceStore.getState()
        .getModulesByType('keyboard')
        .map(e => e.audioNode as KeyboardModule)
        .filter(kb => kb.enabled)
    }

    const handleKeyDown = async (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const isMappedNote = key in KEY_TO_SEMITONE
      const isOctaveKey = key === OCTAVE_DOWN_KEY || key === OCTAVE_UP_KEY
      if (!isMappedNote && !isOctaveKey) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isTextInputTarget(event.target)) return
      if (event.repeat) return

      if (audioState === 'stopped') await initialize()

      const modules = getEnabledModules()
      if (modules.length === 0) return

      if (isOctaveKey) {
        const delta = key === OCTAVE_DOWN_KEY ? -1 : 1
        useKeyboardStore.getState().adjustOctave(delta, modules)
        return
      }

      useKeyboardStore.getState().keyDown(key, modules)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (!(key in KEY_TO_SEMITONE)) return
      const modules = getEnabledModules()
      useKeyboardStore.getState().keyUp(key, modules)
    }

    const handleBlur = () => {
      const modules = getEnabledModules()
      useKeyboardStore.getState().releaseAll(modules)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const modules = getEnabledModules()
        useKeyboardStore.getState().releaseAll(modules)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [audioState, initialize])
}
