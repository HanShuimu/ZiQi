# UI Architecture Foundation Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ZiQi's renderer architecture safer to iterate by adding a runtime boundary, renderer type checking, narrower session ownership, strict UI primitive and token linting, a split spectrogram view, and clarified historical UI residue.

**Architecture:** Execute this as staged, behavior-preserving migrations. Each task creates or tightens one boundary, migrates current production code to the new rule, verifies with focused tests, then commits before the next task.

**Tech Stack:** Electron 37, React 19, TypeScript 5.8, Vite 7, Vitest, Testing Library, ESLint architecture rules, PowerShell on Windows.

---

## Source Spec

Primary design:

```text
docs/superpowers/specs/2026-06-10-ui-architecture-foundation-cleanup-design.md
```

## Execution Rules

- Do not redesign the main control zone into a console.
- Do not add user-facing busy or error UI.
- Do not change audio playback semantics.
- Keep visual behavior stable unless a task explicitly changes styling through tokens.
- Use focused commits after each task.
- Run the task's focused verification before committing.

## Target File Structure

Runtime boundary:

```text
src/app/runtime/
  RuntimeContext.tsx
  RuntimeProvider.tsx
  devRuntime.ts
  electronRuntime.ts
  index.ts
  types.ts
```

UI settings boundary:

```text
src/app/uiSettings/
  UiSettingsContext.tsx
  UiSettingsProvider.tsx
  index.ts
  useUiSettings.ts
```

UI primitives:

```text
src/ui/components/
  Button.tsx
  Field.tsx
  ListItem.tsx
  NumberField.tsx
  Panel.tsx
  PanelSection.tsx
  SegmentedControl.tsx
  SliderField.tsx
  Tabs.tsx
  Toggle.tsx
```

Spectrogram feature split:

```text
src/features/spectrogramViewer/
  PitchAxis.tsx
  PitchHeatmapCanvas.tsx
  SpectrogramHoverStatus.tsx
  SpectrogramOverlayLayer.tsx
  SpectrogramView.tsx
  WaveformStrip.tsx
  pitchEnergyAdapter.ts
  spectrogramModel.ts
  usePitchHover.ts
  useSpectrogramViewport.ts
```

Lint support:

```text
eslint.config.js
eslint.config.test.mjs
scripts/lint-style-tokens.mjs
```

Type checking:

```text
tsconfig.renderer.json
package.json
```

---

## Task 1: Add Renderer Runtime Boundary

**Files:**
- Create: `src/app/runtime/types.ts`
- Create: `src/app/runtime/electronRuntime.ts`
- Create: `src/app/runtime/devRuntime.ts`
- Create: `src/app/runtime/RuntimeContext.tsx`
- Create: `src/app/runtime/RuntimeProvider.tsx`
- Create: `src/app/runtime/index.ts`
- Create: `src/app/runtime/RuntimeProvider.test.tsx`
- Modify: `src/app/session/AppSessionProvider.tsx`
- Modify: `src/app/commands/projectCommandTypes.ts`
- Modify: `src/app/commands/importAudioCommand.ts`
- Modify: `src/app/commands/openProjectCommand.ts`
- Modify: `src/app/commands/saveProjectCommand.ts`
- Modify: `src/app/commands/skinCommands.ts`
- Modify: `src/app/menu/useMenuCommands.ts`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write runtime provider tests**

Add `src/app/runtime/RuntimeProvider.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_SETTINGS } from "../../core/userSettings/types";
import { RuntimeProvider } from "./RuntimeProvider";
import { useAppRuntime } from "./RuntimeContext";

function RuntimeProbe() {
  const runtime = useAppRuntime();

  async function handleReadSettings() {
    const settings = await runtime.getUserSettings();
    document.body.dataset.uiSkin = settings.uiSkin;
  }

  return (
    <button type="button" onClick={handleReadSettings}>
      {runtime.kind}
    </button>
  );
}

describe("RuntimeProvider", () => {
  it("uses the dev runtime when window.ziqiApp is absent", async () => {
    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: undefined
    });

    render(
      <RuntimeProvider>
        <RuntimeProbe />
      </RuntimeProvider>
    );

    expect(screen.getByRole("button", { name: "dev" })).toBeTruthy();
    screen.getByRole("button", { name: "dev" }).click();

    await waitFor(() => {
      expect(document.body.dataset.uiSkin).toBe(DEFAULT_USER_SETTINGS.uiSkin);
    });
  });

  it("uses the Electron runtime when window.ziqiApp exists", () => {
    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: {
        getUserSettings: vi.fn().mockResolvedValue(DEFAULT_USER_SETTINGS),
        updateUserSettings: vi.fn(),
        onMenuCommand: vi.fn(),
        selectAudioFile: vi.fn(),
        saveProject: vi.fn(),
        openProject: vi.fn(),
        activateOpenedProject: vi.fn(),
        getVersion: vi.fn(),
        log: vi.fn()
      }
    });

    render(
      <RuntimeProvider>
        <RuntimeProbe />
      </RuntimeProvider>
    );

    expect(screen.getByRole("button", { name: "electron" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run runtime provider test to verify it fails**

Run:

```powershell
npm test -- src/app/runtime/RuntimeProvider.test.tsx
```

Expected: FAIL because `RuntimeProvider` and `useAppRuntime` do not exist.

- [ ] **Step 3: Add runtime types**

Create `src/app/runtime/types.ts`:

```ts
import type {
  MenuCommand,
  OpenProjectResult,
  ProjectLocation,
  RendererLogEntry,
  SaveProjectRequest,
  SaveProjectResult
} from "../../types/global";
import type { UserSettings } from "../../core/userSettings/types";

export interface AudioFileSelection {
  audioData: ArrayBuffer;
  filePath: string;
}

export interface AppRuntime {
  kind: "electron" | "dev";
  getVersion(): Promise<string>;
  log(entry: RendererLogEntry): void;
  getUserSettings(): Promise<UserSettings>;
  updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings>;
  selectAudioFile(): Promise<AudioFileSelection | null>;
  saveProject(request: SaveProjectRequest): Promise<SaveProjectResult | null>;
  openProject(): Promise<OpenProjectResult | null>;
  activateOpenedProject(request: ProjectLocation): Promise<void>;
  onMenuCommand(callback: (command: MenuCommand) => void): () => void;
}
```

- [ ] **Step 4: Add Electron runtime**

Create `src/app/runtime/electronRuntime.ts`:

```ts
import type { AppRuntime } from "./types";

export function createElectronRuntime(ziqiApp: Window["ziqiApp"]): AppRuntime {
  return {
    kind: "electron",
    getVersion: () => ziqiApp.getVersion(),
    log: (entry) => ziqiApp.log(entry),
    getUserSettings: () => ziqiApp.getUserSettings(),
    updateUserSettings: (patch) => ziqiApp.updateUserSettings(patch),
    selectAudioFile: () => ziqiApp.selectAudioFile(),
    saveProject: (request) => ziqiApp.saveProject(request),
    openProject: () => ziqiApp.openProject(),
    activateOpenedProject: (request) => ziqiApp.activateOpenedProject(request),
    onMenuCommand: (callback) => ziqiApp.onMenuCommand(callback)
  };
}
```

- [ ] **Step 5: Add dev runtime**

Create `src/app/runtime/devRuntime.ts`:

```ts
import { DEFAULT_USER_SETTINGS } from "../../core/userSettings/types";
import type { AppRuntime } from "./types";

function rejectDevFileOperation(operation: string) {
  return Promise.reject(
    new Error(`${operation} is available only in the Electron runtime.`)
  );
}

export function createDevRuntime(): AppRuntime {
  let settings = DEFAULT_USER_SETTINGS;

  return {
    kind: "dev",
    getVersion: async () => "dev",
    log: () => {},
    getUserSettings: async () => settings,
    updateUserSettings: async (patch) => {
      settings = {
        ...settings,
        ...patch
      };
      return settings;
    },
    selectAudioFile: () => rejectDevFileOperation("Audio import"),
    saveProject: () => rejectDevFileOperation("Project save"),
    openProject: () => rejectDevFileOperation("Project open"),
    activateOpenedProject: () => rejectDevFileOperation("Project activation"),
    onMenuCommand: () => () => {}
  };
}
```

- [ ] **Step 6: Add runtime context and provider**

Create `src/app/runtime/RuntimeContext.tsx`:

```tsx
import { createContext, useContext } from "react";
import type { AppRuntime } from "./types";

export const RuntimeContext = createContext<AppRuntime | null>(null);

export function useAppRuntime() {
  const runtime = useContext(RuntimeContext);

  if (!runtime) {
    throw new Error("useAppRuntime must be used inside RuntimeProvider.");
  }

  return runtime;
}
```

Create `src/app/runtime/RuntimeProvider.tsx`:

```tsx
import { useMemo, type ReactNode } from "react";
import { createDevRuntime } from "./devRuntime";
import { createElectronRuntime } from "./electronRuntime";
import { RuntimeContext } from "./RuntimeContext";

interface RuntimeProviderProps {
  children: ReactNode;
}

export function RuntimeProvider({ children }: RuntimeProviderProps) {
  const runtime = useMemo(() => {
    if (window.ziqiApp) {
      return createElectronRuntime(window.ziqiApp);
    }

    return createDevRuntime();
  }, []);

  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}
```

Create `src/app/runtime/index.ts`:

```ts
export { RuntimeProvider } from "./RuntimeProvider";
export { useAppRuntime } from "./RuntimeContext";
export type { AppRuntime, AudioFileSelection } from "./types";
```

- [ ] **Step 7: Thread runtime through project commands**

Modify `src/app/commands/projectCommandTypes.ts` to include runtime:

```ts
import type { AppRuntime } from "../runtime";

export interface ProjectCommandDependencies {
  runtime: AppRuntime;
  // keep all existing dependencies unchanged
}
```

In command files, replace direct `window.ziqiApp` calls:

```ts
await window.ziqiApp.selectAudioFile();
await window.ziqiApp.openProject();
await window.ziqiApp.activateOpenedProject(...);
await window.ziqiApp.saveProject(...);
await window.ziqiApp.updateUserSettings(...);
```

with:

```ts
await runtime.selectAudioFile();
await runtime.openProject();
await runtime.activateOpenedProject(...);
await runtime.saveProject(...);
await runtime.updateUserSettings(...);
```

- [ ] **Step 8: Use runtime in session provider and menu hook**

Modify `src/app/session/AppSessionProvider.tsx`:

```ts
import { useAppRuntime } from "../runtime";
```

Inside `AppSessionProvider`, read runtime once:

```ts
const runtime = useAppRuntime();
```

Use:

```ts
void runtime.getUserSettings().then((settings) => {
  if (isActive) {
    setUiSkin(settings.uiSkin);
  }
});
```

Pass `runtime` into `createProjectCommands(...)` and `createSkinCommands(...)`.

Modify `src/app/menu/useMenuCommands.ts` to accept runtime:

```ts
import type { AppRuntime } from "../runtime";

interface UseMenuCommandsOptions {
  runtime: AppRuntime;
  importAudio: () => Promise<void>;
  openProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  changeSkin: (nextSkin: SkinId) => Promise<void>;
}
```

Replace `window.ziqiApp.onMenuCommand` with `runtime.onMenuCommand`.

- [ ] **Step 9: Wrap App with RuntimeProvider**

Modify `src/App.tsx`:

```tsx
import { RuntimeProvider, useAppRuntime } from "./app/runtime";

export function App({ waveformService, spectrogramService, pitchEnergyService }: AppProps) {
  return (
    <RuntimeProvider>
      <AppSessionProvider
        waveformService={waveformService}
        spectrogramService={spectrogramService}
        pitchEnergyService={pitchEnergyService}
      >
        <AppContent />
      </AppSessionProvider>
    </RuntimeProvider>
  );
}

function AppContent() {
  const runtime = useAppRuntime();
  const session = useAppSession();
  // keep existing skinDefinition logic
  useMenuCommands({ runtime, ...session });
  // keep existing render logic
}
```

- [ ] **Step 10: Add browser-startup test**

In `src/App.test.tsx`, add:

```tsx
it("renders the empty workspace in browser development without an Electron preload API", async () => {
  Object.defineProperty(window, "ziqiApp", {
    configurable: true,
    value: undefined
  });

  renderApp({});

  expect(await screen.findByText("No project loaded")).toBeTruthy();
  expect(screen.getByText("Use the File menu to import audio or open an existing ZiQi project.")).toBeTruthy();
});
```

- [ ] **Step 11: Run focused tests**

Run:

```powershell
npm test -- src/app/runtime/RuntimeProvider.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 12: Run lint and build**

Run:

```powershell
npm run lint
npm run build
```

Expected: both commands exit `0`.

- [ ] **Step 13: Commit runtime boundary**

Run:

```powershell
git add -- src
git commit -m "Add renderer runtime boundary"
```

Expected: commit succeeds with runtime and direct `window.ziqiApp` call migration changes.

---

## Task 2: Add Renderer Typecheck

**Files:**
- Create: `tsconfig.renderer.json`
- Modify: `package.json`
- Modify: `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramView.test.tsx`

- [ ] **Step 1: Add renderer TypeScript config**

Create `tsconfig.renderer.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "references": []
}
```

- [ ] **Step 2: Add typecheck scripts**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "test": "vitest run --environment jsdom",
    "typecheck": "tsc -p tsconfig.renderer.json && tsc -p tsconfig.electron.json",
    "build": "npm run typecheck && vite build",
    "lint": "eslint .",
    "start": "electron dist-electron/main.js"
  }
}
```

- [ ] **Step 3: Run typecheck to collect current failures**

Run:

```powershell
npm run typecheck
```

Expected: FAIL with known renderer type errors, including stale `SpectrogramView` test props and possible `SpectrogramTimelineNavigator` strict null checks.

- [ ] **Step 4: Fix `SpectrogramTimelineNavigator` undefined narrowing**

Modify `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx`.

Replace:

```ts
const shouldShowHoverTime =
  Number.isFinite(hoverTimeMs) && isTimeInsideViewport(hoverTimeMs, viewport);
const hoverTimePercent = shouldShowHoverTime ? timeToTrackPercent(hoverTimeMs, durationMs) : 0;
```

with:

```ts
const safeHoverTimeMs =
  typeof hoverTimeMs === "number" && Number.isFinite(hoverTimeMs)
    ? hoverTimeMs
    : null;
const shouldShowHoverTime =
  safeHoverTimeMs !== null && isTimeInsideViewport(safeHoverTimeMs, viewport);
const hoverTimePercent = shouldShowHoverTime
  ? timeToTrackPercent(safeHoverTimeMs, durationMs)
  : 0;
```

Replace hover label usage:

```tsx
<span>{formatPreciseTimeLabel(hoverTimeMs)}</span>
```

with:

```tsx
<span>{formatPreciseTimeLabel(safeHoverTimeMs ?? 0)}</span>
```

Replace:

```ts
const track = thumb.parentElement;
if (!(track instanceof HTMLElement)) {
  return;
}
```

with:

```ts
const track = thumb.parentElement;
if (!(track instanceof HTMLElement)) {
  return;
}
```

Then ensure all uses of `track` remain inside the guarded scope.

- [ ] **Step 5: Remove stale props from `SpectrogramView.test.tsx`**

In `src/features/spectrogramViewer/SpectrogramView.test.tsx`, remove these props from every `<SpectrogramView />` usage:

```tsx
isPlaying={false}
playbackRate={1}
onPlaybackToggle={vi.fn()}
onLoopClear={vi.fn()}
onLoopEndSet={vi.fn()}
onLoopStartSet={vi.fn()}
onPlaybackRateChange={vi.fn()}
```

Keep required props:

```tsx
currentTimeMs={...}
durationMs={...}
loopRange={...}
onSeek={vi.fn()}
onViewportChange={vi.fn()}
spectrogramOverview={...}
waveformOverview={...}
```

- [ ] **Step 6: Run typecheck again**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npm test -- src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run build**

Run:

```powershell
npm run build
```

Expected: PASS and build output includes `vite build`.

- [ ] **Step 9: Commit typecheck**

Run:

```powershell
git add -- package.json tsconfig.renderer.json src
git commit -m "Add renderer typecheck"
```

Expected: commit succeeds with typecheck configuration and type fixes.

---

## Task 3: Add UI Primitives

**Files:**
- Modify: `src/ui/types.ts`
- Modify: `src/ui/index.ts`
- Create: `src/ui/components/Field.tsx`
- Create: `src/ui/components/NumberField.tsx`
- Create: `src/ui/components/SliderField.tsx`
- Create: `src/ui/components/SegmentedControl.tsx`
- Create: `src/ui/components/PanelSection.tsx`
- Create: `src/ui/components/Toggle.tsx`
- Modify: `src/styles.css`
- Test: `src/ui/provider/UiProvider.test.tsx`

- [ ] **Step 1: Add primitive rendering tests**

Extend `src/ui/provider/UiProvider.test.tsx` with:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Field,
  NumberField,
  PanelSection,
  SegmentedControl,
  SliderField,
  Toggle,
  UiProvider
} from "../../ui";
import { getSkinDefinition } from "../../skins/registry";

function renderWithDefaultSkin(ui: React.ReactElement) {
  const skin = getSkinDefinition("default");
  return render(
    <UiProvider skinId={skin.id} adapter={skin.adapter}>
      {ui}
    </UiProvider>
  );
}

it("renders field primitives with accessible labels", () => {
  const onNumberChange = vi.fn();
  const onSliderChange = vi.fn();

  renderWithDefaultSkin(
    <>
      <Field label="Plain field">Value</Field>
      <NumberField label="BPM" value={120} min={1} step={1} onChange={onNumberChange} />
      <SliderField label="Gain" value={0} min={-48} max={24} step={1} onChange={onSliderChange} />
    </>
  );

  fireEvent.change(screen.getByLabelText("BPM"), { target: { value: "121" } });
  fireEvent.change(screen.getByLabelText("Gain"), { target: { value: "6" } });

  expect(screen.getByText("Plain field")).toBeTruthy();
  expect(onNumberChange).toHaveBeenCalledWith(121);
  expect(onSliderChange).toHaveBeenCalledWith(6);
});

it("renders segmented controls, toggles, and panel sections", () => {
  const onRateChange = vi.fn();
  const onToggleChange = vi.fn();

  renderWithDefaultSkin(
    <PanelSection label="Playback" title="Controls">
      <SegmentedControl
        ariaLabel="Speed"
        options={[
          { label: "0.5x", value: 0.5 },
          { label: "1x", value: 1 }
        ]}
        value={1}
        onChange={onRateChange}
      />
      <Toggle label="Grid" checked={false} onChange={onToggleChange} />
    </PanelSection>
  );

  fireEvent.click(screen.getByRole("button", { name: "0.5x" }));
  fireEvent.click(screen.getByLabelText("Grid"));

  expect(screen.getByText("Controls")).toBeTruthy();
  expect(onRateChange).toHaveBeenCalledWith(0.5);
  expect(onToggleChange).toHaveBeenCalledWith(true);
});
```

- [ ] **Step 2: Run primitive tests to verify they fail**

Run:

```powershell
npm test -- src/ui/provider/UiProvider.test.tsx
```

Expected: FAIL because the new primitives do not exist.

- [ ] **Step 3: Add field primitive**

Create `src/ui/components/Field.tsx`:

```tsx
import type { ReactNode } from "react";

export interface FieldProps {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, className, children }: FieldProps) {
  return (
    <label className={["ui-field", className].filter(Boolean).join(" ")}>
      <span className="ui-field-label">{label}</span>
      {children}
      {hint ? <span className="ui-field-hint">{hint}</span> : null}
    </label>
  );
}
```

- [ ] **Step 4: Add number field primitive**

Create `src/ui/components/NumberField.tsx`:

```tsx
import { Field } from "./Field";

export interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  inputClassName?: string;
  onChange(value: number): void;
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  className,
  inputClassName,
  onChange
}: NumberFieldProps) {
  return (
    <Field label={label} className={className}>
      <input
        aria-label={label}
        className={["ui-number-field-input", inputClassName].filter(Boolean).join(" ")}
        max={max}
        min={min}
        onChange={(event) => {
          const parsed = Number(event.currentTarget.value);
          if (Number.isFinite(parsed)) {
            onChange(parsed);
          }
        }}
        step={step}
        type="number"
        value={value}
      />
    </Field>
  );
}
```

- [ ] **Step 5: Add slider field primitive**

Create `src/ui/components/SliderField.tsx`:

```tsx
import { Field } from "./Field";

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  className?: string;
  onChange(value: number): void;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  className,
  onChange
}: SliderFieldProps) {
  return (
    <Field label={label} className={className}>
      <input
        aria-label={label}
        className="ui-slider-field-input"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        step={step}
        type="range"
        value={value}
      />
    </Field>
  );
}
```

- [ ] **Step 6: Add segmented control primitive**

Create `src/ui/components/SegmentedControl.tsx`:

```tsx
import { Button } from "./Button";

export interface SegmentedControlOption<TValue extends string | number> {
  label: string;
  value: TValue;
}

export interface SegmentedControlProps<TValue extends string | number> {
  ariaLabel: string;
  value: TValue;
  options: Array<SegmentedControlOption<TValue>>;
  className?: string;
  onChange(value: TValue): void;
}

export function SegmentedControl<TValue extends string | number>({
  ariaLabel,
  value,
  options,
  className,
  onChange
}: SegmentedControlProps<TValue>) {
  return (
    <div
      aria-label={ariaLabel}
      className={["ui-segmented-control", className].filter(Boolean).join(" ")}
      role="group"
    >
      {options.map((option) => (
        <Button
          activating={option.value === value}
          aria-pressed={option.value === value}
          className="ui-segmented-control-button"
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Add panel section primitive**

Create `src/ui/components/PanelSection.tsx`:

```tsx
import type { ReactNode } from "react";

export interface PanelSectionProps {
  label?: string;
  title?: string;
  className?: string;
  children: ReactNode;
}

export function PanelSection({ label, title, className, children }: PanelSectionProps) {
  return (
    <section className={["ui-panel-section", className].filter(Boolean).join(" ")}>
      {label ? <div className="section-label">{label}</div> : null}
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
```

- [ ] **Step 8: Add toggle primitive**

Create `src/ui/components/Toggle.tsx`:

```tsx
export interface ToggleProps {
  label: string;
  checked: boolean;
  className?: string;
  onChange(checked: boolean): void;
}

export function Toggle({ label, checked, className, onChange }: ToggleProps) {
  return (
    <label className={["ui-toggle", className].filter(Boolean).join(" ")}>
      <input
        aria-label={label}
        checked={checked}
        className="ui-toggle-input"
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span className="ui-toggle-label">{label}</span>
    </label>
  );
}
```

- [ ] **Step 9: Export primitives**

Modify `src/ui/index.ts`:

```ts
export { Field } from "./components/Field";
export { NumberField } from "./components/NumberField";
export { PanelSection } from "./components/PanelSection";
export { SegmentedControl } from "./components/SegmentedControl";
export { SliderField } from "./components/SliderField";
export { Toggle } from "./components/Toggle";
```

- [ ] **Step 10: Add primitive CSS**

Append to the UI-control area of `src/styles.css`:

```css
.ui-field {
  display: grid;
  font-size: 0.72rem;
  gap: 0.2rem;
}

.ui-field-label,
.ui-toggle-label {
  color: var(--skin-text-muted);
}

.ui-number-field-input {
  box-sizing: border-box;
  width: 5.5rem;
}

.ui-slider-field-input {
  width: 100%;
}

.ui-segmented-control {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ui-segmented-control-button[aria-pressed="true"] {
  border-color: var(--skin-control-selected-bg);
  background: var(--skin-control-selected-bg);
  color: var(--skin-control-selected-text);
}

.ui-panel-section {
  display: grid;
  gap: 0.6rem;
}

.ui-toggle {
  align-items: center;
  display: inline-flex;
  gap: 0.45rem;
}
```

If `--skin-control-selected-bg` and `--skin-control-selected-text` are missing, add them in Task 5 before final lint.

- [ ] **Step 11: Run primitive tests**

Run:

```powershell
npm test -- src/ui/provider/UiProvider.test.tsx
```

Expected: PASS.

- [ ] **Step 12: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 13: Commit UI primitives**

Run:

```powershell
git add -- src/ui src/styles.css
git commit -m "Add UI field primitives"
```

Expected: commit succeeds with only primitive and style additions.

---

## Task 4: Migrate WorkspaceControlZone To Primitives

**Files:**
- Modify: `src/features/spectrogramViewer/WorkspaceControlZone.tsx`
- Modify: `src/components/WorkbenchShell.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Run current control behavior tests as a baseline**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: PASS. This task is a behavior-preserving migration; Task 5 adds the source-level lint rule that proves business components no longer write raw controls.

- [ ] **Step 2: Replace playback rate buttons with `SegmentedControl`**

Modify imports in `WorkspaceControlZone.tsx`:

```ts
import { Button, NumberField, SegmentedControl, SliderField } from "../../ui";
```

Replace the playback rate group:

```tsx
<div className="playback-rate-controls">
  {PLAYBACK_RATE_OPTIONS.map((rate) => (
    <button
      aria-pressed={playbackRate === rate}
      className="playback-rate-button"
      key={rate}
      onClick={() => onPlaybackRateChange(rate)}
    >
      {rate}x
    </button>
  ))}
</div>
```

with:

```tsx
<SegmentedControl
  ariaLabel="Playback speed"
  className="playback-rate-controls"
  onChange={(rate) => onPlaybackRateChange(rate)}
  options={PLAYBACK_RATE_OPTIONS.map((rate) => ({
    label: `${rate}x`,
    value: rate
  }))}
  value={playbackRate}
/>
```

- [ ] **Step 3: Replace bar grid numeric inputs**

Replace the Beats field with:

```tsx
<NumberField
  className="bar-grid-number-field"
  label="Beats per bar"
  min={1}
  onChange={(value) =>
    onBarGridChange({
      beatsPerBar: parsePositiveInteger(String(value), beatsPerBar)
    })
  }
  step={1}
  value={beatsPerBar}
/>
```

Replace the BPM input with a `NumberField` inside the existing stepper:

```tsx
<div className="bar-grid-number-field">
  <span>BPM</span>
  <span className="bpm-stepper">
    <Button
      aria-label="Decrease BPM"
      className="bpm-stepper-button"
      onClick={() => onBarGridChange({ bpm: Math.max(1, Math.round(bpm) - 1) })}
    >
      -
    </Button>
    <NumberField
      inputClassName="bpm-stepper-input"
      label="BPM"
      min={1}
      onChange={(value) =>
        onBarGridChange({
          bpm: parsePositiveInteger(String(value), bpm)
        })
      }
      step={1}
      value={bpm}
    />
    <Button
      aria-label="Increase BPM"
      className="bpm-stepper-button"
      onClick={() => onBarGridChange({ bpm: Math.max(1, Math.round(bpm) + 1) })}
    >
      +
    </Button>
  </span>
</div>
```

Replace the offset field with:

```tsx
<NumberField
  className="bar-grid-number-field"
  label="Beat offset milliseconds"
  onChange={(value) =>
    onBarGridChange({
      beatOffsetMs: parseInteger(String(value), beatOffsetMs)
    })
  }
  step={1}
  value={beatOffsetMs}
/>
```

- [ ] **Step 4: Replace loop raw buttons**

Replace:

```tsx
<button onClick={() => onLoopStartSet(currentTimeMs)}>Set Loop Start</button>
<button onClick={() => onLoopEndSet(currentTimeMs)}>Set Loop End</button>
{loopRange ? <button onClick={onLoopClear}>Clear Loop</button> : null}
```

with:

```tsx
<Button onClick={() => onLoopStartSet(currentTimeMs)}>Set Loop Start</Button>
<Button onClick={() => onLoopEndSet(currentTimeMs)}>Set Loop End</Button>
{loopRange ? <Button onClick={onLoopClear}>Clear Loop</Button> : null}
```

- [ ] **Step 5: Replace heatmap display range inputs**

For each heatmap display slider, replace the `label + input` pair with `SliderField`.

Example for Gain:

```tsx
<SliderField
  label="Gain"
  max={24}
  min={-48}
  onChange={(value) =>
    onPitchHeatmapDisplayChange({
      ...pitchHeatmapDisplay,
      gainDb: value
    })
  }
  step={1}
  value={pitchHeatmapDisplay.gainDb}
/>
```

Use the same pattern for:

```text
Contrast -> pitchHeatmapDisplay.contrast, min 0.6, max 1.8, step 0.1
Range -> pitchHeatmapDisplay.dynamicRangeDb, min 80, max 150, step 1
Floor -> pitchHeatmapDisplay.noiseFloorDb, min -80, max 0, step 1
Intensity -> pitchHeatmapDisplay.colorIntensity, min 0.5, max 1.4, step 0.1
```

Replace the Reset raw button:

```tsx
<Button onClick={() => onPitchHeatmapDisplayChange(DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS)}>
  Reset
</Button>
```

- [ ] **Step 6: Adjust CSS selectors**

Modify `src/styles.css`:

```css
.bpm-stepper .ui-field {
  gap: 0;
}

.bpm-stepper .ui-field-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.bpm-stepper-button {
  min-width: 2rem;
  padding-inline: 0.45rem;
}

.bpm-stepper-input {
  width: 4.75rem;
}
```

Remove obsolete selectors that only targeted old raw controls when they no longer match:

```css
.playback-rate-button[aria-pressed="true"]
.heatmap-display-controls input[type="range"]
.bpm-stepper button
.bpm-stepper input
```

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit control migration**

Run:

```powershell
git add -- src/features/spectrogramViewer/WorkspaceControlZone.tsx src/components/WorkbenchShell.test.tsx src/styles.css
git commit -m "Migrate workspace controls to UI primitives"
```

Expected: commit succeeds with no raw controls left in `WorkspaceControlZone.tsx`.

---

## Task 5: Enforce Raw Control Lint

**Files:**
- Modify: `eslint.config.js`
- Modify: `eslint.config.test.mjs`

- [ ] **Step 1: Add lint tests for raw controls**

Extend `eslint.config.test.mjs` with tests that create synthetic file names and source snippets for the architecture plugin.

Add cases:

```js
{
  filename: "src/features/example/BadControl.tsx",
  code: "export function BadControl() { return <button>Click</button>; }",
  errors: [{ messageId: "rawControl" }]
}
```

```js
{
  filename: "src/features/example/BadField.tsx",
  code: "export function BadField() { return <input aria-label=\"Name\" />; }",
  errors: [{ messageId: "rawControl" }]
}
```

```js
{
  filename: "src/ui/components/Button.tsx",
  code: "export function Button() { return <button>Click</button>; }",
  errors: []
}
```

```js
{
  filename: "src/skins/default/adapter.tsx",
  code: "export function SkinButton() { return <button>Click</button>; }",
  errors: []
}
```

- [ ] **Step 2: Run lint config tests to verify they fail**

Run:

```powershell
npm test -- eslint.config.test.mjs
```

Expected: FAIL because `rawControl` rule does not exist.

- [ ] **Step 3: Add raw control rule**

Modify `eslint.config.js` inside `architecturePlugin.rules`:

```js
"no-raw-business-controls": {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent business UI from rendering raw form controls."
    },
    messages: {
      rawControl:
        "Business UI must use src/ui primitives instead of raw <{{name}}> controls."
    },
    schema: []
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const importer = toProjectPath(context.filename);
        const elementName = getJsxElementName(node.name);

        if (
          !isBusinessUiFile(importer) ||
          isTestFile(importer) ||
          !["button", "input", "select", "textarea"].includes(elementName)
        ) {
          return;
        }

        context.report({
          node,
          messageId: "rawControl",
          data: { name: elementName }
        });
      }
    };
  }
}
```

Add helper functions near existing helpers:

```js
function getJsxElementName(name) {
  if (!name) {
    return "";
  }

  if (name.type === "JSXIdentifier") {
    return name.name;
  }

  return "";
}

function isBusinessUiFile(projectPath) {
  if (!projectPath) {
    return false;
  }

  if (projectPath.startsWith("src/ui/") || projectPath.startsWith("src/skins/")) {
    return false;
  }

  return (
    projectPath === "src/App.tsx" ||
    projectPath.startsWith("src/app/") ||
    projectPath.startsWith("src/components/") ||
    projectPath.startsWith("src/features/") ||
    projectPath.startsWith("src/workspaces/")
  );
}
```

Enable the rule in the `src/**/*.{ts,tsx}` config:

```js
"architecture/no-raw-business-controls": "error"
```

- [ ] **Step 4: Run lint config tests**

Run:

```powershell
npm test -- eslint.config.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run full lint and clear remaining violations**

Run:

```powershell
npm run lint
```

Expected: FAIL if any business raw controls remain.

For each violation, migrate it to a `src/ui` primitive. Do not add a broad disable comment. After each migration, rerun:

```powershell
npm run lint
```

Expected final result: PASS.

- [ ] **Step 6: Run focused UI tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx src/ui/provider/UiProvider.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit raw control lint**

Run:

```powershell
git add -- eslint.config.js eslint.config.test.mjs src
git commit -m "Enforce UI primitives for business controls"
```

Expected: commit succeeds with lint rule and any final primitive migrations.

---

## Task 6: Tokenize Fixed UI Styling And Add Style Lint

**Files:**
- Modify: `src/skins/default/tokens.css`
- Modify: `src/skins/animalIsland/tokens.css`
- Modify: `src/styles.css`
- Create: `scripts/lint-style-tokens.mjs`
- Modify: `package.json`
- Test: `src/skins/registry.test.ts`

- [ ] **Step 1: Add token presence tests**

Extend `src/skins/registry.test.ts` with filesystem checks:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const requiredTokens = [
  "--skin-focus-ring",
  "--skin-danger",
  "--skin-control-selected-bg",
  "--skin-control-selected-text",
  "--analysis-playhead",
  "--analysis-hover",
  "--analysis-time-grid",
  "--analysis-bar-grid",
  "--analysis-waveform-start",
  "--analysis-waveform-end",
  "--analysis-spectrogram-bg",
  "--analysis-axis-bg",
  "--analysis-axis-white-key",
  "--analysis-axis-black-key"
];

describe("skin token coverage", () => {
  for (const tokenFile of [
    "src/skins/default/tokens.css",
    "src/skins/animalIsland/tokens.css"
  ]) {
    it(`${tokenFile} defines required UI and analysis tokens`, () => {
      const css = readFileSync(tokenFile, "utf8");
      for (const token of requiredTokens) {
        expect(css).toContain(token);
      }
    });
  }
});
```

- [ ] **Step 2: Run token test to verify it fails**

Run:

```powershell
npm test -- src/skins/registry.test.ts
```

Expected: FAIL because the new tokens are not all defined.

- [ ] **Step 3: Add tokens to default skin**

Modify `src/skins/default/tokens.css`:

```css
  --skin-focus-ring: #38bdf8;
  --skin-danger: #a23b2a;
  --skin-control-selected-bg: #111827;
  --skin-control-selected-text: #ffffff;
  --analysis-playhead: #38bdf8;
  --analysis-playhead-strong: #0ea5e9;
  --analysis-hover: #38bdf8;
  --analysis-time-grid: rgba(255, 255, 255, 0.16);
  --analysis-bar-grid: rgba(255, 255, 255, 0.68);
  --analysis-waveform-start: #f4b36e;
  --analysis-waveform-end: #b96a30;
  --analysis-spectrogram-bg: #000000;
  --analysis-axis-border: #211d1a;
  --analysis-axis-bg: #f8f3eb;
  --analysis-axis-white-key: #fbf8f1;
  --analysis-axis-black-key: #191512;
  --analysis-navigator-track: #d8c8b3;
  --analysis-navigator-surface: #fff7ef;
```

- [ ] **Step 4: Add tokens to Animal Island skin**

Modify `src/skins/animalIsland/tokens.css` with equivalent tokens:

```css
  --skin-focus-ring: #0ec4b6;
  --skin-danger: #a23b2a;
  --skin-control-selected-bg: #3d7d3b;
  --skin-control-selected-text: #ffffff;
  --analysis-playhead: #38bdf8;
  --analysis-playhead-strong: #0ea5e9;
  --analysis-hover: #38bdf8;
  --analysis-time-grid: rgba(255, 255, 255, 0.16);
  --analysis-bar-grid: rgba(255, 255, 255, 0.68);
  --analysis-waveform-start: #f4b36e;
  --analysis-waveform-end: #b96a30;
  --analysis-spectrogram-bg: #000000;
  --analysis-axis-border: #211d1a;
  --analysis-axis-bg: #f8f3eb;
  --analysis-axis-white-key: #fbf8f1;
  --analysis-axis-black-key: #191512;
  --analysis-navigator-track: #d8c8b3;
  --analysis-navigator-surface: #fff7ef;
```

- [ ] **Step 5: Replace hard-coded UI colors in styles**

Modify `src/styles.css` so fixed UI colors use tokens.

Examples:

```css
.error-copy {
  color: var(--skin-danger);
}

.waveform-point {
  background: linear-gradient(
    180deg,
    var(--analysis-waveform-start),
    var(--analysis-waveform-end)
  );
}

.spectrogram-cursor {
  background: var(--analysis-playhead);
}

.spectrogram-canvas-frame {
  border: 1px solid var(--analysis-axis-border);
  background: var(--analysis-spectrogram-bg);
}

.spectrogram-time-grid-line {
  background: var(--analysis-time-grid);
}

.spectrogram-bar-grid-line {
  background: var(--analysis-bar-grid);
}
```

Preserve existing visual meaning while moving values to tokens.

- [ ] **Step 6: Add style token lint script**

Create `scripts/lint-style-tokens.mjs`:

```js
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const allowedFiles = new Set([
  normalize("src/skins/default/tokens.css"),
  normalize("src/skins/animalIsland/tokens.css")
]);

const colorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
const cssFiles = collectCssFiles(path.join(root, "src"));
const violations = [];

for (const filePath of cssFiles) {
  const projectPath = normalize(path.relative(root, filePath));
  if (allowedFiles.has(projectPath)) {
    continue;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (colorPattern.test(line)) {
      violations.push(`${projectPath}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error("Hard-coded CSS colors must live in skin tokens:");
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}

function collectCssFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectCssFiles(entryPath);
    }
    return entry.name.endsWith(".css") ? [entryPath] : [];
  });
}

function normalize(value) {
  return value.split(path.sep).join("/");
}
```

- [ ] **Step 7: Wire style lint into npm lint**

Modify `package.json`:

```json
{
  "scripts": {
    "lint": "eslint . && node scripts/lint-style-tokens.mjs"
  }
}
```

- [ ] **Step 8: Run style lint and clear all violations**

Run:

```powershell
npm run lint
```

Expected: FAIL until hard-coded colors outside allowed token files are removed. Move every reported app chrome/control/status/fixed analysis UI color to tokens. Rerun until PASS.

- [ ] **Step 9: Run visual behavior tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx src/features/spectrogramViewer/SpectrogramView.test.tsx src/skins/registry.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit token lint**

Run:

```powershell
git add -- package.json scripts src
git commit -m "Enforce tokenized UI styling"
```

Expected: commit succeeds with token and style lint changes.

---

## Task 7: Extract Spectrogram Model Helpers

**Files:**
- Create: `src/features/spectrogramViewer/spectrogramModel.ts`
- Create: `src/features/spectrogramViewer/spectrogramModel.test.ts`
- Create: `src/features/spectrogramViewer/pitchEnergyAdapter.ts`
- Create: `src/features/spectrogramViewer/pitchEnergyAdapter.test.ts`
- Modify: `src/features/spectrogramViewer/SpectrogramView.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramView.test.tsx`

- [ ] **Step 1: Add model helper tests**

Create `src/features/spectrogramViewer/spectrogramModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createBarGridLines,
  createTimeGridLines,
  getRenderedWaveformPoints
} from "./spectrogramModel";

describe("spectrogramModel", () => {
  it("creates time grid lines for a ten second viewport", () => {
    expect(createTimeGridLines({ startMs: 0, durationMs: 10_000 })).toEqual([50]);
  });

  it("creates bar grid lines from bpm, beats, and offset", () => {
    expect(
      createBarGridLines(
        { startMs: 0, durationMs: 10_000 },
        { beatOffsetMs: 500, beatsPerBar: 4, bpm: 120 }
      )
    ).toEqual([
      { leftPercent: 5, timeMs: 500 },
      { leftPercent: 25, timeMs: 2500 },
      { leftPercent: 45, timeMs: 4500 },
      { leftPercent: 65, timeMs: 6500 },
      { leftPercent: 85, timeMs: 8500 }
    ]);
  });

  it("aggregates waveform points down to the requested maximum", () => {
    const points = Array.from({ length: 4 }, (_, index) => ({
      startMs: index * 10,
      endMs: index * 10 + 10,
      peak: index / 4
    }));

    expect(getRenderedWaveformPoints(points, 2)).toEqual([
      { startMs: 0, endMs: 20, peak: 0.25 },
      { startMs: 20, endMs: 40, peak: 0.75 }
    ]);
  });
});
```

Create `src/features/spectrogramViewer/pitchEnergyAdapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { convertSpectrogramToPitchEnergy } from "./pitchEnergyAdapter";

describe("convertSpectrogramToPitchEnergy", () => {
  it("returns null without a spectrogram overview", () => {
    expect(convertSpectrogramToPitchEnergy(null)).toBeNull();
  });

  it("maps spectrogram magnitudes into 88 pitch lanes", () => {
    const overview = convertSpectrogramToPitchEnergy({
      durationMs: 1000,
      framesPerSecond: 10,
      minFrequencyHz: 20,
      maxFrequencyHz: 2000,
      binsPerFrame: 2,
      frames: [
        {
          startMs: 0,
          endMs: 100,
          magnitudes: [0.25, 0.75]
        }
      ]
    });

    expect(overview?.notesPerFrame).toBe(88);
    expect(overview?.frames[0].energies).toHaveLength(88);
    expect(overview?.frames[0].energies[0]).toBe(0.25);
    expect(overview?.frames[0].energies[87]).toBe(0.75);
  });
});
```

- [ ] **Step 2: Run model tests to verify they fail**

Run:

```powershell
npm test -- src/features/spectrogramViewer/spectrogramModel.test.ts src/features/spectrogramViewer/pitchEnergyAdapter.test.ts
```

Expected: FAIL because helper files do not exist.

- [ ] **Step 3: Create spectrogram model helper**

Create `src/features/spectrogramViewer/spectrogramModel.ts` with the current implementations from `SpectrogramView.tsx`:

```ts
import type { WaveformOverview } from "../../core/audio/types";
import { timeToViewportPercent, type SpectrogramViewport } from "../../core/spectrogramViewport";

const DEFAULT_MAX_BAR_GRID_LINES = 1_000;
const DEFAULT_MAX_RENDERED_WAVEFORM_POINTS = 800;

type RenderedWaveformPoint = WaveformOverview["points"][number];

export function getRenderedWaveformPoints(
  points: RenderedWaveformPoint[],
  maxPointCount = DEFAULT_MAX_RENDERED_WAVEFORM_POINTS
): RenderedWaveformPoint[] {
  if (points.length <= maxPointCount) {
    return points;
  }

  return Array.from({ length: maxPointCount }, (_, index) => {
    const startIndex = Math.floor((index * points.length) / maxPointCount);
    const endIndex = Math.floor(((index + 1) * points.length) / maxPointCount);
    const group = points.slice(startIndex, Math.max(startIndex + 1, endIndex));

    return {
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      peak: Math.max(...group.map((point) => point.peak))
    };
  });
}

export function createTimeGridLines(viewport: SpectrogramViewport) {
  if (viewport.durationMs <= 0) {
    return [];
  }

  const durationSeconds = viewport.durationMs / 1000;
  const intervalSeconds = chooseGridIntervalSeconds(durationSeconds);
  const firstLineSeconds = Math.ceil(viewport.startMs / 1000 / intervalSeconds) * intervalSeconds;
  const endSeconds = (viewport.startMs + viewport.durationMs) / 1000;
  const positions: number[] = [];

  for (
    let lineSeconds = firstLineSeconds;
    lineSeconds < endSeconds;
    lineSeconds += intervalSeconds
  ) {
    const lineMs = lineSeconds * 1000;
    const position = timeToViewportPercent(lineMs, viewport);
    if (position > 0 && position < 100) {
      positions.push(Math.round(position * 10) / 10);
    }
  }

  return positions;
}

export function createBarGridLines(
  viewport: SpectrogramViewport,
  settings: { beatOffsetMs: number; beatsPerBar: number; bpm: number },
  maxLineCount = DEFAULT_MAX_BAR_GRID_LINES
) {
  const { beatOffsetMs, beatsPerBar, bpm } = settings;

  if (
    !Number.isFinite(viewport.startMs) ||
    !Number.isFinite(viewport.durationMs) ||
    !Number.isFinite(beatOffsetMs) ||
    !Number.isFinite(beatsPerBar) ||
    !Number.isFinite(bpm) ||
    viewport.durationMs <= 0 ||
    beatsPerBar <= 0 ||
    bpm <= 0
  ) {
    return [];
  }

  const barDurationMs = (60_000 / bpm) * beatsPerBar;
  if (!Number.isFinite(barDurationMs) || barDurationMs <= 0) {
    return [];
  }

  const viewportEndMs = viewport.startMs + viewport.durationMs;
  const firstBarIndex = Math.ceil((viewport.startMs - beatOffsetMs) / barDurationMs);
  const lines: Array<{ leftPercent: number; timeMs: number }> = [];

  for (
    let barStartMs = beatOffsetMs + firstBarIndex * barDurationMs;
    barStartMs < viewportEndMs && lines.length < maxLineCount;
    barStartMs += barDurationMs
  ) {
    if (barStartMs >= viewport.startMs) {
      lines.push({
        leftPercent: Math.round(timeToViewportPercent(barStartMs, viewport) * 1_000_000) / 1_000_000,
        timeMs: barStartMs
      });
    }
  }

  return lines;
}

function chooseGridIntervalSeconds(durationSeconds: number) {
  if (durationSeconds <= 30) {
    return 5;
  }

  if (durationSeconds <= 180) {
    return 15;
  }

  return 30;
}
```

- [ ] **Step 4: Create pitch energy adapter**

Create `src/features/spectrogramViewer/pitchEnergyAdapter.ts`:

```ts
import type { PitchEnergyOverview, SpectrogramOverview } from "../../core/audio/types";
import { PITCH_HEATMAP_NOTE_COUNT } from "../../core/audio/pitchHeatmap";

export function convertSpectrogramToPitchEnergy(
  spectrogramOverview: SpectrogramOverview | null | undefined
): PitchEnergyOverview | null {
  if (!spectrogramOverview) {
    return null;
  }

  return {
    durationMs: spectrogramOverview.durationMs,
    framesPerSecond: spectrogramOverview.framesPerSecond,
    minMidiNumber: 21,
    maxMidiNumber: 108,
    notesPerFrame: PITCH_HEATMAP_NOTE_COUNT,
    frames: spectrogramOverview.frames.map((frame) => ({
      startMs: frame.startMs,
      endMs: frame.endMs,
      energies: Array.from({ length: PITCH_HEATMAP_NOTE_COUNT }, (_, index) => {
        const sourceIndex = Math.floor((index * frame.magnitudes.length) / PITCH_HEATMAP_NOTE_COUNT);
        return frame.magnitudes[sourceIndex] ?? 0;
      })
    }))
  };
}
```

- [ ] **Step 5: Use helpers in SpectrogramView**

Modify `src/features/spectrogramViewer/SpectrogramView.tsx` imports:

```ts
import { convertSpectrogramToPitchEnergy } from "./pitchEnergyAdapter";
import {
  createBarGridLines,
  createTimeGridLines,
  getRenderedWaveformPoints
} from "./spectrogramModel";
```

Delete local implementations of:

```text
getRenderedWaveformPoints
createTimeGridLines
createBarGridLines
convertSpectrogramToPitchEnergy
chooseGridIntervalSeconds
```

Keep `getMaxEnergyForColumn` local until `PitchHeatmapCanvas` is extracted.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
npm test -- src/features/spectrogramViewer/spectrogramModel.test.ts src/features/spectrogramViewer/pitchEnergyAdapter.test.ts src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit model extraction**

Run:

```powershell
git add -- src/features/spectrogramViewer
git commit -m "Extract spectrogram model helpers"
```

Expected: commit succeeds with pure helper extraction only.

---

## Task 8: Extract Spectrogram Rendering Components And Hooks

**Files:**
- Create: `src/features/spectrogramViewer/useSpectrogramViewport.ts`
- Create: `src/features/spectrogramViewer/usePitchHover.ts`
- Create: `src/features/spectrogramViewer/SpectrogramHoverStatus.tsx`
- Create: `src/features/spectrogramViewer/WaveformStrip.tsx`
- Create: `src/features/spectrogramViewer/PitchAxis.tsx`
- Create: `src/features/spectrogramViewer/PitchHeatmapCanvas.tsx`
- Create: `src/features/spectrogramViewer/SpectrogramOverlayLayer.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramView.tsx`
- Test: `src/features/spectrogramViewer/SpectrogramView.test.tsx`

- [ ] **Step 1: Extract hover status component**

Create `src/features/spectrogramViewer/SpectrogramHoverStatus.tsx`:

```tsx
import { formatPreciseTimeWithMilliseconds } from "./pitchHover";
import type { HeatmapPointerState } from "./pitchHover";

interface SpectrogramHoverStatusProps {
  pointerState: HeatmapPointerState | null;
}

export function SpectrogramHoverStatus({ pointerState }: SpectrogramHoverStatusProps) {
  return (
    <div className="pitch-hover-status" data-testid="pitch-hover-status">
      {pointerState ? (
        <>
          <span className="pitch-hover-status-label">{pointerState.noteName}</span>
          <span>{pointerState.frequencyHz.toFixed(2)} Hz</span>
          <span>MIDI {pointerState.midiNumber}</span>
          <span className="pitch-hover-status-time">
            {formatPreciseTimeWithMilliseconds(pointerState.timeMs)}
          </span>
        </>
      ) : (
        <>
          <span className="pitch-hover-status-label">Pointer</span>
          <span>Hover over the heatmap</span>
        </>
      )}
    </div>
  );
}
```

Replace the inline hover status markup in `SpectrogramView.tsx` with:

```tsx
<SpectrogramHoverStatus pointerState={pointerState} />
```

- [ ] **Step 2: Extract waveform strip**

Create `src/features/spectrogramViewer/WaveformStrip.tsx`:

```tsx
import type { WaveformOverview } from "../../core/audio/types";

interface WaveformStripProps {
  isPlaybackVisible: boolean;
  progressPercent: number;
  renderedWaveformPoints: WaveformOverview["points"];
}

export function WaveformStrip({
  isPlaybackVisible,
  progressPercent,
  renderedWaveformPoints
}: WaveformStripProps) {
  return (
    <div className="waveform-overview spectrogram-waveform-row" aria-label="Audio waveform overview" role="img">
      <div className="waveform-grid waveform-grid-compact">
        {renderedWaveformPoints.map((point) => (
          <div
            key={`${point.startMs}-${point.endMs}`}
            className="waveform-point"
            data-testid="waveform-point"
            style={{ height: `${Math.max(2, point.peak * 100)}%` }}
          />
        ))}
      </div>
      {isPlaybackVisible ? (
        <div
          className="cursor-line cursor-line-vertical waveform-cursor"
          style={{ left: `${progressPercent}%` }}
        />
      ) : null}
    </div>
  );
}
```

Replace inline waveform markup in `SpectrogramView.tsx` with:

```tsx
<WaveformStrip
  isPlaybackVisible={isPlaybackVisible}
  progressPercent={progressPercent}
  renderedWaveformPoints={renderedWaveformPoints}
/>
```

- [ ] **Step 3: Extract pitch axis**

Create `src/features/spectrogramViewer/PitchAxis.tsx`:

```tsx
import { PIANO_KEYS } from "../../services/audio/spectrogram";
import { getPitchLaneCssProperties } from "./pitchHover";
import type { HeatmapPointerState } from "./pitchHover";

interface PitchAxisProps {
  pointerState: HeatmapPointerState | null;
}

export function PitchAxis({ pointerState }: PitchAxisProps) {
  return (
    <div className="piano-axis" aria-label="Piano pitch axis">
      {PIANO_KEYS.map((key, index) => {
        const laneStyle = getPitchLaneCssProperties(index);
        const bottomPercent = Number.parseFloat(laneStyle.bottom);
        const isActiveKey = pointerState?.midiNumber === key.midiNumber;

        return (
          <div
            key={key.midiNumber}
            className={
              `${key.isBlackKey ? "piano-key piano-key-black" : "piano-key piano-key-white"}${isActiveKey ? " piano-key-active" : ""}`
            }
            data-bottom-percent={bottomPercent}
            data-log-position={index / (PIANO_KEYS.length - 1)}
            data-testid="piano-key"
            style={laneStyle}
            title={key.name}
          />
        );
      })}
    </div>
  );
}
```

Replace inline piano axis markup with:

```tsx
<PitchAxis pointerState={pointerState} />
```

- [ ] **Step 4: Extract heatmap canvas**

Create `src/features/spectrogramViewer/PitchHeatmapCanvas.tsx` with the canvas ref and drawing effect currently in `SpectrogramView.tsx`.

Public props:

```ts
interface PitchHeatmapCanvasProps {
  hasPitchFrames: boolean;
  pitchHeatmapDisplay: PitchHeatmapDisplaySettings;
  visibleFrames: PitchEnergyOverview["frames"];
  onCanvasReady(canvas: HTMLCanvasElement | null): void;
}
```

The component should render:

```tsx
<canvas
  aria-label="Pitch heatmap"
  className="spectrogram-canvas"
  height={CANVAS_HEIGHT}
  ref={handleCanvasRef}
  role="img"
  width={CANVAS_WIDTH}
/>
```

Move `getMaxEnergyForColumn` into this file as a private function.

- [ ] **Step 5: Extract overlay layer**

Create `src/features/spectrogramViewer/SpectrogramOverlayLayer.tsx`:

```tsx
import { getPitchLaneCssProperties } from "./pitchHover";
import type { HeatmapPointerState } from "./pitchHover";

interface SpectrogramOverlayLayerProps {
  barGridLines: Array<{ leftPercent: number; timeMs: number }>;
  isPlaybackVisible: boolean;
  pointerState: HeatmapPointerState | null;
  progressPercent: number;
  timeGridLines: number[];
}

export function SpectrogramOverlayLayer({
  barGridLines,
  isPlaybackVisible,
  pointerState,
  progressPercent,
  timeGridLines
}: SpectrogramOverlayLayerProps) {
  return (
    <>
      {pointerState ? (
        <>
          <div
            className="spectrogram-hover-row"
            data-testid="pitch-hover-row"
            style={getPitchLaneCssProperties(pointerState.pitchIndex)}
          />
          <div
            className="spectrogram-hover-time-line"
            data-testid="pitch-hover-time-line"
            style={{ left: `${pointerState.xPercent}%` }}
          />
        </>
      ) : null}
      {timeGridLines.map((position) => (
        <div
          key={position}
          className="spectrogram-time-grid-line"
          data-testid="spectrogram-time-grid-line"
          style={{ left: `${position}%` }}
        />
      ))}
      {barGridLines.map((line) => (
        <div
          key={line.timeMs}
          className="spectrogram-bar-grid-line"
          data-testid="spectrogram-bar-grid-line"
          style={{ left: `${line.leftPercent}%` }}
        />
      ))}
      {isPlaybackVisible ? (
        <div
          className="cursor-line cursor-line-vertical spectrogram-cursor"
          data-testid="spectrogram-cursor"
          style={{ left: `${progressPercent}%` }}
        />
      ) : null}
    </>
  );
}
```

- [ ] **Step 6: Extract viewport hook**

Create `src/features/spectrogramViewer/useSpectrogramViewport.ts`:

```ts
import { useState } from "react";
import {
  createDefaultSpectrogramViewport,
  type SpectrogramViewport
} from "../../core/spectrogramViewport";

export function useSpectrogramViewport({
  controlledViewport,
  durationMs,
  onViewportChange,
  resetKey
}: {
  controlledViewport?: SpectrogramViewport;
  durationMs: number;
  onViewportChange: (viewport: SpectrogramViewport) => void;
  resetKey: string;
}) {
  const [internalViewportState, setInternalViewportState] = useState(() => ({
    resetKey,
    viewport: createDefaultSpectrogramViewport(durationMs)
  }));
  const internalViewport =
    internalViewportState.resetKey === resetKey
      ? internalViewportState.viewport
      : createDefaultSpectrogramViewport(durationMs);
  const activeViewport = controlledViewport ?? internalViewport;

  function updateViewport(nextViewport: SpectrogramViewport) {
    if (!controlledViewport) {
      setInternalViewportState({
        resetKey,
        viewport: nextViewport
      });
    }
    onViewportChange(nextViewport);
  }

  return {
    activeViewport,
    updateViewport
  };
}
```

- [ ] **Step 7: Extract pitch hover hook**

Create `src/features/spectrogramViewer/usePitchHover.ts`:

```ts
import { useEffect, useState, type PointerEvent } from "react";
import type { SpectrogramViewport } from "../../core/spectrogramViewport";
import {
  getPitchHoverStateFromPoint,
  type HeatmapPointerState
} from "./pitchHover";

export function usePitchHover({
  activeViewport,
  canvasRef,
  hasPitchFrames
}: {
  activeViewport: SpectrogramViewport;
  canvasRef: { current: HTMLCanvasElement | null };
  hasPitchFrames: boolean;
}) {
  const [pointerState, setPointerState] = useState<HeatmapPointerState | null>(null);

  useEffect(() => {
    setPointerState(null);
  }, [hasPitchFrames, activeViewport.startMs, activeViewport.durationMs]);

  function handleSpectrogramPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!hasPitchFrames) {
      return;
    }

    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    const bounds =
      canvasBounds && canvasBounds.width > 0 && canvasBounds.height > 0
        ? canvasBounds
        : event.currentTarget.getBoundingClientRect();

    setPointerState(
      getPitchHoverStateFromPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        bounds,
        viewport: activeViewport
      })
    );
  }

  function handleSpectrogramPointerLeave() {
    setPointerState(null);
  }

  return {
    handleSpectrogramPointerLeave,
    handleSpectrogramPointerMove,
    pointerState
  };
}
```

- [ ] **Step 8: Wire extracted parts into SpectrogramView**

Modify `SpectrogramView.tsx` so the return tree uses:

```tsx
<SpectrogramHoverStatus pointerState={pointerState} />
<WaveformStrip ... />
<PitchAxis pointerState={pointerState} />
<PitchHeatmapCanvas ... onCanvasReady={(canvas) => { canvasRef.current = canvas; }} />
<SpectrogramOverlayLayer ... />
```

Keep the same `.spectrogram-time-grid`, `.spectrogram-body`, `.spectrogram-canvas-frame`, and `.spectrogram-navigator-row` structure.

- [ ] **Step 9: Run focused tests**

Run:

```powershell
npm test -- src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Run lint and typecheck**

Run:

```powershell
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 11: Commit spectrogram split**

Run:

```powershell
git add -- src/features/spectrogramViewer
git commit -m "Split spectrogram view responsibilities"
```

Expected: commit succeeds with behavior-preserving component and hook extraction.

---

## Task 9: Split UI Settings From App Session

**Files:**
- Create: `src/app/uiSettings/UiSettingsContext.tsx`
- Create: `src/app/uiSettings/UiSettingsProvider.tsx`
- Create: `src/app/uiSettings/useUiSettings.ts`
- Create: `src/app/uiSettings/index.ts`
- Modify: `src/app/session/AppSessionProvider.tsx`
- Modify: `src/app/session/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add UI settings provider tests**

Create `src/app/uiSettings/UiSettingsProvider.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RuntimeContext } from "../runtime/RuntimeContext";
import type { AppRuntime } from "../runtime";
import { UiSettingsProvider } from "./UiSettingsProvider";
import { useUiSettings } from "./useUiSettings";

function createRuntime(): AppRuntime {
  return {
    kind: "dev",
    getVersion: vi.fn().mockResolvedValue("dev"),
    log: vi.fn(),
    getUserSettings: vi.fn().mockResolvedValue({ uiSkin: "default" }),
    updateUserSettings: vi.fn().mockResolvedValue({ uiSkin: "animal-island" }),
    selectAudioFile: vi.fn(),
    saveProject: vi.fn(),
    openProject: vi.fn(),
    activateOpenedProject: vi.fn(),
    onMenuCommand: vi.fn(() => () => {})
  };
}

function Probe() {
  const settings = useUiSettings();
  return (
    <>
      <div>{settings.uiSkin}</div>
      <button type="button" onClick={() => void settings.changeSkin("animal-island")}>
        Switch
      </button>
    </>
  );
}

describe("UiSettingsProvider", () => {
  it("loads and persists skin settings through runtime", async () => {
    const user = userEvent.setup();
    const runtime = createRuntime();

    render(
      <RuntimeContext.Provider value={runtime}>
        <UiSettingsProvider>
          <Probe />
        </UiSettingsProvider>
      </RuntimeContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("default")).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Switch" }));

    await waitFor(() => {
      expect(screen.getByText("animal-island")).toBeTruthy();
    });
    expect(runtime.updateUserSettings).toHaveBeenCalledWith({ uiSkin: "animal-island" });
  });
});
```

- [ ] **Step 2: Run UI settings test to verify it fails**

Run:

```powershell
npm test -- src/app/uiSettings/UiSettingsProvider.test.tsx
```

Expected: FAIL because provider files do not exist.

- [ ] **Step 3: Add UI settings context and hook**

Create `src/app/uiSettings/UiSettingsContext.tsx`:

```tsx
import { createContext } from "react";
import type { SkinId } from "../../core/userSettings/types";

export interface UiSettingsValue {
  uiSkin: SkinId;
  settingsError: string | null;
  changeSkin(nextSkin: SkinId): Promise<void>;
}

export const UiSettingsContext = createContext<UiSettingsValue | null>(null);
```

Create `src/app/uiSettings/useUiSettings.ts`:

```ts
import { useContext } from "react";
import { UiSettingsContext } from "./UiSettingsContext";

export function useUiSettings() {
  const value = useContext(UiSettingsContext);
  if (!value) {
    throw new Error("useUiSettings must be used inside UiSettingsProvider.");
  }

  return value;
}
```

- [ ] **Step 4: Add UI settings provider**

Create `src/app/uiSettings/UiSettingsProvider.tsx`:

```tsx
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { SkinId } from "../../core/userSettings/types";
import { DEFAULT_USER_SETTINGS } from "../../core/userSettings/types";
import { useAppRuntime } from "../runtime";
import { UiSettingsContext } from "./UiSettingsContext";

interface UiSettingsProviderProps {
  children: ReactNode;
}

export function UiSettingsProvider({ children }: UiSettingsProviderProps) {
  const runtime = useAppRuntime();
  const [uiSkin, setUiSkin] = useState<SkinId>(DEFAULT_USER_SETTINGS.uiSkin);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void runtime.getUserSettings().then((settings) => {
      if (isActive) {
        setUiSkin(settings.uiSkin);
      }
    });

    return () => {
      isActive = false;
    };
  }, [runtime]);

  const value = useMemo(
    () => ({
      uiSkin,
      settingsError,
      async changeSkin(nextSkin: SkinId) {
        setUiSkin(nextSkin);
        try {
          const savedSettings = await runtime.updateUserSettings({ uiSkin: nextSkin });
          setUiSkin(savedSettings.uiSkin);
          setSettingsError(null);
        } catch (error) {
          setSettingsError(error instanceof Error ? error.message : "Failed to update user settings.");
        }
      }
    }),
    [runtime, settingsError, uiSkin]
  );

  return (
    <UiSettingsContext.Provider value={value}>
      {children}
    </UiSettingsContext.Provider>
  );
}
```

Create `src/app/uiSettings/index.ts`:

```ts
export { UiSettingsProvider } from "./UiSettingsProvider";
export { useUiSettings } from "./useUiSettings";
export type { UiSettingsValue } from "./UiSettingsContext";
```

- [ ] **Step 5: Remove skin state from app session**

Modify `src/app/session/types.ts`:

Remove:

```ts
uiSkin: SkinId;
changeSkin: (nextSkin: SkinId) => Promise<void>;
```

Remove `SkinId` import if unused.

Modify `src/app/session/AppSessionProvider.tsx`:

- remove `uiSkin` state;
- remove `getUserSettings` effect;
- remove `createSkinCommands`;
- remove `changeSkin` from context value.

- [ ] **Step 6: Wrap App with UI settings provider**

Modify `src/App.tsx`:

```tsx
import { UiSettingsProvider, useUiSettings } from "./app/uiSettings";
```

Wrap:

```tsx
<RuntimeProvider>
  <UiSettingsProvider>
    <AppSessionProvider ...>
      <AppContent />
    </AppSessionProvider>
  </UiSettingsProvider>
</RuntimeProvider>
```

In `AppContent`, use:

```ts
const uiSettings = useUiSettings();
const skinDefinition = useMemo(
  () => getSkinDefinition(uiSettings.uiSkin),
  [uiSettings.uiSkin]
);
useMenuCommands({
  runtime,
  importAudio: session.importAudio,
  openProject: session.openProject,
  saveProject: session.saveProject,
  changeSkin: uiSettings.changeSkin
});
```

- [ ] **Step 7: Run settings and app tests**

Run:

```powershell
npm test -- src/app/uiSettings/UiSettingsProvider.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run lint and typecheck**

Run:

```powershell
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit UI settings split**

Run:

```powershell
git add -- src
git commit -m "Split UI settings from app session"
```

Expected: commit succeeds with UI settings boundary changes.

---

## Task 10: Clarify Historical UI Residue

**Files:**
- Delete: `src/features/projectSidebar/ProjectSidebar.tsx`
- Delete: `src/features/projectSidebar/index.ts`
- Delete: `src/features/workbenchDocks/WorkbenchDocks.tsx`
- Delete: `src/features/workbenchDocks/index.ts`
- Modify: `src/core/project/types.ts`
- Modify: `src/core/workspace/workspaceState.ts`
- Modify: `src/core/workspace/workspaceState.test.ts`

- [ ] **Step 1: Confirm unused feature files**

Run:

```powershell
rg "ProjectSidebar|WorkbenchDocks|features/projectSidebar|features/workbenchDocks" src
```

Expected output only references the unused files themselves and tests that assert those surfaces are absent. No active product file should import them.

- [ ] **Step 2: Delete unused feature files**

Delete:

```text
src/features/projectSidebar/ProjectSidebar.tsx
src/features/projectSidebar/index.ts
src/features/workbenchDocks/WorkbenchDocks.tsx
src/features/workbenchDocks/index.ts
```

- [ ] **Step 3: Document retained workspace compatibility fields**

Modify `src/core/project/types.ts` above `WorkspaceState`:

```ts
/**
 * WorkspaceState includes a few compatibility fields from earlier workbench
 * layouts. The focused UI currently consumes playback, loop, viewport, and
 * bar-grid fields. `preset`, `activeDock`, and `gridEnabled` remain persisted
 * so older project files normalize safely while future workspace designs are
 * still unsettled.
 */
export interface WorkspaceState {
```

Modify `src/core/workspace/workspaceState.ts` above `DEFAULT_WORKSPACE_BASE`:

```ts
// Keep these compatibility defaults stable for older project payloads even
// when the focused workbench does not render docks or preset controls.
```

- [ ] **Step 4: Run residue search**

Run:

```powershell
rg "ProjectSidebar|WorkbenchDocks" src
```

Expected: no output.

- [ ] **Step 5: Run workspace tests**

Run:

```powershell
npm test -- src/core/workspace/workspaceState.test.ts src/components/WorkbenchShell.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run lint and typecheck**

Run:

```powershell
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit residue cleanup**

Run:

```powershell
git add -- src
git commit -m "Clarify focused workspace residue"
```

Expected: commit succeeds with unused feature deletion and compatibility comments.

---

## Task 11: Final Verification And Electron Smoke

**Files:**
- No planned file changes.

- [ ] **Step 1: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS, including raw control and style token checks.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run all tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 5: Verify browser development startup**

Start Vite:

```powershell
$proc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','--host','127.0.0.1' -WorkingDirectory 'D:\WORKSPACE\ZiQi' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 6
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173' -TimeoutSec 5
```

Expected status: `200`.

Open `http://127.0.0.1:5173` in the in-app browser and verify the page shows:

```text
No project loaded
Use the File menu to import audio or open an existing ZiQi project.
```

- [ ] **Step 6: Run Electron smoke**

Build:

```powershell
npm run build
```

Launch Electron with remote debugging:

```powershell
$electron = 'D:\WORKSPACE\ZiQi\node_modules\.bin\electron.cmd'
$args = @('--remote-debugging-port=9222', 'dist-electron\main.js')
$proc = Start-Process -FilePath $electron -ArgumentList $args -WorkingDirectory 'D:\WORKSPACE\ZiQi' -PassThru
Start-Sleep -Seconds 5
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9222/json' -TimeoutSec 5
```

Expected: JSON listing at least one renderer target.

Use the renderer debugging target to evaluate:

```js
typeof window.ziqiApp === "object" &&
typeof window.ziqiApp.getVersion === "function" &&
typeof window.ziqiApp.openProject === "function" &&
typeof window.ziqiApp.saveProject === "function"
```

Expected result: `true`.

If the local environment cannot launch Electron, record the exact blocking error in the final implementation summary.

- [ ] **Step 7: Inspect final status**

Run:

```powershell
git status --short
```

Expected: no output.

## Self-Review

- Spec coverage: Tasks cover runtime boundary, renderer typecheck, session/settings boundary cleanup, `SpectrogramView` model/interaction/render split, strict UI primitive lint, token lint, historical residue, and final verification. The plan explicitly excludes main control zone redesign and user-facing busy/error UI.
- Placeholder scan: No placeholder markers remain. Every task has concrete files, code snippets, commands, and expected outcomes.
- Type consistency: Runtime method names match `Window["ziqiApp"]`; UI primitive names match `src/ui` exports; spectrogram helper names match the planned imports; verification commands use existing project scripts plus the new `typecheck` script.
