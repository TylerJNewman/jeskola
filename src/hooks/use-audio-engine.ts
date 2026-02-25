import { useState, useCallback } from 'react'
import { audioEngine } from '@/audio/AudioEngine'
import { useWorkspaceStore } from '@/stores/workspace-store'

export function useAudioEngine() {
  const [audioState, setAudioState] = useState<'stopped' | 'initializing' | 'running'>('stopped')
  const initWorkspace = useWorkspaceStore(s => s.initWorkspace)

  const initialize = useCallback(async () => {
    if (audioState !== 'stopped') return
    setAudioState('initializing')

    await audioEngine.init()
    initWorkspace()
    setAudioState('running')
  }, [audioState, initWorkspace])

  const toggle = useCallback(async () => {
    if (audioState === 'stopped') {
      await initialize()
      return
    }

    const ctx = audioEngine.getContext()
    if (ctx.state === 'running') {
      ctx.suspend()
      setAudioState('stopped')
    } else {
      ctx.resume()
      setAudioState('running')
    }
  }, [audioState, initialize])

  return {
    audioState,
    initialize,
    toggle,
  }
}
