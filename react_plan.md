# React Conversion Plan — Jeskola / SYNTHESIS

## Philosophy

The goal is not to rewrite the synth engine — it's to give it a proper UI framework so adding features becomes easy instead of fighting a 1833-line monolith. The audio layer stays pure TypeScript. React owns the pixels. A thin store bridges them.

Keep the Dieter Rams aesthetic. Every shadcn component gets restyled to match: off-white panels, muted tones, orange/blue accents, Inter font, minimal borders. If it doesn't look like it belongs on a Braun product, it doesn't ship.

---

## State Management: The Options

| Library | Size | Style | Audio-Friendly? | Verdict |
|---------|------|-------|----------------|---------|
| **Zustand** | ~1KB | Flux-inspired, hooks | Yes — `getState()` outside React, `subscribe()` for slices | **Winner** |
| **Jotai** | ~3KB | Atomic (bottom-up) | Decent — atoms are accessible outside React | Good but more ceremony for our use case |
| **Valtio** | ~3KB | Proxy (mutable) | Yes — direct mutation, auto-tracking | Close second — but proxy magic can surprise |
| **Redux Toolkit** | ~11KB | Actions/reducers | Possible but awkward | Too heavy, too much boilerplate for real-time audio |
| **XState** | ~15KB | State machines | Good for transport FSM | Overkill for knobs and module params |

### Why Zustand

A modular synth has a critical split: **the audio graph runs on its own timeline** (AudioContext.currentTime) and the **UI must never block it**. Zustand is built for this:

1. **Imperative access**: `useWorkspaceStore.getState()` works from audio callbacks, Transport ticks, and keyboard handlers — no React context needed
2. **Surgical re-renders**: `useWorkspaceStore(s => s.modules)` — only re-render when modules change, not when the transport ticks
3. **Middleware**: `immer` for immutable updates on nested patch state, `devtools` for debugging
4. **Tiny**: 1KB gzipped. Rams would approve.
5. **No providers**: No `<StoreProvider>` wrapper. Just import and use.

The pattern: **Audio nodes are the source of truth for real-time values. Zustand is the source of truth for UI state and serialization.** Knob drag → Zustand update → audio callback fires. Transport tick → audio schedules notes → Zustand updates playhead position for UI.

---

## React Flow: Yes, Use It

The current `Workspace.ts` is 1148 lines handling: pan, zoom, drag, cable drawing, connection logic, module placement, SVG paths, touch events, import/export. React Flow handles all of this out of the box AND gives us:

- **Minimap** — free navigation aid for complex patches
- **Multi-select** — select/move/delete groups of modules
- **Keyboard navigation** — accessibility
- **Edge labels** — show CV/audio/gate on cables
- **Custom nodes** — our modules become React components
- **Custom edges** — cables styled with our bezier curves + orange hover
- **Connection validation** — replace our manual one-output-one-input checks
- **Built-in undo/redo hooks** — we currently have none
- **Touch support** — already built in
- **Snap-to-grid** — cleaner layouts

Trade-off: React Flow adds ~45KB gzipped. But it replaces 1148 lines of hand-written code and gives us features we'd never build ourselves. Worth it.

### What Stays Custom

- Module internals (knobs, sequencer grid, port dots) — custom React components
- Cable appearance — custom React Flow edge component with our bezier + color coding
- Connection validation — custom `isValidConnection` callback using our audio routing rules

---

## What React Ecosystem Gets Us

Now that we're in React, these become trivially easy:

| Tool | What It Replaces | Why |
|------|-----------------|-----|
| **React Flow** | Workspace.ts (1148 lines) | Node canvas, cables, pan/zoom, drag, connections |
| **shadcn/ui** | Hand-built toolbar, drawers, selects | Accessible, styled components. Sheet for drawers, Select for dropdowns, Button, Slider, Popover, Dialog |
| **Tailwind CSS** | style.css (873 lines) | Utility classes with our Rams design tokens. Easier to maintain. |
| **Vitest + Testing Library** | Puppeteer (16 scripts) | Faster, more reliable, component-level testing |
| **Sonner** (shadcn toast) | `window.alert()` | Non-blocking notifications |
| **cmdk** (optional, future) | Nothing yet | Command palette for quick module add, preset search |
| **react-hotkeys-hook** | Global keydown/keyup handlers | Declarative keyboard shortcuts, auto-cleanup |

---

## Architecture

```
src/
├── audio/                    # UNTOUCHED — pure TypeScript, zero React
│   ├── AudioEngine.ts        # Singleton, AudioContext wrapper
│   ├── Transport.ts          # BPM clock singleton
│   ├── nodes/
│   │   ├── ModularNode.ts    # Abstract base (keep as-is)
│   │   ├── OscillatorModule.ts
│   │   ├── FilterModule.ts
│   │   ├── DelayModule.ts
│   │   ├── DistortionModule.ts
│   │   ├── GainModule.ts
│   │   ├── AdsrModule.ts
│   │   ├── LfoModule.ts
│   │   ├── SequencerModule.ts
│   │   ├── KeyboardModule.ts
│   │   └── MasterNode.ts
│   └── sequencer/
│       └── types.ts
│
├── stores/                   # Zustand stores — the bridge
│   ├── workspace-store.ts    # modules, connections, transform, add/remove/connect
│   ├── transport-store.ts    # bpm, playing, currentStep, play/stop
│   ├── preset-store.ts       # active preset/recipe/stack, morph value
│   └── keyboard-store.ts     # heldKeys, octaveOffset, enabled modules
│
├── components/
│   ├── App.tsx               # Root — layout shell, keyboard listener, audio init
│   │
│   ├── workspace/
│   │   ├── WorkspaceCanvas.tsx    # React Flow <ReactFlow> wrapper
│   │   ├── AudioCable.tsx         # Custom edge — bezier, color-coded, click-to-delete
│   │   ├── ModuleNode.tsx         # Base custom node wrapper (header, ports, body)
│   │   └── module-nodes/          # Per-type node body components
│   │       ├── OscillatorBody.tsx
│   │       ├── FilterBody.tsx
│   │       ├── DelayBody.tsx
│   │       ├── DistortionBody.tsx
│   │       ├── GainBody.tsx
│   │       ├── AdsrBody.tsx
│   │       ├── LfoBody.tsx
│   │       ├── SequencerBody.tsx
│   │       ├── KeyboardBody.tsx
│   │       └── MasterBody.tsx
│   │
│   ├── controls/
│   │   ├── Knob.tsx              # React port — same drag behavior, lin/log, step snap
│   │   ├── PortDot.tsx           # Visual port indicator (React Flow handles logic)
│   │   └── SegmentToggle.tsx     # LIN/LOG, waveform select, etc.
│   │
│   ├── toolbar/
│   │   ├── Toolbar.tsx           # Two-tier header layout
│   │   ├── TransportControls.tsx # Play/Stop, BPM input
│   │   ├── FileControls.tsx      # Save/Load buttons
│   │   └── AudioToggle.tsx       # Start/Stop audio button
│   │
│   ├── drawers/
│   │   ├── PresetDrawer.tsx      # shadcn Sheet — preset select + load
│   │   ├── StackDrawer.tsx       # shadcn Sheet — base + 3 modifiers + load
│   │   ├── RecipeDrawer.tsx      # shadcn Sheet — recipe select + morph slider
│   │   └── ApplyDrawer.tsx       # shadcn Sheet — source/mode/target + preview + apply
│   │
│   └── palette/
│       └── ModulePalette.tsx     # Sidebar — add module buttons (drag-to-canvas)
│
├── hooks/
│   ├── use-audio-engine.ts       # Init/suspend/resume AudioContext
│   ├── use-keyboard.ts           # QWERTY → noteOn/noteOff, octave shift
│   ├── use-module-factory.ts     # Creates audio node + returns initial state
│   └── use-transport-sync.ts     # Syncs Transport singleton → store for UI
│
├── lib/
│   ├── presets.ts                # Moved from src/presets.ts (pure data, no UI)
│   ├── module-registry.ts       # Module type → component mapping
│   ├── patch-serialization.ts   # Export/import/normalize patch state
│   └── utils.ts                 # Shared helpers
│
├── styles/
│   └── globals.css               # Tailwind base + Rams design tokens
│
├── main.tsx                      # ReactDOM.createRoot entry
└── index.html                    # Minimal shell
```

---

## Design Token Migration

Current CSS variables → Tailwind config:

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        bg: '#EFEFEF',
        panel: '#FAFAFA',
        'text-main': '#2A2A2A',
        'text-light': '#5A5A5A',
        'text-muted': '#7A7A7A',
        border: 'rgba(0, 0, 0, 0.15)',
        accent: {
          orange: '#EA523F',
          green: '#607C64',
          blue: '#3A7CA5',
        },
        wire: '#4A4A4A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      boxShadow: {
        sm: '0 2px 5px rgba(0, 0, 0, 0.05)',
        md: '0 4px 12px rgba(0, 0, 0, 0.08)',
        knob: '0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.8)',
      },
    },
  },
}
```

shadcn components get restyled via CSS variables in `globals.css` to match the Rams palette. No blue defaults, no rounded-lg pills. Flat, muted, functional.

---

## Zustand Store Design

### workspace-store.ts

```ts
type ModuleEntry = {
  id: string
  type: string
  position: { x: number; y: number }
  state: Record<string, unknown>
  audioNode: ModularNode  // imperative reference — not serialized
}

type Connection = {
  id: string
  source: string
  sourcePort: string
  target: string
  targetPort: string
}

type WorkspaceStore = {
  modules: Map<string, ModuleEntry>
  connections: Connection[]

  // Actions
  addModule: (type: string, position?: { x: number; y: number }) => string
  removeModule: (id: string) => void
  updateModuleState: (id: string, state: Partial<Record<string, unknown>>) => void
  moveModule: (id: string, position: { x: number; y: number }) => void

  addConnection: (conn: Omit<Connection, 'id'>) => boolean
  removeConnection: (id: string) => void

  exportPatch: () => string
  importPatch: (json: string) => void
  applyPatch: (json: string, options: ApplyOptions) => ApplyResult

  clear: () => void
}
```

### transport-store.ts

```ts
type TransportStore = {
  bpm: number
  isPlaying: boolean
  currentStep: number  // for UI playhead highlight
  ticksPerBeat: number
  swing: number

  setBpm: (bpm: number) => void
  play: () => void
  stop: () => void
  setSwing: (swing: number) => void
}
```

The Transport singleton fires audio events. The store mirrors state for UI. Transport `onTick` callback updates `currentStep` in the store → sequencer grid highlights the right cell.

### keyboard-store.ts

```ts
type KeyboardStore = {
  heldKeys: string[]
  octaveOffset: number

  keyDown: (key: string) => void
  keyUp: (key: string) => void
  adjustOctave: (delta: number) => void
  releaseAll: () => void
}
```

---

## Component Detail: Key Patterns

### Knob.tsx

Port the current `Knob.ts` class to a React component. Same behavior:
- Vertical drag (150px = full range)
- Lin/log modes
- Step snapping
- Double-click reset
- 60fps throttled onChange via rAF

```tsx
type KnobProps = {
  label: string
  min: number
  max: number
  value: number
  defaultValue?: number
  onChange: (value: number) => void
  logCapable?: boolean
  isLogMode?: boolean
  onModeChange?: (isLog: boolean) => void
  step?: number
}
```

Uses `useRef` for drag state (no re-renders during drag), `useCallback` for stable handlers, `useEffect` for cleanup.

### ModuleNode.tsx (React Flow Custom Node)

```tsx
// Wraps every module type with consistent header + ports
function ModuleNode({ id, data }: NodeProps<ModuleNodeData>) {
  return (
    <div className="bg-panel border border-border rounded shadow-sm">
      <div className="module-header drag-handle">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {data.label}
        </span>
        <button onClick={() => removeModule(id)} className="...">×</button>
      </div>

      {/* Input ports — React Flow Handles */}
      <Handle type="target" position={Position.Left} id="audio" />
      {data.cvPorts?.map(port => (
        <Handle type="target" position={Position.Left} id={port.id} key={port.id} />
      ))}

      {/* Module-specific body */}
      <data.BodyComponent moduleId={id} />

      {/* Output ports */}
      <Handle type="source" position={Position.Right} id="audio" />
      {data.outputPorts?.map(port => (
        <Handle type="source" position={Position.Right} id={port.id} key={port.id} />
      ))}
    </div>
  )
}
```

### AudioCable.tsx (React Flow Custom Edge)

```tsx
// Custom edge with:
// - Color coding: audio=wire gray, CV=blue, gate=orange
// - Click-to-delete (hover turns orange)
// - Cubic bezier matching current style
function AudioCable({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY })
  const color = data?.type === 'cv' ? 'var(--accent-blue)'
    : data?.type === 'gate' ? 'var(--accent-orange)'
    : 'var(--wire-color)'

  return (
    <path d={path} stroke={color} strokeWidth={2.5} fill="none"
      className="hover:stroke-accent-orange cursor-pointer transition-colors"
      onClick={() => removeConnection(id)} />
  )
}
```

### SequencerBody.tsx

The most complex module UI. Currently 260 lines inline in main.ts. As a React component:

- Step grid rendered as a grid of `<button>` elements
- Active step = orange bg, playing step = blue ring
- Right-click → shadcn Popover with note picker
- Scroll wheel on cell = note pitch adjust
- Pattern length selector
- Octave offset display
- All state lives in Zustand, synced to SequencerModule audio node

---

## Migration Phases

### Phase 1: Scaffold + Audio Bridge
- `npm create vite@latest` with React + TypeScript
- Install: `tailwindcss`, `@tailwindcss/vite`, `shadcn`, `zustand`, `@xyflow/react`
- Copy `src/audio/` directory unchanged
- Set up Tailwind config with Rams design tokens
- Set up shadcn with custom theme
- Create Zustand stores (workspace, transport, keyboard, preset)
- Create `use-audio-engine` hook
- Verify: audio engine initializes, AudioContext creates

### Phase 2: Workspace Canvas
- Implement `WorkspaceCanvas.tsx` with React Flow
- Create `ModuleNode.tsx` base custom node
- Create `AudioCable.tsx` custom edge
- Implement connection validation (one-output-one-input, no self-connect, no duplicates)
- Port `ModulePalette.tsx` — drag from palette to canvas creates node
- Port pan/zoom (React Flow built-in, configure min/max scale 0.15-2.0)
- Verify: can add modules to canvas, drag them, pan/zoom

### Phase 3: Knob + Module Bodies
- Port `Knob.tsx` from `Knob.ts`
- Implement each module body component:
  - `OscillatorBody.tsx` — waveform select, pitch/freq mode, oct/semi/cent or freq knobs
  - `FilterBody.tsx` — type select, cutoff + resonance knobs
  - `DelayBody.tsx` — time/feedback/mix knobs
  - `DistortionBody.tsx` — drive/mix/output knobs
  - `GainBody.tsx` — level knob
  - `AdsrBody.tsx` — A/D/S/R knobs
  - `LfoBody.tsx` — rate/depth knobs, waveform select
  - `KeyboardBody.tsx` — octave display, enable toggle
  - `SequencerBody.tsx` — step grid, note picker, pattern controls
  - `MasterBody.tsx` — minimal (just input port)
- Wire knob onChange → Zustand → audio param
- Verify: all modules render, knobs work, audio plays

### Phase 4: Toolbar + Drawers
- `Toolbar.tsx` with two-tier layout
- `TransportControls.tsx` — play/stop, BPM (shadcn Input)
- `FileControls.tsx` — save/load (shadcn Button)
- `AudioToggle.tsx` — init/suspend/resume
- `PresetDrawer.tsx` — shadcn Sheet + Select
- `StackDrawer.tsx` — shadcn Sheet + base/modifier selects
- `RecipeDrawer.tsx` — shadcn Sheet + select + Slider for morph
- `ApplyDrawer.tsx` — shadcn Sheet + all apply controls + preview
- Section chips for drawer toggling
- Verify: all presets load, stacks build, recipes morph, apply works

### Phase 5: Keyboard + Polish
- `use-keyboard` hook — QWERTY note input, octave shift, mono priority
- Text input guard (don't trigger notes when typing in BPM input, etc.)
- Window blur/visibility cleanup
- Gate target registration on connection/disconnection
- Cable color coding (audio/CV/gate)
- Replace `window.alert` with Sonner toasts
- Module removal with proper cleanup
- Verify: keyboard works, all interactions smooth

### Phase 6: Import/Export + Serialization
- `patch-serialization.ts` — export/import/normalize
- Backward compatibility with existing `.json` patch files
- Apply engine (add_chain, add_modulation, add_send, add_layer)
- Preview apply (dry run)
- Stale import protection
- Verify: old patches load, apply modes work, round-trip serialization

### Phase 7: Tests
- Replace Puppeteer with Vitest + React Testing Library
- Port all 16 test scenarios:
  - Preset integrity (unit test, no DOM needed)
  - Composed/stacked/recipe preset loading
  - Apply modes
  - Keyboard behavior
  - Import edge cases
- Add component tests for Knob, SequencerBody, ModuleNode
- Verify: all tests pass

### Phase 8: Cleanup
- Remove old vanilla files (`src/main.ts`, `src/ui/Workspace.ts`, `src/ui/Knob.ts`, `src/style.css`)
- Remove Puppeteer dev dependency and test scripts
- Remove `index.html` old structure
- Update `package.json` scripts
- Final visual QA against current app — every pixel should match the Rams aesthetic
- Performance check — React Flow with 20+ modules should stay smooth

---

## What We Gain

After conversion:

1. **Adding a new module type** = create one `FooBody.tsx` component + one `FooModule.ts` audio node + register in module registry. No touching a 1833-line switch statement.

2. **Undo/redo** = React Flow has built-in hooks. Zustand supports temporal middleware. We could add this in a single afternoon.

3. **Minimap** = `<MiniMap />` — one line of JSX.

4. **Module groups** = React Flow supports grouping nodes. Could group "voice" modules together.

5. **Better presets UI** = shadcn Sheet + Dialog + Tabs gives us richer browsing without building everything from scratch.

6. **Command palette** = Drop in `cmdk` and you get fuzzy-search for modules, presets, actions.

7. **Accessible** = shadcn/Radix primitives are ARIA-compliant. Keyboard navigation for free.

8. **Easier testing** = React Testing Library + Vitest is faster and more reliable than Puppeteer browser tests.

9. **Future MIDI panel** = Just another component + hook. Web MIDI API → Zustand store → keyboard module.

10. **Future oscilloscope/meter** = React component reading from AnalyserNode, renders on canvas. Plugs right into the module body pattern.

---

## What We Preserve

- **All 10 audio module types** — identical Web Audio graphs
- **1V/octave CV standard** — unchanged
- **Gate signal interface** — `onGateSignal(gateOn, time)` stays
- **Transport "Tale of Two Clocks"** — unchanged
- **Anti-click ramps** — all timing constants preserved
- **Preset system** — all 15 base + 10 composed + 5 stacked + 6 recipes + 4 modifiers
- **Apply engine** — all 5 modes preserved
- **Patch format** — backward compatible with existing `.json` files
- **The look** — Rams aesthetic, same colors, same fonts, same feel

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| React re-renders during audio playback cause glitches | Zustand slices prevent cascading re-renders. Audio params are set imperatively, not through React state. Transport runs on its own timer. |
| React Flow performance with many modules | React Flow uses virtualization. Custom nodes are lightweight. Memoize module bodies. |
| Knob drag feels laggy in React | Use refs for drag state, rAF for visual updates, same 60fps pattern as current implementation. onChange only fires on rAF tick. |
| Sequencer playhead flickers | Transport `onTick` sets `currentStep` in Zustand. Sequencer body subscribes to just that one number. Minimal re-render. |
| Bundle size increases | React (~40KB) + React Flow (~45KB) + Zustand (~1KB) + shadcn (tree-shaken) + Tailwind (purged). Total ~100-120KB gzipped. Acceptable for a desktop web app. |
| Old patches don't load | `patch-serialization.ts` keeps the exact same normalization logic. Test with all existing presets. |

---

## Dependencies

```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "@xyflow/react": "^12",
    "zustand": "^5",
    "sonner": "^2",
    "react-hotkeys-hook": "^4",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "tailwind-merge": "^3"
  },
  "devDependencies": {
    "typescript": "~5.9",
    "vite": "^7",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4",
    "vitest": "^3",
    "@testing-library/react": "^16",
    "@testing-library/jest-dom": "^6",
    "jsdom": "^26"
  }
}
```

Note: shadcn components are copied into the project (not a dependency). They use Radix primitives which are installed per-component.
