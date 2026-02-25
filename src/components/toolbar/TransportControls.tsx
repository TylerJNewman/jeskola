import { useTransportStore } from '@/stores/transport-store'
import { useAudioEngine } from '@/hooks/use-audio-engine'

export function TransportControls() {
  const { isPlaying, bpm, setBpm, play, stop } = useTransportStore()
  const { initialize, audioState } = useAudioEngine()

  const handlePlayStop = async () => {
    if (audioState === 'stopped') await initialize()
    if (isPlaying) {
      stop()
    } else {
      play()
    }
  }

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBpm(parseInt(e.target.value, 10) || 120)
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handlePlayStop}
        className={`text-[10px] uppercase tracking-wide px-2.5 py-1 border rounded-[4px] transition-colors cursor-pointer ${
          isPlaying
            ? 'bg-accent-orange text-white border-accent-orange'
            : 'bg-panel border-border text-text-light hover:border-accent-orange'
        }`}
      >
        {isPlaying ? '■ STOP' : '▶ PLAY'}
      </button>
      <input
        type="number"
        value={bpm}
        onChange={handleBpmChange}
        min={20}
        max={300}
        className="w-14 text-[11px] text-center bg-bg border border-border rounded-[4px] px-1 py-1 text-text-main tabular-nums focus:outline-none focus:border-accent-orange"
      />
      <span className="text-[9px] text-text-muted uppercase">BPM</span>
    </div>
  )
}
