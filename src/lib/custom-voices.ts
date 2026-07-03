import type { PatchState } from '@/lib/patch-serialization'

export interface CustomVoicePreset {
  id: string
  name: string
  patch: PatchState
  tags?: string[]
  createdAt: string
  updatedAt: string
  version: 1
}

export interface CustomVoiceLibrary {
  schemaVersion: 1
  items: CustomVoicePreset[]
}

const STORAGE_KEY = 'jeskola.customVoices.v1'

function nowIso(): string {
  return new Date().toISOString()
}

function createId(): string {
  return crypto.randomUUID()
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isPatchLike(value: unknown): value is PatchState {
  if (!value || typeof value !== 'object') return false
  const raw = value as Record<string, unknown>
  return Array.isArray(raw.modules) && Array.isArray(raw.connections)
}

function sanitizePatch(patch: PatchState): PatchState {
  const rawModules = Array.isArray(patch.modules) ? patch.modules : []
  const modules = rawModules
    .filter((m): m is PatchState['modules'][number] => !!m && typeof m === 'object')
    .filter(m => typeof m.id === 'string' && m.id !== 'master' && typeof m.type === 'string')
    .map(m => ({
      id: m.id,
      type: m.type,
      x: typeof m.x === 'number' ? m.x : 0,
      y: typeof m.y === 'number' ? m.y : 0,
      state: m.state && typeof m.state === 'object' ? m.state : {},
    }))

  const ids = new Set(modules.map(m => m.id))
  const rawConnections = Array.isArray(patch.connections) ? patch.connections : []
  const connections = rawConnections
    .filter((c): c is PatchState['connections'][number] => !!c && typeof c === 'object')
    .filter(c =>
      typeof c.sourceModuleId === 'string'
      && typeof c.targetModuleId === 'string'
      && ids.has(c.sourceModuleId)
      && ids.has(c.targetModuleId)
    )
    .map(c => ({
      sourceModuleId: c.sourceModuleId,
      targetModuleId: c.targetModuleId,
      sourcePortId: typeof c.sourcePortId === 'string' ? c.sourcePortId : 'audio',
      targetPortId: typeof c.targetPortId === 'string' ? c.targetPortId : 'audio',
    }))

  return { modules, connections }
}

function normalizeLibrary(value: unknown): CustomVoiceLibrary {
  if (!value || typeof value !== 'object') {
    return { schemaVersion: 1, items: [] }
  }

  const raw = value as Record<string, unknown>
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.items)) {
    console.warn('[custom-voices] Unknown schema version or invalid payload. Resetting library.')
    return { schemaVersion: 1, items: [] }
  }

  const items: CustomVoicePreset[] = []
  for (const item of raw.items) {
    if (!item || typeof item !== 'object') continue
    const v = item as Record<string, unknown>
    if (typeof v.id !== 'string' || typeof v.name !== 'string') continue
    if (!isPatchLike(v.patch)) continue

    const patch = sanitizePatch(v.patch)
    if (patch.modules.length === 0) continue

    items.push({
      id: v.id,
      name: v.name,
      patch,
      tags: Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string') : undefined,
      createdAt: typeof v.createdAt === 'string' ? v.createdAt : nowIso(),
      updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : nowIso(),
      version: 1,
    })
  }

  return { schemaVersion: 1, items }
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

function ensureUniqueName(baseName: string, items: CustomVoicePreset[], excludeId?: string): string {
  const normalized = baseName.trim() || 'Untitled Voice'
  const used = new Set(
    items
      .filter(item => item.id !== excludeId)
      .map(item => item.name.toLowerCase())
  )

  if (!used.has(normalized.toLowerCase())) return normalized

  let counter = 2
  while (used.has(`${normalized} (${counter})`.toLowerCase())) {
    counter++
  }
  return `${normalized} (${counter})`
}

export function loadCustomVoiceLibrary(): CustomVoiceLibrary {
  const storage = getSafeStorage()
  if (!storage) return { schemaVersion: 1, items: [] }

  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return { schemaVersion: 1, items: [] }
    return normalizeLibrary(JSON.parse(raw))
  } catch {
    return { schemaVersion: 1, items: [] }
  }
}

export function saveCustomVoiceLibrary(library: CustomVoiceLibrary): void {
  const storage = getSafeStorage()
  if (!storage) return
  storage.setItem(STORAGE_KEY, JSON.stringify(normalizeLibrary(library)))
}

export function upsertCustomVoicePreset(input: {
  id?: string
  name: string
  patch: PatchState
  tags?: string[]
}): CustomVoicePreset {
  const library = loadCustomVoiceLibrary()
  const patch = sanitizePatch(input.patch)
  if (patch.modules.length === 0) {
    throw new Error('Cannot save an empty voice preset.')
  }

  const existingIndex = input.id
    ? library.items.findIndex(item => item.id === input.id)
    : -1

  if (existingIndex >= 0) {
    const existing = library.items[existingIndex]
    const updated: CustomVoicePreset = {
      ...existing,
      name: ensureUniqueName(input.name, library.items, existing.id),
      patch,
      tags: input.tags,
      updatedAt: nowIso(),
      version: 1,
    }
    library.items[existingIndex] = updated
    saveCustomVoiceLibrary(library)
    return clone(updated)
  }

  const created: CustomVoicePreset = {
    id: createId(),
    name: ensureUniqueName(input.name, library.items),
    patch,
    tags: input.tags,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    version: 1,
  }
  library.items.unshift(created)
  saveCustomVoiceLibrary(library)
  return clone(created)
}

export function renameCustomVoicePreset(id: string, newName: string): CustomVoicePreset | null {
  const library = loadCustomVoiceLibrary()
  const index = library.items.findIndex(item => item.id === id)
  if (index < 0) return null
  const existing = library.items[index]
  const renamed: CustomVoicePreset = {
    ...existing,
    name: ensureUniqueName(newName, library.items, existing.id),
    updatedAt: nowIso(),
  }
  library.items[index] = renamed
  saveCustomVoiceLibrary(library)
  return clone(renamed)
}

export function duplicateCustomVoicePreset(id: string): CustomVoicePreset | null {
  const library = loadCustomVoiceLibrary()
  const existing = library.items.find(item => item.id === id)
  if (!existing) return null
  const duplicated: CustomVoicePreset = {
    ...existing,
    id: createId(),
    name: ensureUniqueName(existing.name, library.items),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  library.items.unshift(duplicated)
  saveCustomVoiceLibrary(library)
  return clone(duplicated)
}

export function deleteCustomVoicePreset(id: string): boolean {
  const library = loadCustomVoiceLibrary()
  const nextItems = library.items.filter(item => item.id !== id)
  if (nextItems.length === library.items.length) return false
  saveCustomVoiceLibrary({ schemaVersion: 1, items: nextItems })
  return true
}

