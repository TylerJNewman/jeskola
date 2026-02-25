import { useCallback, useState } from 'react'
import { Knob } from '@/components/controls/Knob'
import { SegmentToggle } from '@/components/controls/SegmentToggle'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { OscillatorModule } from '@/audio/nodes/OscillatorModule'
import { registerModuleBody } from '@/lib/module-body-registry'

const WAVEFORM_OPTIONS = [
  { value: 'sine', label: 'Sin' },
  { value: 'square', label: 'Sq' },
  { value: 'sawtooth', label: 'Saw' },
  { value: 'triangle', label: 'Tri' },
]

const MODE_OPTIONS = [
  { value: 'pitch', label: 'PITCH' },
  { value: 'freq', label: 'FREQ' },
]

function OscillatorBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as OscillatorModule | undefined
  if (!audio) return null

  const state = audio.state as {
    octave: number; semitone: number; cents: number
    freq: number; freqLog?: boolean
    type: string; mode: string
  }

  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate(n => n + 1)

  const mode = state.mode || 'pitch'

  const handleOctave = useCallback((val: number) => {
    audio.setOctave(val)
    audio.state = { ...audio.state, octave: val }
  }, [audio])

  const handleSemitone = useCallback((val: number) => {
    audio.setSemitone(val)
    audio.state = { ...audio.state, semitone: val }
  }, [audio])

  const handleCents = useCallback((val: number) => {
    audio.setCents(val)
    audio.state = { ...audio.state, cents: val }
  }, [audio])

  const handleFreq = useCallback((val: number) => {
    audio.setFreq(val)
    audio.state = { ...audio.state, freq: val }
  }, [audio])

  const handleMode = useCallback((val: string) => {
    audio.setMode(val as 'pitch' | 'freq')
    audio.state = { ...audio.state, mode: val }
    rerender()
  }, [audio])

  const handleType = useCallback((val: string) => {
    audio.setType(val as OscillatorType)
    audio.state = { ...audio.state, type: val }
    rerender()
  }, [audio])

  const handleFreqLogToggle = useCallback((isLog: boolean) => {
    audio.state = { ...audio.state, freqLog: isLog }
  }, [audio])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-center">
        <SegmentToggle options={MODE_OPTIONS} value={mode} onChange={handleMode} />
      </div>

      {mode === 'pitch' && (
        <div className="flex gap-2 justify-center">
          <Knob label="OCT" min={-3} max={3} value={state.octave ?? 0} defaultValue={0} onChange={handleOctave} step={1} />
          <Knob label="COARSE" min={-12} max={12} value={state.semitone ?? 0} defaultValue={0} onChange={handleSemitone} step={1} />
          <Knob label="FINE" min={-100} max={100} value={state.cents ?? 0} defaultValue={0} onChange={handleCents} />
        </div>
      )}

      {mode === 'freq' && (
        <div className="flex justify-center">
          <Knob
            label="FREQ"
            min={0.1} max={2000}
            value={state.freq ?? 440}
            defaultValue={440}
            onChange={handleFreq}
            logCapable
            isLogMode={!!state.freqLog}
            onModeChange={handleFreqLogToggle}
          />
        </div>
      )}

      <SegmentToggle options={WAVEFORM_OPTIONS} value={state.type ?? 'sine'} onChange={handleType} />
    </div>
  )
}

registerModuleBody('oscillator', OscillatorBody)
export { OscillatorBody }
