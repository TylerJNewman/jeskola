import { useAudioEngine } from '@/hooks/use-audio-engine'

export function AudioToggle() {
  const { audioState, toggle } = useAudioEngine()

  return (
    <button
      onClick={toggle}
      className={`text-[10px] uppercase tracking-wide px-2.5 py-1 border rounded-[4px] transition-colors cursor-pointer ${
        audioState === 'running'
          ? 'bg-accent-orange text-white border-accent-orange'
          : 'bg-panel border-border text-text-light hover:border-accent-orange'
      }`}
    >
      {audioState === 'stopped' ? 'START AUDIO' :
       audioState === 'initializing' ? 'INIT...' :
       'STOP AUDIO'}
    </button>
  )
}
