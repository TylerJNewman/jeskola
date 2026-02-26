# Phase 09 — Apply Engine + Apply Drawer

## Goal
Port the non-destructive additive patching engine (`applyState`, `buildApplyPlan`, `previewApplyState`) from `_old_Workspace.ts` into a standalone module. Build the Apply drawer UI with source/mode/target selectors and live preview. After this phase, users can layer, chain, modulate, and send-route patches on top of existing patches — the killer feature for sound design exploration.

## Depends On
Phase 08 (presets available for use as apply sources)

---

## Steps

### 1. Create the apply engine

Port the apply logic from `_old_Workspace.ts` (lines 694-987) into a standalone module. This is pure logic — no DOM.

Create `src/lib/apply-engine.ts`:

```ts
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useTransportStore } from '@/stores/transport-store'
import { transport } from '@/audio/Transport'
import { MODULE_PORTS } from '@/lib/module-registry'
import type { ModuleType } from '@/lib/module-registry'

export type ApplyMode = 'replace' | 'add_chain' | 'add_modulation' | 'add_send' | 'add_layer'
export type ApplyTarget = 'before_module' | 'after_module' | 'parallel_to_module' | 'master_send' | 'auto'

export interface ApplyOptions {
  mode: ApplyMode
  targetType?: ApplyTarget
  targetModuleId?: string
}

export interface ApplySummary {
  modulesAdded: number
  connectionsAdded: number
  routesRewired: number
  idsRenamed: number
  warnings: string[]
}

interface PatchModule {
  id: string
  type: string
  x: number
  y: number
  state: Record<string, unknown>
}

interface PatchConnection {
  sourceModuleId: string
  targetModuleId: string
  sourcePortId: string
  targetPortId: string
}

interface PatchState {
  modules: PatchModule[]
  connections: PatchConnection[]
}

interface PlannedApply {
  patch: PatchState
  warnings: string[]
  idsRenamed: number
  connectionsToRemove: PatchConnection[]
  connectionsToAdd: PatchConnection[]
}

function parsePatch(json: string): PatchState | null {
  try {
    const raw = JSON.parse(json)
    if (!raw || typeof raw !== 'object') return null
    return {
      modules: Array.isArray(raw.modules) ? raw.modules : [],
      connections: Array.isArray(raw.connections) ? raw.connections : [],
    }
  } catch {
    return null
  }
}

function clonePatch(state: PatchState): PatchState {
  return JSON.parse(JSON.stringify(state))
}

/**
 * Remap module IDs in a patch to avoid collisions with existing workspace modules.
 */
function remapIds(patch: PatchState): { patch: PatchState; renamed: number } {
  const store = useWorkspaceStore.getState()
  const cloned = clonePatch(patch)
  const idMap = new Map<string, string>()
  let renamed = 0

  for (const mod of cloned.modules) {
    if (!store.modules.has(mod.id)) continue
    // Find unique ID
    let counter = 1
    let newId = `${mod.id}-${counter}`
    while (store.modules.has(newId) || cloned.modules.some(m => m !== mod && m.id === newId)) {
      counter++
      newId = `${mod.id}-${counter}`
    }
    idMap.set(mod.id, newId)
    mod.id = newId
    renamed++
  }

  // Update connection references
  for (const conn of cloned.connections) {
    if (idMap.has(conn.sourceModuleId)) conn.sourceModuleId = idMap.get(conn.sourceModuleId)!
    if (idMap.has(conn.targetModuleId)) conn.targetModuleId = idMap.get(conn.targetModuleId)!
  }

  return { patch: cloned, renamed }
}

/**
 * Find the "entry" module of a patch (first with no incoming audio connections).
 */
function inferEntry(patch: PatchState): string | null {
  const hasIncoming = new Set(
    patch.connections
      .filter(c => c.targetPortId === 'audio')
      .map(c => c.targetModuleId)
  )
  const entry = patch.modules.find(m => !hasIncoming.has(m.id))
  return entry?.id ?? patch.modules[0]?.id ?? null
}

/**
 * Find the "exit" module (the one connecting to master, or last in chain).
 */
function inferExit(patch: PatchState): string | null {
  const masterConn = patch.connections.find(c => c.targetModuleId === 'master')
  if (masterConn) return masterConn.sourceModuleId
  const hasOutgoing = new Set(
    patch.connections
      .filter(c => c.sourcePortId === 'audio')
      .map(c => c.sourceModuleId)
  )
  const noOut = patch.modules.find(m => !hasOutgoing.has(m.id))
  return noOut?.id ?? patch.modules[patch.modules.length - 1]?.id ?? null
}

/**
 * Find the best modulation source in a patch (prefers LFO > ADSR > Sequencer).
 */
function inferModSource(patch: PatchState): string | null {
  for (const pref of ['lfo', 'adsr', 'sequencer']) {
    const found = patch.modules.find(m => m.type.toLowerCase() === pref)
    if (found) return found.id
  }
  return inferEntry(patch)
}

/**
 * Get CV input port IDs for a module type.
 */
function getCvPorts(moduleType: string): string[] {
  const ports = MODULE_PORTS[moduleType as keyof typeof MODULE_PORTS]
  if (!ports) return []
  return ports.inputs.filter(p => p.type === 'cv').map(p => p.id)
}

function buildApplyPlan(patch: PatchState, options: ApplyOptions): PlannedApply {
  const store = useWorkspaceStore.getState()
  const warnings: string[] = []
  const { patch: remapped, renamed } = remapIds(patch)
  const entryId = inferEntry(remapped)
  const exitId = inferExit(remapped)

  // Filter out connections that go to master (we'll re-route them)
  const internalConns = remapped.connections.filter(c => c.targetModuleId !== 'master')
  const connectionsToRemove: PatchConnection[] = []
  const connectionsToAdd: PatchConnection[] = [...internalConns]

  const targetId = options.targetModuleId || null
  const targetType = options.targetType || 'auto'

  if (options.mode === 'add_chain') {
    if (targetId && entryId && exitId) {
      if (targetType === 'after_module') {
        // Find connection from target to something
        const outConn = store.connections.find(c => c.source === targetId && c.sourcePort === 'audio')
        if (outConn) {
          connectionsToRemove.push({
            sourceModuleId: outConn.source,
            targetModuleId: outConn.target,
            sourcePortId: outConn.sourcePort,
            targetPortId: outConn.targetPort,
          })
          // target → patch entry
          connectionsToAdd.push({
            sourceModuleId: targetId,
            targetModuleId: entryId,
            sourcePortId: 'audio',
            targetPortId: 'audio',
          })
          // patch exit → original destination
          connectionsToAdd.push({
            sourceModuleId: exitId,
            targetModuleId: outConn.target,
            sourcePortId: 'audio',
            targetPortId: outConn.targetPort,
          })
        } else {
          // No outgoing — just chain to master
          connectionsToAdd.push({
            sourceModuleId: targetId,
            targetModuleId: entryId,
            sourcePortId: 'audio',
            targetPortId: 'audio',
          })
          connectionsToAdd.push({
            sourceModuleId: exitId,
            targetModuleId: 'master',
            sourcePortId: 'audio',
            targetPortId: 'audio',
          })
        }
      } else if (targetType === 'before_module') {
        const inConn = store.connections.find(c => c.target === targetId && c.targetPort === 'audio')
        if (inConn) {
          connectionsToRemove.push({
            sourceModuleId: inConn.source,
            targetModuleId: inConn.target,
            sourcePortId: inConn.sourcePort,
            targetPortId: inConn.targetPort,
          })
          connectionsToAdd.push({
            sourceModuleId: inConn.source,
            targetModuleId: entryId,
            sourcePortId: inConn.sourcePort,
            targetPortId: 'audio',
          })
          connectionsToAdd.push({
            sourceModuleId: exitId,
            targetModuleId: targetId,
            sourcePortId: 'audio',
            targetPortId: 'audio',
          })
        }
      } else {
        // auto / parallel — target feeds entry, exit goes to master
        connectionsToAdd.push({
          sourceModuleId: targetId || exitId,
          targetModuleId: entryId,
          sourcePortId: 'audio',
          targetPortId: 'audio',
        })
        connectionsToAdd.push({
          sourceModuleId: exitId,
          targetModuleId: 'master',
          sourcePortId: 'audio',
          targetPortId: 'audio',
        })
      }
    } else if (exitId) {
      connectionsToAdd.push({
        sourceModuleId: exitId,
        targetModuleId: 'master',
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
    }
  } else if (options.mode === 'add_send') {
    // Send: source → entry, exit → master
    const sendSource = targetId || (() => {
      const toMaster = store.connections.find(c => c.target === 'master' && c.targetPort === 'audio')
      return toMaster?.source ?? null
    })()

    if (sendSource && entryId && exitId) {
      connectionsToAdd.push({
        sourceModuleId: sendSource,
        targetModuleId: entryId,
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
      connectionsToAdd.push({
        sourceModuleId: exitId,
        targetModuleId: 'master',
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
    }
  } else if (options.mode === 'add_layer') {
    // Layer: parallel to master (and optionally from target)
    if (targetId && entryId) {
      connectionsToAdd.push({
        sourceModuleId: targetId,
        targetModuleId: entryId,
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
    }
    if (exitId) {
      connectionsToAdd.push({
        sourceModuleId: exitId,
        targetModuleId: 'master',
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
    }
  } else if (options.mode === 'add_modulation') {
    const modSourceId = inferModSource(remapped)
    const modTargetId = targetId || (() => {
      const existing = store.listModules()
      return existing[0]?.id ?? null
    })()

    if (modSourceId && modTargetId) {
      const modTarget = store.modules.get(modTargetId)
      if (modTarget) {
        const cvPorts = getCvPorts(modTarget.type)
        const preferredOrder = ['cutoff', 'level', 'freq', 'res', 'drive', 'mix', 'time', 'feedback']
        const targetPort = preferredOrder.find(p => cvPorts.includes(p)) || cvPorts[0]

        if (targetPort) {
          connectionsToAdd.push({
            sourceModuleId: modSourceId,
            targetModuleId: modTargetId,
            sourcePortId: 'audio',
            targetPortId: targetPort,
          })
        } else {
          warnings.push(`No CV input found on ${modTargetId}`)
        }
      }
    }
    // Also route exit to master if it has an exit
    if (exitId && exitId !== modSourceId) {
      connectionsToAdd.push({
        sourceModuleId: exitId,
        targetModuleId: 'master',
        sourcePortId: 'audio',
        targetPortId: 'audio',
      })
    }
  }

  return {
    patch: remapped,
    warnings,
    idsRenamed: renamed,
    connectionsToRemove,
    connectionsToAdd,
  }
}

/**
 * Preview what applyPatch would do, without actually doing it.
 */
export function previewApply(jsonString: string, options: ApplyOptions): ApplySummary {
  const patch = parsePatch(jsonString)
  if (!patch) return { modulesAdded: 0, connectionsAdded: 0, routesRewired: 0, idsRenamed: 0, warnings: ['Invalid JSON'] }

  if (options.mode === 'replace') {
    return {
      modulesAdded: patch.modules.length,
      connectionsAdded: patch.connections.length,
      routesRewired: 0,
      idsRenamed: 0,
      warnings: [],
    }
  }

  const plan = buildApplyPlan(patch, options)
  return {
    modulesAdded: plan.patch.modules.length,
    connectionsAdded: plan.connectionsToAdd.length,
    routesRewired: plan.connectionsToRemove.length,
    idsRenamed: plan.idsRenamed,
    warnings: plan.warnings,
  }
}

/**
 * Apply a patch to the workspace in the given mode.
 */
export function applyPatch(jsonString: string, options: ApplyOptions): ApplySummary {
  const store = useWorkspaceStore.getState()

  if (options.mode === 'replace') {
    // Delegate to importPatch
    const { importPatch } = require('@/lib/patch-serialization')
    importPatch(jsonString)
    return { modulesAdded: 0, connectionsAdded: 0, routesRewired: 0, idsRenamed: 0, warnings: [] }
  }

  const patch = parsePatch(jsonString)
  if (!patch) return { modulesAdded: 0, connectionsAdded: 0, routesRewired: 0, idsRenamed: 0, warnings: ['Invalid JSON'] }

  // Stop transport
  if (transport.isPlaying) {
    useTransportStore.getState().stop()
  }

  const plan = buildApplyPlan(patch, options)

  // Create new modules
  let modulesAdded = 0
  for (const mod of plan.patch.modules) {
    try {
      store.addModule(mod.type as ModuleType, { x: mod.x, y: mod.y }, mod.id, mod.state)
      modulesAdded++
    } catch {
      plan.warnings.push(`Failed to create ${mod.id}`)
    }
  }

  // Remove connections marked for removal
  for (const conn of plan.connectionsToRemove) {
    const existing = store.connections.find(
      c => c.source === conn.sourceModuleId && c.target === conn.targetModuleId
        && c.sourcePort === conn.sourcePortId && c.targetPort === conn.targetPortId
    )
    if (existing) {
      store.removeConnection(existing.id)
    }
  }

  // Add new connections
  let connectionsAdded = 0
  for (const conn of plan.connectionsToAdd) {
    const result = store.addConnection({
      source: conn.sourceModuleId,
      sourcePort: conn.sourcePortId,
      target: conn.targetModuleId,
      targetPort: conn.targetPortId,
    })
    if (result) connectionsAdded++
  }

  return {
    modulesAdded,
    connectionsAdded,
    routesRewired: plan.connectionsToRemove.length,
    idsRenamed: plan.idsRenamed,
    warnings: plan.warnings,
  }
}
```

**Note:** The `require()` for importPatch above should be converted to a dynamic import or the function should accept importPatch as a parameter to avoid circular deps. In practice, restructure so `applyPatch` with mode='replace' calls `importPatch` from the caller side, not inside apply-engine. The apply drawer will handle this routing.

### 2. Create ApplyDrawer

Create `src/components/drawers/ApplyDrawer.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import {
  PRESETS, PRESET_LABELS, PRESET_ORDER,
  RECIPES, RECIPE_LABELS, RECIPE_ORDER,
  buildStackedPreset,
} from '@/lib/presets'
import { importPatch } from '@/lib/patch-serialization'
import { previewApply, applyPatch } from '@/lib/apply-engine'
import type { ApplyMode, ApplyTarget, ApplySummary } from '@/lib/apply-engine'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAudioEngine } from '@/hooks/use-audio-engine'

const STACK_COMBOS = [
  { label: 'Acid Movement', baseKey: 'acid-drive', modifiers: ['slow-wobble', 'envelope-pump'] },
  { label: 'Dub Motion Bus', baseKey: 'dub-chord-echo', modifiers: ['slow-wobble', 'drive-boost'] },
  { label: 'Mono Lead Plus', baseKey: 'classic-mono-lead', modifiers: ['slow-wobble', 'envelope-pump'] },
  { label: 'Sub Heavy Wobble', baseKey: 'sub-bass', modifiers: ['drive-boost', 'slow-wobble'] },
  { label: 'FM Space Bell', baseKey: 'electro-fm-bell', modifiers: ['wide-echo'] },
]

const MODES: { value: ApplyMode; label: string }[] = [
  { value: 'add_chain', label: 'Add Chain' },
  { value: 'add_modulation', label: 'Add Modulation' },
  { value: 'add_send', label: 'Add Send FX' },
  { value: 'add_layer', label: 'Add Layer' },
  { value: 'replace', label: 'Replace' },
]

const TARGET_TYPES: { value: ApplyTarget; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'before_module', label: 'Before Module' },
  { value: 'after_module', label: 'After Module' },
  { value: 'parallel_to_module', label: 'Parallel To' },
  { value: 'master_send', label: 'Master Send' },
]

export function ApplyDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sourceType, setSourceType] = useState<'preset' | 'stack' | 'recipe'>('preset')
  const [sourceKey, setSourceKey] = useState('')
  const [mode, setMode] = useState<ApplyMode>('add_chain')
  const [targetType, setTargetType] = useState<ApplyTarget>('auto')
  const [targetModuleId, setTargetModuleId] = useState('')
  const [preview, setPreview] = useState<ApplySummary | null>(null)
  const modules = useWorkspaceStore(s => s.listModules())
  const { initialize, audioState } = useAudioEngine()

  // Get source JSON
  const getSourceJson = useCallback((): string => {
    if (sourceType === 'preset') return PRESETS[sourceKey] || ''
    if (sourceType === 'recipe') return RECIPES[sourceKey] || ''
    const idx = Number(sourceKey)
    const combo = STACK_COMBOS[idx]
    if (!combo) return ''
    try {
      return buildStackedPreset(combo.baseKey, combo.modifiers).json
    } catch {
      return ''
    }
  }, [sourceType, sourceKey])

  // Refresh preview when inputs change
  useEffect(() => {
    const json = getSourceJson()
    if (!json) {
      setPreview(null)
      return
    }
    const result = previewApply(json, { mode, targetType, targetModuleId: targetModuleId || undefined })
    setPreview(result)
  }, [getSourceJson, mode, targetType, targetModuleId])

  // Source items based on type
  const sourceItems = sourceType === 'preset'
    ? PRESET_ORDER.map(k => ({ value: k, label: PRESET_LABELS[k] || k }))
    : sourceType === 'recipe'
    ? RECIPE_ORDER.map(k => ({ value: k, label: RECIPE_LABELS[k] || k }))
    : STACK_COMBOS.map((c, i) => ({ value: String(i), label: c.label }))

  const handleApply = async () => {
    const json = getSourceJson()
    if (!json) return
    if (audioState === 'stopped') await initialize()

    if (mode === 'replace') {
      importPatch(json)
    } else {
      applyPatch(json, { mode, targetType, targetModuleId: targetModuleId || undefined })
    }
  }

  const handleReplace = async () => {
    const json = getSourceJson()
    if (!json) return
    if (audioState === 'stopped') await initialize()
    importPatch(json)
  }

  if (!open) return null

  return (
    <aside className="fixed right-[140px] top-[44px] w-[260px] bg-panel border-l border-border-light shadow-md z-[90] max-h-[calc(100vh-44px)] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-light">
        <h2 className="text-[11px] font-semibold uppercase tracking-[1px] text-text-muted">Apply</h2>
        <button onClick={onClose} className="text-text-muted hover:text-accent-orange cursor-pointer">×</button>
      </div>

      <div className="p-4 flex flex-col gap-2.5">
        {/* Source type */}
        <select value={sourceType} onChange={e => { setSourceType(e.target.value as any); setSourceKey('') }}
          className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full">
          <option value="preset">PRESET</option>
          <option value="stack">STACK</option>
          <option value="recipe">RECIPE</option>
        </select>

        {/* Source item */}
        <select value={sourceKey} onChange={e => setSourceKey(e.target.value)}
          className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full">
          <option value="">Select source...</option>
          {sourceItems.map(item => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>

        {/* Mode */}
        <select value={mode} onChange={e => setMode(e.target.value as ApplyMode)}
          className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full">
          {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        {/* Target type */}
        <select value={targetType} onChange={e => setTargetType(e.target.value as ApplyTarget)}
          className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full">
          {TARGET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Target module */}
        <select value={targetModuleId} onChange={e => setTargetModuleId(e.target.value)}
          className="text-[11px] bg-bg border border-border rounded-[4px] px-2 py-1.5 text-text-light w-full">
          <option value="">Target Module (auto)</option>
          {modules.map(m => (
            <option key={m.id} value={m.id}>{m.id} ({m.type})</option>
          ))}
        </select>

        {/* Preview */}
        {preview && (
          <pre className="text-[9px] text-text-muted bg-bg rounded-[4px] p-2 border border-border-light whitespace-pre-wrap">
            {`+${preview.modulesAdded} modules\n+${preview.connectionsAdded} connections\n~${preview.routesRewired} rewired\n${preview.idsRenamed} renamed`}
            {preview.warnings.length > 0 && `\n\n⚠ ${preview.warnings.join('\n⚠ ')}`}
          </pre>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={handleApply} disabled={!sourceKey}
            className="flex-1 text-[10px] uppercase tracking-wide py-1.5 bg-accent-orange text-white rounded-[4px] hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer disabled:cursor-default">
            Apply
          </button>
          <button onClick={handleReplace} disabled={!sourceKey}
            className="text-[10px] uppercase tracking-wide px-2.5 py-1.5 bg-panel border border-border rounded-[4px] text-text-light hover:border-accent-orange disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-default">
            Replace
          </button>
        </div>
      </div>
    </aside>
  )
}
```

### 3. Wire Apply drawer into App + Toolbar

Add an Apply button to the toolbar and manage its open state in App.

Update `src/components/toolbar/Toolbar.tsx` — add an Apply button:

```tsx
// Add this prop:
export function Toolbar({
  onSectionToggle,
  onApplyToggle,
  applyOpen,
}: {
  onSectionToggle: (section: Section | null) => void
  onApplyToggle: () => void
  applyOpen: boolean
}) {
  // ... existing code, add before the spacer div:

      <div className="w-px h-5 bg-border-light" />

      <button
        onClick={onApplyToggle}
        className={`text-[10px] uppercase tracking-wide px-2.5 py-1 border rounded-[4px] transition-colors cursor-pointer ${
          applyOpen
            ? 'bg-accent-orange text-white border-accent-orange'
            : 'bg-panel border-border text-text-light hover:border-accent-orange'
        }`}
      >
        Apply
      </button>
```

Update `src/components/App.tsx`:

```tsx
import { useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { WorkspaceCanvas } from './workspace/WorkspaceCanvas'
import { ModulePalette } from './palette/ModulePalette'
import { Toolbar } from './toolbar/Toolbar'
import { SectionPanel } from './drawers/SectionDrawer'
import { ApplyDrawer } from './drawers/ApplyDrawer'
import { useKeyboard } from '@/hooks/use-keyboard'

type Section = 'recipe' | 'preset' | 'stack'

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

        <main className="flex-1 relative" style={{ marginRight: 140 }}>
          <WorkspaceCanvas />
        </main>

        <ApplyDrawer open={applyOpen} onClose={() => setApplyOpen(false)} />
        <ModulePalette />
      </div>
    </ReactFlowProvider>
  )
}
```

---

## Files Created/Modified

| Action | File |
|--------|------|
| Create | `src/lib/apply-engine.ts` |
| Create | `src/components/drawers/ApplyDrawer.tsx` |
| Modify | `src/components/toolbar/Toolbar.tsx` |
| Modify | `src/components/App.tsx` |

## Verify It Works

### Apply drawer UI
1. Click **Apply** in toolbar — drawer appears on right side (next to palette)
2. Select source type (Preset/Stack/Recipe), pick a source item
3. Select mode (Add Chain, Add Modulation, etc.)
4. Select target type and target module
5. **Preview** updates in real-time showing counts

### Apply modes
1. Load "Sub Bass" preset first
2. Open Apply drawer → Source: Preset → "Acid Drive" → Mode: **Add Chain** → Target Type: After Module → Target: the filter module
3. Click **Apply** — distortion chain inserts after the filter
4. Verify: original modules still exist, new modules added, cables rewired

5. Reload Sub Bass
6. Apply with **Add Modulation** → Source: an LFO-containing preset → target a filter
7. Verify: LFO connects to the filter's cutoff CV port

8. Reload Sub Bass
9. Apply with **Add Send** — creates parallel send path to master
10. Apply with **Add Layer** — creates parallel output to master

11. Click **Replace** button — fully replaces the patch (same as Load Preset)
