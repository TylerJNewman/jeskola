import { useCallback, useEffect, useRef, useState } from 'react'
import { Knob } from '@/components/controls/Knob'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { SequencerModule } from '@/audio/nodes/SequencerModule'
import { NO_VALUE, midiToNoteName } from '@/audio/sequencer/types'
import { transport } from '@/audio/Transport'
import { registerModuleBody } from '@/lib/module-body-registry'

const PATTERN_LENGTHS = [4, 8, 16, 32]
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function SequencerBody({ moduleId }: { moduleId: string }) {
  const entry = useWorkspaceStore(s => s.modules.get(moduleId))
  const audio = entry?.audioNode as SequencerModule | undefined
  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate(n => n + 1)
  const [currentStep, setCurrentStep] = useState(-1)
  const [notePickerStep, setNotePickerStep] = useState<number | null>(null)
  const [pickerOctave, setPickerOctave] = useState(4)
  const rafRef = useRef<number | null>(null)

  if (!audio) return null

  const pattern = audio.pattern
  const steps = pattern.steps

  useEffect(() => {
    audio.onStepChange = (step: number) => {
      setCurrentStep(step)
    }

    const animate = () => {
      if (transport.isPlaying) {
        setCurrentStep(audio.currentStep)
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    const stopHandler = () => setCurrentStep(-1)
    transport.onStop(stopHandler)

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      audio.onStepChange = undefined
      transport.offStop(stopHandler)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [audio])

  const handleStepClick = useCallback((index: number) => {
    const step = steps[index]
    if (!step) return

    if (step.gate) {
      audio.setStep(index, { gate: false })
    } else {
      const note = step.note === NO_VALUE ? 60 : step.note
      audio.setStep(index, { gate: true, note, velocity: 1 })
    }
    rerender()
  }, [audio, steps])

  const handleStepRightClick = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setNotePickerStep(index)
    const step = steps[index]
    if (step && step.note !== NO_VALUE) {
      setPickerOctave(Math.floor(step.note / 12) - 1)
    }
  }, [steps])

  const handleStepWheel = useCallback((e: React.WheelEvent, index: number) => {
    e.stopPropagation()
    const step = steps[index]
    if (!step || !step.gate) return

    const current = step.note === NO_VALUE ? 60 : step.note
    const delta = e.deltaY < 0 ? 1 : -1
    const next = Math.max(0, Math.min(127, current + delta))
    audio.setStep(index, { note: next })
    rerender()
  }, [audio, steps])

  const handleNoteSelect = useCallback((midi: number) => {
    if (notePickerStep === null) return
    audio.setStep(notePickerStep, { note: midi, gate: true, velocity: 1 })
    setNotePickerStep(null)
    rerender()
  }, [audio, notePickerStep])

  const handleLengthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const len = parseInt(e.target.value, 10)
    audio.setPatternLength(len)
    rerender()
  }, [audio])

  const handleOctave = useCallback((val: number) => {
    audio.octaveOffset = val
  }, [audio])

  const handleGateLen = useCallback((val: number) => {
    audio.gateLength = val
  }, [audio])

  const renderStepRow = (startIdx: number, endIdx: number) => {
    return steps.slice(startIdx, endIdx).map((step, i) => {
      const idx = startIdx + i
      const isActive = step.gate
      const isPlaying = idx === currentStep
      const isBeatStart = idx % 4 === 0
      const noteName = isActive && step.note !== NO_VALUE
        ? midiToNoteName(step.note)
        : ''

      return (
        <button
          key={idx}
          onClick={() => handleStepClick(idx)}
          onContextMenu={(e) => handleStepRightClick(e, idx)}
          onWheel={(e) => handleStepWheel(e, idx)}
          className={`
            w-5 h-8 text-[7px] leading-tight flex items-end justify-center pb-0.5
            border rounded-sm cursor-pointer transition-colors select-none
            ${isActive
              ? 'bg-accent-orange text-white border-accent-orange'
              : 'bg-bg text-text-muted border-border hover:border-accent-orange'}
            ${isPlaying ? 'ring-2 ring-accent-blue ring-inset' : ''}
            ${isBeatStart ? 'border-l-2 border-l-border' : ''}
          `}
        >
          {noteName}
        </button>
      )
    })
  }

  return (
    <div className="flex flex-col gap-2 relative">
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase text-text-muted">Steps</span>
        <select
          value={pattern.length}
          onChange={handleLengthChange}
          className="text-[10px] bg-bg border border-border rounded-[4px] px-1 py-0.5 text-text-light"
        >
          {PATTERN_LENGTHS.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <div
        className="grid gap-px"
        style={{ gridTemplateColumns: `repeat(${Math.min(pattern.length, 16)}, 20px)` }}
      >
        {renderStepRow(0, Math.min(pattern.length, 16))}
      </div>

      {pattern.length > 16 && (
        <div
          className="grid gap-px"
          style={{ gridTemplateColumns: `repeat(16, 20px)` }}
        >
          {renderStepRow(16, pattern.length)}
        </div>
      )}

      {notePickerStep !== null && (
        <div className="absolute z-50 bg-panel border border-border rounded-[6px] shadow-md p-2 left-0 top-full mt-1">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setPickerOctave(o => Math.max(0, o - 1))}
              className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded-[4px] cursor-pointer"
            >
              -
            </button>
            <span className="text-[10px] text-text-muted">Oct {pickerOctave}</span>
            <button
              onClick={() => setPickerOctave(o => Math.min(8, o + 1))}
              className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded-[4px] cursor-pointer"
            >
              +
            </button>
            <button
              onClick={() => setNotePickerStep(null)}
              className="text-[10px] text-text-muted hover:text-accent-orange cursor-pointer ml-auto"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {NOTE_NAMES.map((name, i) => {
              const midi = (pickerOctave + 1) * 12 + i
              return (
                <button
                  key={name}
                  onClick={() => handleNoteSelect(midi)}
                  className="text-[9px] px-1.5 py-1 bg-bg border border-border rounded-[4px] text-text-light hover:bg-accent-orange hover:text-white cursor-pointer transition-colors"
                >
                  {name}{pickerOctave}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-center">
        <Knob
          label="OCT"
          min={-3} max={3}
          value={audio.octaveOffset}
          defaultValue={0}
          onChange={handleOctave}
          step={1}
        />
        <Knob
          label="GATE"
          min={0.05} max={1}
          value={audio.gateLength}
          defaultValue={0.5}
          onChange={handleGateLen}
        />
      </div>
    </div>
  )
}

registerModuleBody('sequencer', SequencerBody)
export { SequencerBody }
