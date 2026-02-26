import { useCallback } from 'react'
import { audioEngine } from '@/audio/AudioEngine'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAudioStore } from '@/stores/audio-store'

export function useAudioEngine() {
  const audioState = useAudioStore(s => s.audioState)
  const setAudioState = useAudioStore(s => s.setAudioState)
  const initWorkspace = useWorkspaceStore(s => s.initWorkspace)

  const initialize = useCallback(async () => {
    if (useAudioStore.getState().audioState !== 'stopped') return
    setAudioState('initializing')

    try {
      await audioEngine.init()
      initWorkspace()
      const ctx = audioEngine.getContext()
      setAudioState(ctx.state === 'running' ? 'running' : 'stopped')
    } catch (err) {
      setAudioState('stopped')
      throw err
    }
  }, [initWorkspace, setAudioState])

  const toggle = useCallback(async () => {
    const state = useAudioStore.getState().audioState
    if (state === 'stopped') {
      await initialize()
      return
    }

    const ctx = audioEngine.getContext()
    if (ctx.state === 'running') {
      await ctx.suspend()
      setAudioState('stopped')
    } else {
      await ctx.resume()
      setAudioState('running')
    }
  }, [initialize, setAudioState])

  return {
    audioState,
    initialize,
    toggle,
  }
}
