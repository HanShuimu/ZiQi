# Bar Grid Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-persisted bar alignment controls and visible bar-start lines in the pitch heatmap, plus expanded hover time readout.

**Architecture:** Keep the feature in the existing workspace state flow: project `WorkspaceState` stores `beatsPerBar`, `bpm`, and `beatOffsetMs`; `SpectrogramViewer` passes those values to the control zone and heatmap view; the heatmap view derives visible bar lines from the active viewport. No audio analysis, playback service, or Electron boundary changes are needed.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS overlays.

---

## File Structure

- Modify `src/core/project/types.ts`: add the persisted `beatsPerBar` workspace field.
- Modify `src/core/workspace/workspaceState.ts`: add default and normalization logic for `beatsPerBar`, tighten `bpm`, and keep signed millisecond offset.
- Modify `src/core/workspace/workspaceState.test.ts`: cover default, legacy, valid, and invalid workspace state.
- Modify `src/features/spectrogramViewer/WorkspaceControlZone.tsx`: add numeric bar-grid controls and BPM step buttons.
- Modify `src/features/spectrogramViewer/SpectrogramViewer.tsx`: pass workspace bar-grid values into controls and view.
- Modify `src/features/spectrogramViewer/SpectrogramView.tsx`: compute visible bar-start lines and render a separate overlay class.
- Modify `src/features/spectrogramViewer/pitchHover.ts`: add expanded hover time formatting.
- Modify `src/features/spectrogramViewer/pitchHover.test.ts`: cover expanded hover label formatting.
- Modify `src/features/spectrogramViewer/SpectrogramView.test.tsx`: cover bar line positions and expanded hover status.
- Modify `src/components/WorkbenchShell.test.tsx`: cover the control zone inputs and BPM step buttons through the real shell wiring.
- Modify `src/styles.css`: style numeric controls and bar grid overlay.

---

### Task 1: Workspace State Persistence

**Files:**
- Modify: `src/core/project/types.ts`
- Modify: `src/core/workspace/workspaceState.ts`
- Test: `src/core/workspace/workspaceState.test.ts`

- [ ] **Step 1: Write failing workspace state tests**

Update `src/core/workspace/workspaceState.test.ts` so the default, valid, and invalid workspace expectations include `beatsPerBar`. Use these concrete edits:

```ts
it("creates focused M1 defaults for imported audio", () => {
  expect(createDefaultWorkspaceState(12_000)).toEqual({
    preset: "pure-spectrum",
    activeDock: "analysis",
    gridEnabled: true,
    beatsPerBar: 4,
    bpm: 120,
    beatOffsetMs: 0,
    playbackRate: 1,
    spectrogramViewport: {
      startMs: 0,
      durationMs: 10_000
    }
  });
});
```

In `"normalizes a valid saved focused workspace"`, add the input and expected output:

```ts
beatsPerBar: 3,
bpm: 96.4,
beatOffsetMs: -250.6,
```

and expect:

```ts
beatsPerBar: 3,
bpm: 96,
beatOffsetMs: -251,
```

Replace the invalid-field test input for beat settings with:

```ts
beatsPerBar: -3,
bpm: 0,
beatOffsetMs: Number.NaN,
```

and expect:

```ts
beatsPerBar: 4,
bpm: 120,
beatOffsetMs: 0,
```

Add one legacy compatibility assertion:

```ts
it("fills bar grid defaults for older saved workspaces", () => {
  const workspace = normalizeWorkspaceState(
    {
      preset: "pure-spectrum",
      activeDock: "analysis",
      gridEnabled: true,
      bpm: 118,
      beatOffsetMs: -120,
      playbackRate: 1
    },
    12_000
  );

  expect(workspace.beatsPerBar).toBe(4);
  expect(workspace.bpm).toBe(118);
  expect(workspace.beatOffsetMs).toBe(-120);
});
```

- [ ] **Step 2: Run the workspace state test and confirm it fails**

Run:

```powershell
npm test -- src/core/workspace/workspaceState.test.ts
```

Expected: FAIL because `beatsPerBar` does not exist on `WorkspaceState` or default state yet.

- [ ] **Step 3: Add the workspace field and normalization**

In `src/core/project/types.ts`, update `WorkspaceState`:

```ts
export interface WorkspaceState {
  preset: "pure-spectrum" | "spectrum-analysis" | "wide-compare";
  activeDock: "analysis" | "stems" | "notes" | "compare" | "hidden";
  gridEnabled: boolean;
  beatsPerBar: number;
  bpm: number;
  beatOffsetMs: number;
  playbackRate: number;
  loopRange?: LoopRange;
  spectrogramViewport?: WorkspaceSpectrogramViewport;
}
```

In `src/core/workspace/workspaceState.ts`, add `beatsPerBar` to `DEFAULT_WORKSPACE_BASE`:

```ts
const DEFAULT_WORKSPACE_BASE = {
  preset: "pure-spectrum",
  activeDock: "analysis",
  gridEnabled: true,
  beatsPerBar: 4,
  bpm: 120,
  beatOffsetMs: 0,
  playbackRate: 1
} as const;
```

Replace the beat-related normalization in `normalizeWorkspaceState` with:

```ts
beatsPerBar: positiveIntegerOrDefault(workspace.beatsPerBar, defaultWorkspace.beatsPerBar),
bpm: positiveIntegerOrDefault(workspace.bpm, defaultWorkspace.bpm),
beatOffsetMs: finiteIntegerOrDefault(workspace.beatOffsetMs, defaultWorkspace.beatOffsetMs),
```

Replace `finiteOrDefault` with these helpers:

```ts
function positiveIntegerOrDefault(value: unknown, fallback: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return Math.round(numericValue);
}

function finiteIntegerOrDefault(value: unknown, fallback: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.round(numericValue);
}
```

- [ ] **Step 4: Run the workspace state test and confirm it passes**

Run:

```powershell
npm test -- src/core/workspace/workspaceState.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit workspace state changes**

Run:

```powershell
git add -- src/core/project/types.ts src/core/workspace/workspaceState.ts src/core/workspace/workspaceState.test.ts
git commit -m "Add bar grid workspace state"
```

---

### Task 2: Control Zone Inputs

**Files:**
- Modify: `src/features/spectrogramViewer/WorkspaceControlZone.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramViewer.tsx`
- Test: `src/components/WorkbenchShell.test.tsx`

- [ ] **Step 1: Write failing control-zone tests**

In `src/components/WorkbenchShell.test.tsx`, add these tests after `"renders grouped workspace controls above the waveform"`:

```ts
it("renders bar grid controls above the waveform", () => {
  const project = createMockProjectSummary();

  renderWorkbenchShell(<WorkbenchShell project={project} />);

  expect(screen.getByText("Bar Grid")).toBeTruthy();
  expect(screen.getByLabelText("Beats per bar")).toMatchObject({
    type: "number",
    value: "4"
  });
  expect(screen.getByLabelText("BPM")).toMatchObject({
    type: "number",
    value: "120"
  });
  expect(screen.getByLabelText("Beat offset milliseconds")).toMatchObject({
    type: "number",
    value: "0"
  });
  expect(screen.getByRole("button", { name: "Decrease BPM" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Increase BPM" })).toBeTruthy();
});

it("reports bar grid control changes for persistence", () => {
  const project = createMockProjectSummary();
  const onWorkspaceChange = vi.fn();

  renderWorkbenchShell(
    <WorkbenchShell
      project={project}
      audioFacade={mockProjectAudioFacade}
      onWorkspaceChange={onWorkspaceChange}
      spectrogramOverview={createSpectrogramOverview()}
    />
  );

  fireEvent.change(screen.getByLabelText("Beats per bar"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("BPM"), { target: { value: "96" } });
  fireEvent.change(screen.getByLabelText("Beat offset milliseconds"), { target: { value: "-250" } });

  expect(onWorkspaceChange).toHaveBeenCalledWith({ beatsPerBar: 3 });
  expect(onWorkspaceChange).toHaveBeenCalledWith({ bpm: 96 });
  expect(onWorkspaceChange).toHaveBeenCalledWith({ beatOffsetMs: -250 });
});

it("steps BPM by one from the bar grid arrow buttons", async () => {
  const user = userEvent.setup();
  const project = createMockProjectSummary();
  const onWorkspaceChange = vi.fn();

  renderWorkbenchShell(
    <WorkbenchShell
      project={project}
      audioFacade={mockProjectAudioFacade}
      onWorkspaceChange={onWorkspaceChange}
      spectrogramOverview={createSpectrogramOverview()}
    />
  );

  await user.click(screen.getByRole("button", { name: "Decrease BPM" }));
  await user.click(screen.getByRole("button", { name: "Increase BPM" }));

  expect(onWorkspaceChange).toHaveBeenCalledWith({ bpm: 119 });
  expect(onWorkspaceChange).toHaveBeenCalledWith({ bpm: 121 });
});
```

- [ ] **Step 2: Run the shell test and confirm it fails**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: FAIL because the bar grid controls are not rendered yet.

- [ ] **Step 3: Add control props and numeric controls**

In `src/features/spectrogramViewer/WorkspaceControlZone.tsx`, import the workspace type:

```ts
import type { WorkspaceState } from "../../core/project/types";
```

Add props:

```ts
  beatOffsetMs: number;
  beatsPerBar: number;
  bpm: number;
  onBarGridChange: (settings: Pick<WorkspaceState, "beatOffsetMs" | "beatsPerBar" | "bpm">) => void;
```

Destructure those props in the component parameter list.

Add this control group between Speed and Loop:

```tsx
<div className="workspace-control-group bar-grid-controls" aria-label="Bar grid controls">
  <div className="workspace-control-label">Bar Grid</div>
  <label className="bar-grid-number-field">
    Beats
    <input
      aria-label="Beats per bar"
      min={1}
      onChange={(event) =>
        onBarGridChange({
          beatsPerBar: getPositiveIntegerInputValue(event.currentTarget.value, beatsPerBar)
        })
      }
      step={1}
      type="number"
      value={beatsPerBar}
    />
  </label>
  <label className="bar-grid-number-field">
    BPM
    <span className="bpm-stepper">
      <button
        aria-label="Decrease BPM"
        onClick={() => onBarGridChange({ bpm: Math.max(1, Math.round(bpm) - 1) })}
        type="button"
      >
        &lt;
      </button>
      <input
        aria-label="BPM"
        min={1}
        onChange={(event) =>
          onBarGridChange({
            bpm: getPositiveIntegerInputValue(event.currentTarget.value, bpm)
          })
        }
        step={1}
        type="number"
        value={bpm}
      />
      <button
        aria-label="Increase BPM"
        onClick={() => onBarGridChange({ bpm: Math.max(1, Math.round(bpm) + 1) })}
        type="button"
      >
        &gt;
      </button>
    </span>
  </label>
  <label className="bar-grid-number-field">
    Offset ms
    <input
      aria-label="Beat offset milliseconds"
      onChange={(event) =>
        onBarGridChange({
          beatOffsetMs: getIntegerInputValue(event.currentTarget.value, beatOffsetMs)
        })
      }
      step={1}
      type="number"
      value={beatOffsetMs}
    />
  </label>
</div>
```

Add helpers near `formatTime`:

```ts
function getPositiveIntegerInputValue(value: string, fallback: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return Math.round(numericValue);
}

function getIntegerInputValue(value: string, fallback: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.round(numericValue);
}
```

- [ ] **Step 4: Wire controls through the viewer**

In `src/features/spectrogramViewer/SpectrogramViewer.tsx`, pass workspace values into `WorkspaceControlZone`:

```tsx
beatOffsetMs={project.workspace.beatOffsetMs}
beatsPerBar={project.workspace.beatsPerBar}
bpm={project.workspace.bpm}
onBarGridChange={onWorkspaceChange}
```

Place these props alongside the other workspace control props.

- [ ] **Step 5: Run the shell test and confirm it passes**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit control-zone changes**

Run:

```powershell
git add -- src/features/spectrogramViewer/WorkspaceControlZone.tsx src/features/spectrogramViewer/SpectrogramViewer.tsx src/components/WorkbenchShell.test.tsx
git commit -m "Add bar grid controls"
```

---

### Task 3: Hover Time Label

**Files:**
- Modify: `src/features/spectrogramViewer/pitchHover.ts`
- Modify: `src/features/spectrogramViewer/SpectrogramView.tsx`
- Test: `src/features/spectrogramViewer/pitchHover.test.ts`
- Test: `src/features/spectrogramViewer/SpectrogramView.test.tsx`

- [ ] **Step 1: Write failing formatting tests**

In `src/features/spectrogramViewer/pitchHover.test.ts`, update the import:

```ts
import {
  formatPreciseTimeLabel,
  formatPreciseTimeWithMilliseconds,
  getPitchHoverStateFromPoint,
  getPitchLaneCssProperties,
  getPitchLaneStyle
} from "./pitchHover";
```

Add this test after the existing precise time test:

```ts
it("formats precise time labels with raw milliseconds", () => {
  expect(formatPreciseTimeWithMilliseconds(0)).toBe("00:00.000 (0 ms)");
  expect(formatPreciseTimeWithMilliseconds(1000.6)).toBe("00:01.001 (1001 ms)");
  expect(formatPreciseTimeWithMilliseconds(84_320)).toBe("01:24.320 (84320 ms)");
  expect(formatPreciseTimeWithMilliseconds(Number.NaN)).toBe("00:00.000 (0 ms)");
});
```

In `src/features/spectrogramViewer/SpectrogramView.test.tsx`, update the hover status expectation in `"pointer move updates status, active piano key, hover row, hover time line"`:

```ts
expect(status.textContent).toContain("00:06.000 (6000 ms)");
```

- [ ] **Step 2: Run hover-related tests and confirm they fail**

Run:

```powershell
npm test -- src/features/spectrogramViewer/pitchHover.test.ts src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: FAIL because `formatPreciseTimeWithMilliseconds` is missing and the status still shows only compact time.

- [ ] **Step 3: Add expanded time formatting**

In `src/features/spectrogramViewer/pitchHover.ts`, refactor the safe time rounding into a helper and add the expanded formatter:

```ts
export function formatPreciseTimeLabel(timeMs: number) {
  const safeTimeMs = getSafeRoundedTimeMs(timeMs);
  const totalSeconds = Math.floor(safeTimeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = safeTimeMs % 1000;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

export function formatPreciseTimeWithMilliseconds(timeMs: number) {
  const safeTimeMs = getSafeRoundedTimeMs(timeMs);
  return `${formatPreciseTimeLabel(safeTimeMs)} (${safeTimeMs} ms)`;
}

function getSafeRoundedTimeMs(timeMs: number) {
  return Number.isFinite(timeMs) ? Math.max(0, Math.round(timeMs)) : 0;
}
```

- [ ] **Step 4: Use expanded time in the pitch hover status only**

In `src/features/spectrogramViewer/SpectrogramView.tsx`, update the import:

```ts
  formatPreciseTimeLabel,
  formatPreciseTimeWithMilliseconds,
```

Then update the status strip time span:

```tsx
<span className="pitch-hover-status-time">
  {formatPreciseTimeWithMilliseconds(pointerState.timeMs)}
</span>
```

Keep `SpectrogramTimelineNavigator` using `formatPreciseTimeLabel` through its existing code path.

- [ ] **Step 5: Run hover-related tests and confirm they pass**

Run:

```powershell
npm test -- src/features/spectrogramViewer/pitchHover.test.ts src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit hover label changes**

Run:

```powershell
git add -- src/features/spectrogramViewer/pitchHover.ts src/features/spectrogramViewer/pitchHover.test.ts src/features/spectrogramViewer/SpectrogramView.tsx src/features/spectrogramViewer/SpectrogramView.test.tsx
git commit -m "Show hover time in milliseconds"
```

---

### Task 4: Bar Grid Overlay

**Files:**
- Modify: `src/features/spectrogramViewer/SpectrogramView.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramViewer.tsx`
- Modify: `src/styles.css`
- Test: `src/features/spectrogramViewer/SpectrogramView.test.tsx`

- [ ] **Step 1: Write failing bar-line render tests**

In `src/features/spectrogramViewer/SpectrogramView.test.tsx`, add this test after `"renders waveform strip, piano rail, time grid, and spectrogram canvas"`:

```ts
it("renders visible bar grid lines from beats, bpm, and offset", () => {
  renderSpectrogramView(
    <SpectrogramView
      beatOffsetMs={500}
      beatsPerBar={4}
      bpm={120}
      currentTimeMs={0}
      durationMs={12_000}
      spectrogramOverview={createSpectrogramOverview()}
      viewport={{ startMs: 0, durationMs: 10_000 }}
      waveformOverview={createWaveformOverview()}
      isPlaying={false}
      playbackRate={1}
      onPlaybackToggle={vi.fn()}
      onSeek={vi.fn()}
      loopRange={undefined}
      onLoopClear={vi.fn()}
      onLoopEndSet={vi.fn()}
      onLoopStartSet={vi.fn()}
      onPlaybackRateChange={vi.fn()}
      onViewportChange={vi.fn()}
    />
  );

  expect(screen.getAllByTestId("spectrogram-bar-grid-line").map((line) => line.style.left)).toEqual([
    "5%",
    "25%",
    "45%",
    "65%",
    "85%"
  ]);
});
```

Add a negative offset test:

```ts
it("keeps negative-offset bar grid lines aligned to the viewport", () => {
  renderSpectrogramView(
    <SpectrogramView
      beatOffsetMs={-500}
      beatsPerBar={4}
      bpm={120}
      currentTimeMs={0}
      durationMs={12_000}
      spectrogramOverview={createSpectrogramOverview()}
      viewport={{ startMs: 0, durationMs: 10_000 }}
      waveformOverview={createWaveformOverview()}
      isPlaying={false}
      playbackRate={1}
      onPlaybackToggle={vi.fn()}
      onSeek={vi.fn()}
      loopRange={undefined}
      onLoopClear={vi.fn()}
      onLoopEndSet={vi.fn()}
      onLoopStartSet={vi.fn()}
      onPlaybackRateChange={vi.fn()}
      onViewportChange={vi.fn()}
    />
  );

  expect(screen.getAllByTestId("spectrogram-bar-grid-line").map((line) => line.style.left)).toEqual([
    "15%",
    "35%",
    "55%",
    "75%",
    "95%"
  ]);
});
```

- [ ] **Step 2: Run the spectrogram view test and confirm it fails**

Run:

```powershell
npm test -- src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: FAIL because `SpectrogramView` does not accept bar grid props or render bar lines yet.

- [ ] **Step 3: Add bar grid props and derived lines**

In `src/features/spectrogramViewer/SpectrogramView.tsx`, add optional props:

```ts
  beatOffsetMs?: number;
  beatsPerBar?: number;
  bpm?: number;
```

Destructure defaults:

```ts
  beatOffsetMs = 0,
  beatsPerBar = 4,
  bpm = 120,
```

Add this memo beside `timeGridLines`:

```ts
const barGridLines = useMemo(
  () =>
    createBarGridLines(activeViewport, {
      beatOffsetMs,
      beatsPerBar,
      bpm
    }),
  [activeViewport, beatOffsetMs, beatsPerBar, bpm]
);
```

Add this type and helper near `createTimeGridLines`:

```ts
interface BarGridSettings {
  beatOffsetMs: number;
  beatsPerBar: number;
  bpm: number;
}

function createBarGridLines(viewport: SpectrogramViewport, settings: BarGridSettings) {
  const beatsPerBar = Math.round(settings.beatsPerBar);
  const bpm = Math.round(settings.bpm);
  const beatOffsetMs = Math.round(settings.beatOffsetMs);

  if (
    viewport.durationMs <= 0 ||
    !Number.isFinite(viewport.startMs) ||
    !Number.isFinite(viewport.durationMs) ||
    !Number.isFinite(beatsPerBar) ||
    !Number.isFinite(bpm) ||
    !Number.isFinite(beatOffsetMs) ||
    beatsPerBar <= 0 ||
    bpm <= 0
  ) {
    return [];
  }

  const barDurationMs = (60_000 / bpm) * beatsPerBar;
  if (!Number.isFinite(barDurationMs) || barDurationMs <= 0) {
    return [];
  }

  const viewportStartMs = viewport.startMs;
  const viewportEndMs = viewport.startMs + viewport.durationMs;
  const firstBarIndex = Math.ceil((viewportStartMs - beatOffsetMs) / barDurationMs);
  const lines: Array<{ leftPercent: number; timeMs: number }> = [];

  for (
    let barIndex = firstBarIndex;
    beatOffsetMs + barIndex * barDurationMs < viewportEndMs;
    barIndex += 1
  ) {
    const timeMs = beatOffsetMs + barIndex * barDurationMs;
    if (timeMs >= viewportStartMs) {
      lines.push({
        leftPercent: timeToViewportPercent(timeMs, viewport),
        timeMs
      });
    }
  }

  return lines;
}
```

- [ ] **Step 4: Render bar lines inside the heatmap frame**

In `src/features/spectrogramViewer/SpectrogramView.tsx`, render bar lines after `timeGridLines` and before the playback cursor:

```tsx
{barGridLines.map((line) => (
  <div
    key={line.timeMs}
    className="spectrogram-bar-grid-line"
    data-testid="spectrogram-bar-grid-line"
    style={{ left: `${line.leftPercent}%` }}
  />
))}
```

- [ ] **Step 5: Pass workspace settings from the viewer**

In `src/features/spectrogramViewer/SpectrogramViewer.tsx`, pass these props to `SpectrogramView`:

```tsx
beatOffsetMs={project.workspace.beatOffsetMs}
beatsPerBar={project.workspace.beatsPerBar}
bpm={project.workspace.bpm}
```

- [ ] **Step 6: Style the bar grid overlay**

In `src/styles.css`, add this rule near `.spectrogram-time-grid-line`:

```css
.spectrogram-bar-grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.68);
  pointer-events: none;
}
```

- [ ] **Step 7: Run the spectrogram view test and confirm it passes**

Run:

```powershell
npm test -- src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit bar overlay changes**

Run:

```powershell
git add -- src/features/spectrogramViewer/SpectrogramView.tsx src/features/spectrogramViewer/SpectrogramViewer.tsx src/features/spectrogramViewer/SpectrogramView.test.tsx src/styles.css
git commit -m "Render bar grid lines"
```

---

### Task 5: Styling Polish and Full Verification

**Files:**
- Modify: `src/styles.css`
- Test: existing test suite

- [ ] **Step 1: Add compact number-control styles**

In `src/styles.css`, add these rules near the control-zone styles:

```css
.bar-grid-controls {
  align-items: end;
}

.bar-grid-number-field {
  display: grid;
  font-size: 0.72rem;
  gap: 0.2rem;
}

.bar-grid-number-field input {
  box-sizing: border-box;
  width: 5.5rem;
}

.bpm-stepper {
  align-items: center;
  display: flex;
  gap: 0.25rem;
}

.bpm-stepper button {
  min-width: 2rem;
  padding-inline: 0.45rem;
}

.bpm-stepper input {
  width: 4.75rem;
}
```

- [ ] **Step 2: Run focused tests**

Run:

```powershell
npm test -- src/core/workspace/workspaceState.test.ts src/components/WorkbenchShell.test.tsx src/features/spectrogramViewer/pitchHover.test.ts src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

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

Expected: PASS with Vite and TypeScript build completing successfully.

- [ ] **Step 5: Optional Electron smoke check**

If execution time allows and Electron dependencies are available, run the existing app smoke workflow after the build. Verify in the running renderer that:

- `window.ziqiApp` exists;
- the control zone shows bar grid number inputs;
- changing BPM or offset moves the visible bar lines.

- [ ] **Step 6: Commit final polish**

If Step 1 changed CSS after Task 4, run:

```powershell
git add -- src/styles.css
git commit -m "Polish bar grid controls"
```

If Step 1 was already included in Task 4 during execution, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Workspace state persistence is covered by Task 1.
- Numeric controls and BPM step buttons are covered by Task 2.
- Expanded hover time readout is covered by Task 3.
- Bar-start line calculation and negative offset behavior are covered by Task 4.
- Styles, focused tests, full tests, build, and optional Electron smoke verification are covered by Task 5.
- Non-goals remain excluded: no automatic BPM detection, snapping, beat subdivision, annotation creation, audio analysis changes, playback changes, or Electron boundary changes.

Placeholder scan:

- The plan contains no unresolved fill-ins or undefined follow-up tasks.

Type consistency:

- The new workspace property is consistently named `beatsPerBar`.
- The existing offset property remains `beatOffsetMs`.
- The existing BPM property remains `bpm`.
- The proposed control callback uses `Pick<WorkspaceState, "beatOffsetMs" | "beatsPerBar" | "bpm">`.
