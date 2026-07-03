import { useState, useCallback, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { WorkspaceCanvas } from './workspace/WorkspaceCanvas'
import { ModulePalette } from './palette/ModulePalette'
import { Toolbar } from './toolbar/Toolbar'
import { SectionPanel } from './drawers/SectionDrawer'
import { ApplyDrawer } from './drawers/ApplyDrawer'
import { useKeyboard } from '@/hooks/use-keyboard'
import type { Section } from './drawers/SectionDrawer'
import { useWorkspaceStore } from '@/stores/workspace-store'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

export function App() {
  useKeyboard()
  const [activeSection, setActiveSection] = useState<Section | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  const spreadModules = useWorkspaceStore(s => s.spreadModules)
  const compactModules = useWorkspaceStore(s => s.compactModules)
  const snapModulesToGrid = useWorkspaceStore(s => s.snapModulesToGrid)

  const handleSectionToggle = useCallback((section: Section | null) => {
    setActiveSection(section)
  }, [])

  const handleApplyToggle = useCallback(() => {
    setApplyOpen(prev => !prev)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (!event.shiftKey || !(event.metaKey || event.ctrlKey)) return

      if (event.key === '=' || event.key === '+') {
        event.preventDefault()
        spreadModules()
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        compactModules()
      } else if (event.key === '0') {
        event.preventDefault()
        snapModulesToGrid(20)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [compactModules, snapModulesToGrid, spreadModules])

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-bg">
        <Toolbar
          onSectionToggle={handleSectionToggle}
          onApplyToggle={handleApplyToggle}
          onSpread={spreadModules}
          onCompact={compactModules}
          onGridSnap={() => snapModulesToGrid(20)}
          applyOpen={applyOpen}
        />

        <SectionPanel section={activeSection} />

        <main className="flex-1 relative">
          <WorkspaceCanvas />
        </main>

        <ApplyDrawer open={applyOpen} onClose={() => setApplyOpen(false)} />
        <ModulePalette />
      </div>
    </ReactFlowProvider>
  )
}
