import { MODULE_TYPES, MODULE_LABELS } from '@/lib/module-registry'
import type { ModuleType } from '@/lib/module-registry'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { WORKSPACE_LAYOUT } from '@/lib/workspace-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function ModulePalette() {
  const addModule = useWorkspaceStore(s => s.addModule)
  const initialized = useWorkspaceStore(s => s.initialized)

  const handleAdd = (type: ModuleType) => {
    if (!initialized) return
    addModule(type)
  }

  return (
    <aside
      className="fixed z-[50]"
      style={{
        right: WORKSPACE_LAYOUT.palette.rightOffset,
        top: WORKSPACE_LAYOUT.palette.topOffset,
        width: WORKSPACE_LAYOUT.palette.width,
      }}
    >
      <Card variant="rams" className="shadow-md" style={{ borderRadius: WORKSPACE_LAYOUT.module.radius }}>
      <CardContent className="flex flex-col" style={{ padding: WORKSPACE_LAYOUT.palette.padding, gap: WORKSPACE_LAYOUT.palette.gap }}>
      <h2 className="text-[10px] font-semibold uppercase tracking-[1px] text-text-muted" style={{ marginBottom: WORKSPACE_LAYOUT.palette.headingMarginBottom }}>
        Modules
      </h2>
      {MODULE_TYPES.map(type => (
        <Button
          key={type}
          onClick={() => handleAdd(type)}
          disabled={!initialized}
          variant="rams"
          size="rams"
          className="transition-colors hover:border-accent-orange hover:text-accent-orange disabled:opacity-40 disabled:cursor-not-allowed text-left"
          style={{
            justifyContent: 'flex-start',
            paddingLeft: WORKSPACE_LAYOUT.palette.buttonPaddingX,
            paddingRight: WORKSPACE_LAYOUT.palette.buttonPaddingX,
          }}
        >
          + {MODULE_LABELS[type]}
        </Button>
      ))}
      </CardContent>
      </Card>
    </aside>
  )
}
