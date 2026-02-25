import { create } from 'zustand'
import type { KeyboardModule } from '@/audio/nodes/KeyboardModule'

export const KEY_TO_SEMITONE: Record<string, number> = {
  a: 0,  // C
  w: 1,  // C#
  s: 2,  // D
  e: 3,  // D#
  d: 4,  // E
  f: 5,  // F
  g: 7,  // G
}

export const OCTAVE_DOWN_KEY = 'z'
export const OCTAVE_UP_KEY = 'x'

type KeyboardState = {
  heldKeys: string[]
  keyDown: (key: string, modules: KeyboardModule[]) => void
  keyUp: (key: string, modules: KeyboardModule[]) => void
  adjustOctave: (delta: number, modules: KeyboardModule[]) => void
  releaseAll: (modules: KeyboardModule[]) => void
}

function applyTopNote(heldKeys: string[], modules: KeyboardModule[]) {
  if (modules.length === 0) return

  const topKey = heldKeys[heldKeys.length - 1]
  if (!topKey) {
    modules.forEach(kb => kb.noteOff())
    return
  }

  const semitone = KEY_TO_SEMITONE[topKey]
  if (semitone === undefined) return

  modules.forEach(kb => {
    kb.noteOn(kb.baseMidi + kb.octaveOffset * 12 + semitone)
  })
}

export const useKeyboardStore = create<KeyboardState>((set, get) => ({
  heldKeys: [],

  keyDown: (key, modules) => {
    const state = get()
    if (state.heldKeys.includes(key)) return
    const next = [...state.heldKeys, key]
    set({ heldKeys: next })
    applyTopNote(next, modules)
  },

  keyUp: (key, modules) => {
    const state = get()
    const idx = state.heldKeys.indexOf(key)
    if (idx === -1) return
    const next = state.heldKeys.filter((_, i) => i !== idx)
    set({ heldKeys: next })
    applyTopNote(next, modules)
  },

  adjustOctave: (delta, modules) => {
    modules.forEach(kb => kb.adjustOctave(delta))
  },

  releaseAll: (modules) => {
    set({ heldKeys: [] })
    modules.forEach(kb => kb.noteOff())
  },
}))
