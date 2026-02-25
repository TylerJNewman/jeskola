import { create } from 'zustand'
import { transport } from '@/audio/Transport'

type TransportState = {
  bpm: number
  isPlaying: boolean
  currentStep: number
  ticksPerBeat: number
  swing: number

  setBpm: (bpm: number) => void
  play: () => void
  stop: () => void
  setSwing: (swing: number) => void
  setTicksPerBeat: (tpb: number) => void
  syncFromTransport: () => void
}

export const useTransportStore = create<TransportState>((set) => ({
  bpm: 120,
  isPlaying: false,
  currentStep: -1,
  ticksPerBeat: 4,
  swing: 0.5,

  setBpm: (bpm) => {
    transport.setBpm(bpm)
    set({ bpm: transport.bpm })
  },

  play: () => {
    transport.play()
    set({ isPlaying: true })
  },

  stop: () => {
    transport.stop()
    set({ isPlaying: false, currentStep: -1 })
  },

  setSwing: (swing) => {
    transport.setSwing(swing)
    set({ swing: transport.swing })
  },

  setTicksPerBeat: (tpb) => {
    transport.setTicksPerBeat(tpb)
    set({ ticksPerBeat: transport.ticksPerBeat })
  },

  syncFromTransport: () => {
    set({
      bpm: transport.bpm,
      isPlaying: transport.isPlaying,
      currentStep: transport.currentTick,
      ticksPerBeat: transport.ticksPerBeat,
      swing: transport.swing,
    })
  },
}))
