# Phase 02 — React Flow Workspace + Module Palette

## Goal
Replace the custom workspace with React Flow. Render modules as custom nodes on the canvas. Implement the module palette so clicking "+" adds a module to the canvas. Pan, zoom, drag all working. No audio wiring yet — just visual nodes.

## Depends On
Phase 00 (scaffold), Phase 01 (stores + module registry)

---

## Steps

### 1. Create the base ModuleNode component

This is the React Flow custom node that wraps every module type. For now, the body is a placeholder — actual module bodies come in later phases.

Create `src/components/workspace/ModuleNode.tsx`:

```tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MODULE_PORTS } from '@/lib/module-registry'
import type { ModuleType, PortDef } from '@/lib/module-registry'
import { useWorkspaceStore } from '@/stores/workspace-store'

export type ModuleNodeData = {
  label: string
  moduleType: ModuleType | 'master'
  moduleId: string
}

// Color for port dots based on type
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

      {/* Module body — placeholder for now */}
      <div className="px-3 py-2 min-h-[40px]">
        <span className="text-[9px] text-text-muted">
          {nodeData.moduleType}
        </span>
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
```

### 2. Create custom AudioCable edge

Create `src/components/workspace/AudioCable.tsx`:

```tsx
import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useWorkspaceStore } from '@/stores/workspace-store'

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
  })

  return (
    <g className="group cursor-pointer" onClick={() => removeConnection(id)}>
      {/* Invisible wider path for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
      />
      {/* Visible cable */}
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        className="group-hover:!stroke-accent-orange transition-colors"
      />
    </g>
  )
}

export const AudioCable = memo(AudioCableInner)
```

### 3. Create the WorkspaceCanvas

Create `src/components/workspace/WorkspaceCanvas.tsx`:

```tsx
import { useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  type NodeChange,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ModuleNode } from './ModuleNode'
import type { ModuleNodeData } from './ModuleNode'
import { AudioCable } from './AudioCable'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { MODULE_PORTS } from '@/lib/module-registry'

// Register custom node and edge types
const nodeTypes = { module: ModuleNode }
const edgeTypes = { audio: AudioCable }

export function WorkspaceCanvas() {
  const modules = useWorkspaceStore(s => s.modules)
  const connections = useWorkspaceStore(s => s.connections)
  const addConnection = useWorkspaceStore(s => s.addConnection)
  const moveModule = useWorkspaceStore(s => s.moveModule)

  // Convert store modules → React Flow nodes
  const nodes: Node[] = useMemo(() => {
    return Array.from(modules.values()).map(m => ({
      id: m.id,
      type: 'module',
      position: m.position,
      dragHandle: '.cursor-grab',
      data: {
        label: m.type === 'master' ? 'Master Out' : m.type.charAt(0).toUpperCase() + m.type.slice(1),
        moduleType: m.type,
        moduleId: m.id,
      } satisfies ModuleNodeData,
    }))
  }, [modules])

  // Convert store connections → React Flow edges
  const edges: Edge[] = useMemo(() => {
    return connections.map(c => {
      // Determine cable color type
      const sourceModule = modules.get(c.source)
      let connectionType: 'audio' | 'cv' | 'gate' = 'audio'
      if (c.sourcePort === 'gate' || c.targetPort === 'gate') {
        connectionType = 'gate'
      } else if (sourceModule) {
        const ports = MODULE_PORTS[sourceModule.type as keyof typeof MODULE_PORTS]
        const outPort = ports?.outputs.find(p => p.id === c.sourcePort)
        if (outPort?.type === 'cv') connectionType = 'cv'
      }

      return {
        id: c.id,
        source: c.source,
        sourceHandle: c.sourcePort,
        target: c.target,
        targetHandle: c.targetPort,
        type: 'audio',
        data: { connectionType },
      }
    })
  }, [connections, modules])

  // Handle new connections
  const onConnect: OnConnect = useCallback((params) => {
    if (!params.source || !params.target) return
    addConnection({
      source: params.source,
      sourcePort: params.sourceHandle || 'audio',
      target: params.target,
      targetPort: params.targetHandle || 'audio',
    })
  }, [addConnection])

  // Handle node position changes (drag)
  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position && change.id) {
        moveModule(change.id, change.position)
      }
    }
  }, [moveModule])

  // Connection validation
  const isValidConnection = useCallback((connection: { source: string | null; target: string | null; sourceHandle: string | null; targetHandle: string | null }) => {
    if (!connection.source || !connection.target) return false
    // No self-connections
    if (connection.source === connection.target) return false
    return true
  }, [])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onConnect={onConnect}
      onNodesChange={onNodesChange}
      isValidConnection={isValidConnection}
      fitView={false}
      minZoom={0.15}
      maxZoom={2.0}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      proOptions={{ hideAttribution: true }}
      className="bg-bg"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="rgba(0, 0, 0, 0.1)"
      />
      <MiniMap
        nodeColor={() => '#FAFAFA'}
        maskColor="rgba(0, 0, 0, 0.05)"
        className="!bg-panel !border !border-border-light !shadow-sm !rounded-[6px]"
        pannable
        zoomable
      />
    </ReactFlow>
  )
}
```

### 4. Create Module Palette

Create `src/components/palette/ModulePalette.tsx`:

```tsx
import { MODULE_TYPES, MODULE_LABELS } from '@/lib/module-registry'
import type { ModuleType } from '@/lib/module-registry'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAudioEngine } from '@/hooks/use-audio-engine'

export function ModulePalette() {
  const addModule = useWorkspaceStore(s => s.addModule)
  const initialized = useWorkspaceStore(s => s.initialized)
  const { initialize } = useAudioEngine()

  const handleAdd = async (type: ModuleType) => {
    if (!initialized) {
      await initialize()
    }
    addModule(type)
  }

  return (
    <aside className="fixed right-0 top-[76px] bottom-0 w-[140px] bg-panel border-l border-border-light z-[50] flex flex-col gap-2 p-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[1px] text-text-muted mb-2">
        Modules
      </h2>
      {MODULE_TYPES.map(type => (
        <button
          key={type}
          onClick={() => handleAdd(type)}
          className="text-[10px] uppercase tracking-wide px-2 py-1.5 bg-bg border border-border rounded-[4px] text-text-light hover:border-accent-orange hover:text-accent-orange transition-colors cursor-pointer text-left"
        >
          + {MODULE_LABELS[type]}
        </button>
      ))}
    </aside>
  )
}
```

### 5. Update App to use workspace + palette

Update `src/components/App.tsx`:

```tsx
import { ReactFlowProvider } from '@xyflow/react'
import { useAudioEngine } from '@/hooks/use-audio-engine'
import { WorkspaceCanvas } from './workspace/WorkspaceCanvas'
import { ModulePalette } from './palette/ModulePalette'

export function App() {
  const { audioState, toggle } = useAudioEngine()

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-bg">
        {/* Header */}
        <header className="h-[44px] bg-panel border-b border-border-light shadow-sm flex items-center px-4 z-[100] gap-4 shrink-0">
          <h1 className="text-sm font-semibold tracking-[2px] text-text-main">
            SYNTHESIS
          </h1>
          <button
            onClick={toggle}
            className={`text-[10px] uppercase tracking-wide px-3 py-1.5 border rounded-[4px] transition-colors cursor-pointer ${
              audioState === 'running'
                ? 'bg-accent-orange text-white border-accent-orange'
                : 'bg-panel border-border text-text-light hover:border-accent-orange'
            }`}
          >
            {audioState === 'stopped' ? 'START AUDIO' :
             audioState === 'initializing' ? 'INITIALIZING...' :
             'STOP AUDIO'}
          </button>
        </header>

        {/* Workspace */}
        <main className="flex-1 relative" style={{ marginRight: 140 }}>
          <WorkspaceCanvas />
        </main>

        {/* Palette */}
        <ModulePalette />
      </div>
    </ReactFlowProvider>
  )
}
```

### 6. Add React Flow CSS overrides for Rams styling

Append to `src/styles/globals.css`:

```css
/* === React Flow Overrides (Rams) === */

.react-flow__node {
  /* Remove React Flow default shadows */
  box-shadow: none !important;
}

.react-flow__node.selected {
  /* Subtle orange outline on selection */
  outline: 2px solid var(--color-accent-orange);
  outline-offset: 2px;
  border-radius: var(--radius-default);
}

.react-flow__handle {
  /* Ensure handles are visible and positioned correctly */
  z-index: 10;
}

.react-flow__edge-interaction {
  stroke-width: 12px;
}

.react-flow__minimap {
  bottom: 12px !important;
  left: 12px !important;
}

/* Hide default React Flow attribution */
.react-flow__attribution {
  display: none !important;
}

/* Connection line while dragging */
.react-flow__connection-line {
  stroke: var(--color-accent-orange);
  stroke-width: 2px;
  stroke-dasharray: 5 5;
}
```

---

## Files Created/Modified

| Action | File |
|--------|------|
| Create | `src/components/workspace/ModuleNode.tsx` |
| Create | `src/components/workspace/AudioCable.tsx` |
| Create | `src/components/workspace/WorkspaceCanvas.tsx` |
| Create | `src/components/palette/ModulePalette.tsx` |
| Modify | `src/components/App.tsx` |
| Modify | `src/styles/globals.css` |

## Verify It Works

1. `npm run dev` — no errors
2. Click "START AUDIO" to initialize
3. Click "+ Oscillator" in palette — a module node appears on the canvas
4. Click multiple module types — they all appear with correct labels
5. **Drag** a module by its header — it moves smoothly
6. **Pan** the canvas — click and drag empty space
7. **Zoom** — scroll wheel zooms in/out (0.15x to 2.0x)
8. **Minimap** appears in bottom-left corner, reflects module positions
9. **Handles** (ports) are visible on left (inputs) and right (outputs) of each node
10. Drag from an output handle to an input handle — a connection line follows your cursor
11. Complete the connection — an edge (cable) appears
12. Click a cable — it gets removed
13. Click the × on a module — it disappears
14. **Master** node has no × button (can't be deleted)
15. Ports are color-coded: dark for audio, blue for CV, orange for gate
