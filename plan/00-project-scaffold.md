# Phase 00 — Project Scaffold

## Goal
Set up a fresh React + TypeScript + Vite project alongside the existing code. Install all dependencies. Configure Tailwind with our Rams design tokens. Initialize shadcn. Verify the app renders a styled placeholder.

## Why First
Everything depends on this. No code can be written until the build toolchain works.

---

## Steps

### 1. Install React and core dependencies

```bash
npm install react@^19 react-dom@^19 @xyflow/react@^12 zustand@^5 sonner@^2 react-hotkeys-hook@^4 clsx@^2 tailwind-merge@^3 class-variance-authority@^0.7
npm install -D @vitejs/plugin-react@^4 tailwindcss@^4 @tailwindcss/vite@^4
```

### 2. Update vite.config.ts

Create `vite.config.ts` at project root:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
```

### 3. Update tsconfig.json

Replace the existing `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

Key changes from current: added `jsx: "react-jsx"`, `paths` alias, kept `verbatimModuleSyntax` and `erasableSyntaxOnly`.

### 4. Create new index.html

Replace the existing `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SYNTHESIS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 5. Rename old source files

Move old files out of the way so they don't conflict but remain available for reference:

```bash
mv src/main.ts src/_old_main.ts
mv src/style.css src/_old_style.css
mv src/ui/Workspace.ts src/ui/_old_Workspace.ts
mv src/ui/Knob.ts src/ui/_old_Knob.ts
mv src/presets.ts src/_old_presets.ts
```

Keep `src/audio/` completely untouched — it's our audio layer and doesn't change.

### 6. Create Tailwind globals with Rams tokens

Create `src/styles/globals.css`:

```css
@import "tailwindcss";

/* === Dieter Rams Design Tokens === */

@theme {
  --color-bg: #EFEFEF;
  --color-panel: #FAFAFA;
  --color-text-main: #2A2A2A;
  --color-text-light: #5A5A5A;
  --color-text-muted: #7A7A7A;
  --color-border: rgba(0, 0, 0, 0.15);
  --color-border-light: rgba(0, 0, 0, 0.08);

  --color-accent-orange: #EA523F;
  --color-accent-green: #607C64;
  --color-accent-blue: #3A7CA5;
  --color-wire: #4A4A4A;

  --color-toolbar-bg: #f7f7f7;
  --color-toolbar-divider: rgba(0, 0, 0, 0.10);
  --color-chip-active: #e9ecef;

  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

  --radius-default: 6px;
  --radius-sm: 4px;

  --shadow-sm: 0 2px 5px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-knob: 0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.8);
}

/* === Base Resets === */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-bg);
  color: var(--color-text-main);
  overflow: hidden;
  user-select: none;
  height: 100vh;
}

#root {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* === shadcn overrides (Rams theme) === */
/* These will be populated when we add shadcn components */
```

### 7. Create the lib/utils.ts helper (required by shadcn)

Create `src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 8. Initialize shadcn

Create `components.json` at project root:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components/ui",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

Then install the first shadcn components we'll need soon:

```bash
npx shadcn@latest add button select sheet slider separator
```

### 9. Create entry point

Create `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './components/App'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### 10. Create placeholder App component

Create `src/components/App.tsx`:

```tsx
export function App() {
  return (
    <div className="flex flex-col h-screen bg-bg">
      {/* Header */}
      <header className="h-[76px] bg-panel border-b border-border-light shadow-sm flex items-center px-4 z-[100]">
        <h1 className="text-sm font-semibold tracking-[2px] text-text-main">
          SYNTHESIS
        </h1>
      </header>

      {/* Workspace placeholder */}
      <main className="flex-1 relative bg-bg">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-text-muted text-xs uppercase tracking-wide">
            Workspace — React migration in progress
          </p>
        </div>
      </main>

      {/* Palette placeholder */}
      <aside className="fixed right-0 top-[76px] bottom-0 w-[140px] bg-panel border-l border-border-light z-[50] flex flex-col gap-2 p-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[1px] text-text-muted mb-2">
          Modules
        </h2>
        {['Oscillator', 'Filter', 'ADSR', 'LFO', 'Keyboard', 'Delay', 'Distortion', 'Gain', 'Sequencer'].map(name => (
          <button
            key={name}
            className="text-[10px] uppercase tracking-wide px-2 py-1.5 bg-bg border border-border rounded-[4px] text-text-light hover:border-accent-orange hover:text-accent-orange transition-colors cursor-pointer"
          >
            + {name}
          </button>
        ))}
      </aside>
    </div>
  )
}
```

---

## Files Created/Modified

| Action | File |
|--------|------|
| Create | `vite.config.ts` |
| Modify | `tsconfig.json` |
| Replace | `index.html` |
| Rename | `src/main.ts` → `src/_old_main.ts` |
| Rename | `src/style.css` → `src/_old_style.css` |
| Rename | `src/ui/Workspace.ts` → `src/ui/_old_Workspace.ts` |
| Rename | `src/ui/Knob.ts` → `src/ui/_old_Knob.ts` |
| Rename | `src/presets.ts` → `src/_old_presets.ts` |
| Create | `src/styles/globals.css` |
| Create | `src/lib/utils.ts` |
| Create | `components.json` |
| Create | `src/main.tsx` |
| Create | `src/components/App.tsx` |

## Verify It Works

```bash
npm run dev
```

1. Opens in browser at localhost:5173
2. Shows "SYNTHESIS" header with Inter font, off-white background
3. Shows module palette on right side with orange hover accents
4. Shows "Workspace — React migration in progress" centered text
5. No console errors
6. `npm run build` succeeds without TypeScript errors

Visual check: the header background should be `#FAFAFA` (panel), the page background `#EFEFEF` (bg), text should be dark `#2A2A2A`, and hovering palette buttons should turn orange `#EA523F`.
