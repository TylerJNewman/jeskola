import { useTransportStore } from '@/stores/transport-store'
import { useAudioEngine } from '@/hooks/use-audio-engine'
import { Button } from '@/components/ui/button'

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
    <div className="flex items-center gap-2.5">
      <Button
        onClick={handlePlayStop}
        variant={isPlaying ? 'rams-primary' : 'rams'}
        size="rams-toolbar-box"
        className={`transition-colors ${
          isPlaying
            ? ''
            : 'hover:border-accent-orange'
        }`}
      >
        {isPlaying ? '■ STOP' : '▶ PLAY'}
      </Button>
      <input
        type="number"
        value={bpm}
        onChange={handleBpmChange}
        min={20}
        max={300}
        className="h-8 w-16 text-[11px] text-center bg-bg border border-border rounded-[4px] px-2 text-text-main tabular-nums focus:outline-none focus:border-accent-orange"
      />
      <span className="text-[11px] text-text-muted uppercase tracking-[0.4px]">BPM</span>
    </div>
  )
}
