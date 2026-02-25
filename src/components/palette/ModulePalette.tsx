import { MODULE_TYPES, MODULE_LABELS } from '@/lib/module-registry'
import type { ModuleType } from '@/lib/module-registry'
import { useWorkspaceStore } from '@/stores/workspace-store'

export function ModulePalette() {
  const addModule = useWorkspaceStore(s => s.addModule)
  const initialized = useWorkspaceStore(s => s.initialized)

  const handleAdd = (type: ModuleType) => {
    if (!initialized) return
    addModule(type)
  }

  return (
    <aside className="fixed right-0 top-[44px] bottom-0 w-[140px] bg-panel border-l border-border-light z-[50] flex flex-col gap-2 p-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[1px] text-text-muted mb-2">
        Modules
      </h2>
      {MODULE_TYPES.map(type => (
        <button
          key={type}
          onClick={() => handleAdd(type)}
          disabled={!initialized}
          className="text-[10px] uppercase tracking-wide px-2 py-1.5 bg-bg border border-border rounded-[4px] text-text-light hover:border-accent-orange hover:text-accent-orange transition-colors cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + {MODULE_LABELS[type]}
        </button>
      ))}
    </aside>
  )
}
