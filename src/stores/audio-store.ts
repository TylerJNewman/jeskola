import { create } from 'zustand'

export type AudioState = 'stopped' | 'initializing' | 'running'

type AudioStore = {
  audioState: AudioState
  setAudioState: (state: AudioState) => void
}

export const useAudioStore = create<AudioStore>((set) => ({
  audioState: 'stopped',
  setAudioState: (audioState) => set({ audioState }),
}))
