import { useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { WorkspaceCanvas } from './workspace/WorkspaceCanvas'
import { ModulePalette } from './palette/ModulePalette'
import { Toolbar } from './toolbar/Toolbar'
import { SectionPanel } from './drawers/SectionDrawer'
import { ApplyDrawer } from './drawers/ApplyDrawer'
import { useKeyboard } from '@/hooks/use-keyboard'
import type { Section } from './drawers/SectionDrawer'

export function App() {
  useKeyboard()
  const [activeSection, setActiveSection] = useState<Section | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)

  const handleSectionToggle = useCallback((section: Section | null) => {
    setActiveSection(section)
  }, [])

  const handleApplyToggle = useCallback(() => {
    setApplyOpen(prev => !prev)
  }, [])

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-bg">
        <Toolbar
          onSectionToggle={handleSectionToggle}
          onApplyToggle={handleApplyToggle}
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
