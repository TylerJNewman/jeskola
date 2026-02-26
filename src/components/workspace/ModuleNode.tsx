import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MODULE_PORTS } from '@/lib/module-registry'
import type { ModuleType, PortDef } from '@/lib/module-registry'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { getModuleBody } from '@/lib/module-body-registry'
import { WORKSPACE_LAYOUT } from '@/lib/workspace-layout'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export type ModuleNodeData = {
  label: string
  moduleType: ModuleType | 'master'
  moduleId: string
  subtitle?: string
}

function portColor(type: PortDef['type']): string {
  switch (type) {
    case 'audio': return 'bg-text-main'
    case 'cv': return 'bg-accent-blue'
    case 'gate': return 'bg-accent-orange'
  }
}

function ModuleNodeInner({ id, data }: NodeProps) {
  const nodeData = data as unknown as ModuleNodeData
  const removeModule = useWorkspaceStore(s => s.removeModule)
  const ports = MODULE_PORTS[nodeData.moduleType]
  const subtitleHeight = nodeData.subtitle ? 22 : 0
  const handleBase = WORKSPACE_LAYOUT.module.handleStartOffset + subtitleHeight

  return (
    <Card
      variant="rams"
      className="relative"
      style={{
        minWidth: WORKSPACE_LAYOUT.module.minWidth,
        borderRadius: WORKSPACE_LAYOUT.module.radius,
      }}
    >
      {/* Header — drag handle */}
      <CardHeader
        className="flex-row items-center justify-between border-b border-border-light cursor-grab active:cursor-grabbing gap-0"
        style={{
          paddingLeft: WORKSPACE_LAYOUT.module.headerPaddingX,
          paddingRight: WORKSPACE_LAYOUT.module.headerPaddingX,
          paddingTop: WORKSPACE_LAYOUT.module.headerPaddingY,
          paddingBottom: WORKSPACE_LAYOUT.module.headerPaddingY,
        }}
      >
        <div>
          <span className="text-[12px] font-semibold uppercase tracking-[1px] text-text-main block">
            {nodeData.label}
          </span>
          {nodeData.subtitle && (
            <span className="text-[11px] font-normal normal-case tracking-normal text-text-muted block mt-1">
              {nodeData.subtitle}
            </span>
          )}
        </div>
        {nodeData.moduleType !== 'master' && (
          <button
            onClick={() => removeModule(id)}
            className="text-text-muted hover:text-accent-orange text-base leading-none cursor-pointer ml-2"
          >
            ×
          </button>
        )}
      </CardHeader>

      {/* Input handles (left side) */}
      {ports.inputs.map((port, i) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`!rounded-full !border-panel ${portColor(port.type)}`}
          style={{
            width: WORKSPACE_LAYOUT.module.handleSize,
            height: WORKSPACE_LAYOUT.module.handleSize,
            borderWidth: WORKSPACE_LAYOUT.module.handleBorder,
            top: handleBase + i * WORKSPACE_LAYOUT.module.handleRowGap,
          }}
        />
      ))}

      {/* Module body */}
      <CardContent
        className="module-body-content"
        style={{
          paddingLeft: WORKSPACE_LAYOUT.module.bodyPaddingX,
          paddingRight: WORKSPACE_LAYOUT.module.bodyPaddingX,
          paddingTop: WORKSPACE_LAYOUT.module.bodyPaddingY,
          paddingBottom: WORKSPACE_LAYOUT.module.bodyPaddingY,
          gap: WORKSPACE_LAYOUT.module.bodyGap,
        }}
      >
        {/* Port labels row — each label height matches handleRowGap so they align with handle dots */}
        <div className="flex items-start justify-between text-[11px] leading-none font-medium uppercase tracking-[0.5px] text-text-main">
          <div className="flex flex-col min-h-[10px]">
            {ports.inputs.map((port) => (
              <span
                key={`in-${port.id}`}
                className="flex items-center"
                style={{ height: WORKSPACE_LAYOUT.module.handleRowGap }}
              >
                {port.label}
              </span>
            ))}
          </div>
          <div className="flex flex-col min-h-[10px] text-right">
            {ports.outputs.map((port) => (
              <span
                key={`out-${port.id}`}
                className="flex items-center justify-end"
                style={{ height: WORKSPACE_LAYOUT.module.handleRowGap }}
              >
                {port.label}
              </span>
            ))}
          </div>
        </div>
        {(() => {
          const BodyComponent = getModuleBody(nodeData.moduleType)
          if (BodyComponent) {
            return <BodyComponent moduleId={id} />
          }
          return (
            <span className="text-[9px] text-text-muted">
              {nodeData.moduleType}
            </span>
          )
        })()}
      </CardContent>

      {/* Output handles (right side) */}
      {ports.outputs.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`!rounded-full !border-panel ${portColor(port.type)}`}
          style={{
            width: WORKSPACE_LAYOUT.module.handleSize,
            height: WORKSPACE_LAYOUT.module.handleSize,
            borderWidth: WORKSPACE_LAYOUT.module.handleBorder,
            top: handleBase + i * WORKSPACE_LAYOUT.module.handleRowGap,
          }}
        />
      ))}
    </Card>
  )
}

export const ModuleNode = memo(ModuleNodeInner)
