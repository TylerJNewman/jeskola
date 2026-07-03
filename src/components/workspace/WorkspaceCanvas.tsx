import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ModuleNode } from './ModuleNode'
import type { ModuleNodeData } from './ModuleNode'
import { AudioCable } from './AudioCable'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { MODULE_PORTS } from '@/lib/module-registry'
import { WORKSPACE_LAYOUT } from '@/lib/workspace-layout'

const nodeTypes = { module: ModuleNode }
const edgeTypes = { audio: AudioCable }

export function WorkspaceCanvas() {
  const [snapToGrid, setSnapToGrid] = useState(false)
  const modules = useWorkspaceStore(s => s.modules)
  const connections = useWorkspaceStore(s => s.connections)
  const selectedModuleIds = useWorkspaceStore(s => s.selectedModuleIds)
  const addConnection = useWorkspaceStore(s => s.addConnection)
  const moveModule = useWorkspaceStore(s => s.moveModule)
  const setSelectedModules = useWorkspaceStore(s => s.setSelectedModules)

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
        ...(m.type === 'master' && { subtitle: 'Audio Output' }),
      } satisfies ModuleNodeData,
    }))
  }, [modules])

  const edges: Edge[] = useMemo(() => {
    return connections.map(c => {
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

  const onConnect: OnConnect = useCallback((params) => {
    if (!params.source || !params.target) return
    addConnection({
      source: params.source,
      sourcePort: params.sourceHandle || 'audio',
      target: params.target,
      targetPort: params.targetHandle || 'audio',
    })
  }, [addConnection])

  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    const nextSelected = new Set(selectedModuleIds)
    let selectionChanged = false

    for (const change of changes) {
      if (change.type === 'position' && change.position && change.id) {
        moveModule(change.id, change.position)
      }
      if (change.type === 'select') {
        selectionChanged = true
        if (change.selected) {
          nextSelected.add(change.id)
        } else {
          nextSelected.delete(change.id)
        }
      }
      if (change.type === 'remove') {
        selectionChanged = true
        nextSelected.delete(change.id)
      }
    }

    if (selectionChanged) {
      setSelectedModules(Array.from(nextSelected))
    }
  }, [moveModule, selectedModuleIds, setSelectedModules])

  const onSelectionChange = useCallback((selection: { nodes: Array<{ id: string }> }) => {
    const ids = selection.nodes.map(n => n.id)
    setSelectedModules(ids)
  }, [setSelectedModules])

  const isValidConnection = useCallback((connection: { source: string | null; target: string | null }) => {
    if (!connection.source || !connection.target) return false
    if (connection.source === connection.target) return false
    return true
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setSnapToGrid(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setSnapToGrid(false)
    }
    const onBlur = () => setSnapToGrid(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onConnect={onConnect}
      onNodesChange={onNodesChange}
      onSelectionChange={onSelectionChange}
      isValidConnection={isValidConnection}
      selectionOnDrag
      fitView={false}
      minZoom={0.15}
      maxZoom={2.0}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      snapToGrid={snapToGrid}
      snapGrid={[20, 20]}
      proOptions={{ hideAttribution: true }}
      className="bg-bg"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={WORKSPACE_LAYOUT.canvas.dotGap}
        size={WORKSPACE_LAYOUT.canvas.dotSize}
        color={WORKSPACE_LAYOUT.canvas.dotColor}
      />
      <MiniMap
        nodeColor={() => '#FAFAFA'}
        maskColor="rgba(0, 0, 0, 0.05)"
        className="!bg-panel !border !border-border-light !shadow-sm !rounded-[6px]"
        style={{ width: 120, height: 80 }}
        pannable
        zoomable
      />
    </ReactFlow>
  )
}
