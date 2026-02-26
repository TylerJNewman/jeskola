import { useAudioEngine } from '@/hooks/use-audio-engine'
import { Button } from '@/components/ui/button'

export function AudioToggle() {
  const { audioState, toggle } = useAudioEngine()

  return (
    <Button
      onClick={toggle}
      variant={audioState === 'running' ? 'rams-primary' : 'rams'}
      size="rams-bar"
      className={`min-w-[120px] px-3.5 text-[10px] tracking-[0.3px] transition-colors ${
        audioState === 'running'
          ? ''
          : 'hover:border-accent-orange'
      }`}
    >
      {audioState === 'stopped' ? 'START AUDIO' :
       audioState === 'initializing' ? 'INIT...' :
       'STOP AUDIO'}
    </Button>
  )
}
