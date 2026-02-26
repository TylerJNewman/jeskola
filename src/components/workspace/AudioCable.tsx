import { memo } from 'react'
import { getBezierPath, type EdgeProps } from '@xyflow/react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { WORKSPACE_LAYOUT } from '@/lib/workspace-layout'

export type AudioCableData = {
  connectionType: 'audio' | 'cv' | 'gate'
}

function AudioCableInner(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, data } = props
  const removeConnection = useWorkspaceStore(s => s.removeConnection)

  const cableData = data as AudioCableData | undefined
  const color = cableData?.connectionType === 'cv'
    ? 'var(--color-accent-blue)'
    : cableData?.connectionType === 'gate'
    ? 'var(--color-accent-orange)'
    : 'var(--color-wire)'

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    curvature: 0.18,
  })

  return (
    <g className="group cursor-pointer" onClick={() => removeConnection(id)}>
      {/* Invisible wider path for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={WORKSPACE_LAYOUT.cables.interactionStroke}
        strokeLinecap="round"
      />
      {/* Visible cable */}
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={WORKSPACE_LAYOUT.cables.visibleStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="group-hover:!stroke-accent-orange transition-colors"
      />
    </g>
  )
}

export const AudioCable = memo(AudioCableInner)
