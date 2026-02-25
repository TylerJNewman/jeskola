import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MODULE_PORTS } from '@/lib/module-registry'
import type { ModuleType, PortDef } from '@/lib/module-registry'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { getModuleBody } from '@/lib/module-body-registry'

export type ModuleNodeData = {
  label: string
  moduleType: ModuleType | 'master'
  moduleId: string
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

  return (
    <div className="bg-panel border border-border rounded-[6px] shadow-sm min-w-[160px] relative">
      {/* Header — drag handle */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-light cursor-grab active:cursor-grabbing">
        <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-text-muted">
          {nodeData.label}
        </span>
        {nodeData.moduleType !== 'master' && (
          <button
            onClick={() => removeModule(id)}
            className="text-text-muted hover:text-accent-orange text-sm leading-none cursor-pointer ml-2"
          >
            ×
          </button>
        )}
      </div>

      {/* Input handles (left side) */}
      {ports.inputs.map((port, i) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`!w-3 !h-3 !rounded-full !border-2 !border-panel ${portColor(port.type)}`}
          style={{ top: `${40 + i * 28}px` }}
        />
      ))}

      {/* Module body */}
      <div className="px-3 py-2">
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
      </div>

      {/* Output handles (right side) */}
      {ports.outputs.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`!w-3 !h-3 !rounded-full !border-2 !border-panel ${portColor(port.type)}`}
          style={{ top: `${40 + i * 28}px` }}
        />
      ))}
    </div>
  )
}

export const ModuleNode = memo(ModuleNodeInner)
