---
title: Jeskola React Architecture
type: note
permalink: knowledge/jeskola-react-architecture
tags:
- jeskola
- react
- architecture
- current-state
---

# Jeskola React Architecture

## Overview
Jeskola (branded "SYNTHESIS") was fully converted from vanilla TypeScript to a React 19 + Zustand + React Flow architecture. The audio engine layer (Web Audio API) was preserved; the UI was completely rewritten.

## Technology Stack (Current)
- **React 19** with Vite 7.3 + TypeScript 5.9
- **Zustand 5** for state management (workspace-store, audio-store)
- **React Flow (@xyflow/react v12)** for the node-based workspace canvas
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (uses CSS cascade layers)
- **class-variance-authority (CVA)** for Button component variants
- **Inter font**, Dieter Rams-inspired design system

## Key Architecture Decisions

### State Management
- `workspace-store.ts` — Zustand store for modules, connections, positions
- `audio-store.ts` — Zustand store for audio engine state
- Module audio nodes are stored in Zustand as `ModuleEntry.audioNode`
- `use-audio-engine.ts` hook manages AudioEngine singleton init

### Module System
- `ModuleNode.tsx` — single React component renders all module types
- `module-body-registry.ts` — registry pattern for module body components
- `module-registry.ts` — MODULE_PORTS, MODULE_LABELS, factory functions
- Each module body: `src/components/workspace/module-nodes/*Body.tsx`

### Layout System
- `workspace-layout.ts` — centralized layout constants (WORKSPACE_LAYOUT)
- Module dimensions: minWidth, radius, padding, handle positions
- Handle positioning: `handleStartOffset + i * handleRowGap` from card top
- Port labels use `height: handleRowGap` per label for vertical alignment with handles
- Subtitle support on modules shifts handle offset by 22px

### Component Library
- `src/components/ui/button.tsx` — CVA Button with variants (rams, rams-primary, rams-text) and sizes (rams-tight, rams, rams-bar)
- `src/components/ui/card.tsx` — Card, CardHeader, CardContent

### Audio Node State Updates
- `ModularNode.patchState(patch)` — updates `_state` for serialization without triggering `pushStateToAudio()`
- All module bodies use `patchState()` instead of state setter to avoid double AudioParam updates
- Direct AudioParam methods (setX()) handle real-time audio; patchState() handles serialization sync

## Critical CSS Note
Tailwind CSS v4 uses cascade layers. The global reset `* { padding: 0 }` MUST be inside `@layer base { }` — otherwise unlayered styles override Tailwind's layered utilities (px-4, py-2, etc. silently fail).

## File Structure
```
src/
  audio/nodes/          — Audio engine (ModularNode base + 10 module types)
  components/
    controls/           — Knob, SegmentToggle
    drawers/            — ApplyDrawer, PresetDrawer, RecipeDrawer, SectionDrawer, StackDrawer
    palette/            — ModulePalette (right sidebar)
    toolbar/            — Toolbar, TransportControls, FileControls, AudioToggle
    ui/                 — Button, Card (design system primitives)
    workspace/          — WorkspaceCanvas, ModuleNode, AudioCable
      module-nodes/     — OscillatorBody, FilterBody, etc. (10 body components)
  hooks/                — use-audio-engine
  lib/                  — module-registry, module-body-registry, workspace-layout
  stores/               — workspace-store, audio-store
  styles/               — globals.css (Tailwind + custom reset)
```

## Related
- [[Jeskola Current State Research]] — pre-React architecture (historical)
- [[CV Voltage Standard]]
- [[Transport Architecture Decision]]
- [[ModularNode Multi-Port Output Decision]]
