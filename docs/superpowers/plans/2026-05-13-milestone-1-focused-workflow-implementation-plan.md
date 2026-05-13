# Milestone 1 Focused Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the focused Milestone 1 listening workflow: playback speed control, one loop range, and minimal workspace restoration for saved projects.

**Architecture:** Add a small project workspace helper for defaults and validation, then pass workspace updates from `SpectrogramView` through `WorkbenchShell` into `App` so saves always use the latest project state. Existing Electron save/open and `BrowserPlaybackService` remain the runtime boundaries.

**Tech Stack:** Electron 37, React 19, TypeScript, Vite, Vitest with jsdom, Testing Library.

---

## Worktree And Baseline

Worktree: `D:\WORKSPACE\ZiQi\.worktrees\milestone-1-focused-workflow`

Branch: `codex/milestone-1-focused-workflow`

Baseline already verified:

```powershell
npm install
npm test
```

Expected baseline result:

```text
Test Files  15 passed (15)
Tests       109 passed (109)
```

## File Structure

- Create `src/domain/project/workspaceState.ts`
  - Own supported playback rates, default workspace creation, workspace normalization, and small update helpers.
- Create `src/domain/project/workspaceState.test.ts`
  - Covers defaults, legacy project fallback, supported playback rates, loop validation, and viewport clamping.
- Modify `src/domain/project/types.ts`
  - Add `LoopRange`, `WorkspaceSpectrogramViewport`, and optional workspace persistence fields.
- Modify `src/domain/project/createProjectFromAudio.ts`
  - Use the shared default workspace helper for imported audio.
- Modify `src/domain/project/mockProject.ts`
  - Keep tests aligned with the expanded workspace shape.
- Modify `src/components/SpectrogramView.tsx`
  - Render rate controls, loop controls, loop range overlay, and accept/restores a controlled initial/current viewport.
- Modify `src/components/SpectrogramView.test.tsx`
  - Cover rate control, loop controls, loop display, and viewport callback behavior.
- Modify `src/components/SpectrogramTimelineNavigator.tsx`
  - Render the active loop range on the full-duration navigator track.
- Modify `src/components/SpectrogramTimelineNavigator.test.tsx`
  - Cover loop range positioning.
- Modify `src/components/WorkbenchShell.tsx`
  - Call playback service rate/loop methods and report workspace updates upward.
- Modify `src/components/WorkbenchShell.test.tsx`
  - Cover playback rate and loop service calls plus workspace update callbacks.
- Modify `src/App.tsx`
  - Normalize opened workspace state, restore playback settings after successful audio load, and persist workspace updates into project state.
- Modify `src/App.test.tsx`
  - Cover imported defaults, saved workspace updates, opened project restoration, and legacy fallback.
- Modify `src/styles.css`
  - Style compact rate buttons, loop controls, and loop range overlays.

## Task 1: Workspace State Defaults And Validation

**Files:**
- Create: `src/domain/project/workspaceState.ts`
- Create: `src/domain/project/workspaceState.test.ts`
- Modify: `src/domain/project/types.ts`
- Modify: `src/domain/project/createProjectFromAudio.ts`
- Modify: `src/domain/project/mockProject.ts`

- [ ] **Step 1: Write failing workspace state tests**

Create `src/domain/project/workspaceState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  SUPPORTED_PLAYBACK_RATES,
  createDefaultWorkspaceState,
  normalizeWorkspaceState
} from "./workspaceState";

describe("workspaceState", () => {
  it("creates focused M1 defaults for imported audio", () => {
    expect(createDefaultWorkspaceState(12_000)).toEqual({
      preset: "pure-spectrum",
      activeDock: "analysis",
      gridEnabled: true,
      bpm: 120,
      beatOffsetMs: 0,
      playbackRate: 1,
      spectrogramViewport: {
        startMs: 0,
        durationMs: 10_000
      }
    });
  });

  it("supports only the focused M1 playback rates", () => {
    expect(SUPPORTED_PLAYBACK_RATES).toEqual([0.5, 0.75, 1, 1.25, 1.5]);
  });

  it("normalizes a valid saved focused workspace", () => {
    const workspace = normalizeWorkspaceState(
      {
        preset: "spectrum-analysis",
        activeDock: "notes",
        gridEnabled: false,
        bpm: 96,
        beatOffsetMs: 42,
        playbackRate: 0.75,
        loopRange: {
          startMs: 1_000,
          endMs: 4_000
        },
        spectrogramViewport: {
          startMs: 2_000,
          durationMs: 5_000
        }
      },
      12_000
    );

    expect(workspace).toEqual({
      preset: "spectrum-analysis",
      activeDock: "notes",
      gridEnabled: false,
      bpm: 96,
      beatOffsetMs: 42,
      playbackRate: 0.75,
      loopRange: {
        startMs: 1_000,
        endMs: 4_000
      },
      spectrogramViewport: {
        startMs: 2_000,
        durationMs: 5_000
      }
    });
  });

  it("falls back from legacy or invalid focused fields", () => {
    const workspace = normalizeWorkspaceState(
      {
        preset: "pure-spectrum",
        activeDock: "analysis",
        gridEnabled: true,
        bpm: 120,
        beatOffsetMs: 0,
        playbackRate: 1.1,
        loopRange: {
          startMs: 5_000,
          endMs: 2_000
        },
        spectrogramViewport: {
          startMs: 100_000,
          durationMs: Number.NaN
        }
      },
      12_000
    );

    expect(workspace).toEqual({
      preset: "pure-spectrum",
      activeDock: "analysis",
      gridEnabled: true,
      bpm: 120,
      beatOffsetMs: 0,
      playbackRate: 1,
      spectrogramViewport: {
        startMs: 0,
        durationMs: 10_000
      }
    });
  });

  it("clamps saved viewport and loop ranges to the audio duration", () => {
    const workspace = normalizeWorkspaceState(
      {
        preset: "pure-spectrum",
        activeDock: "analysis",
        gridEnabled: true,
        bpm: 120,
        beatOffsetMs: 0,
        playbackRate: 1.25,
        loopRange: {
          startMs: 10_000,
          endMs: 20_000
        },
        spectrogramViewport: {
          startMs: 11_000,
          durationMs: 5_000
        }
      },
      12_000
    );

    expect(workspace.loopRange).toEqual({
      startMs: 10_000,
      endMs: 12_000
    });
    expect(workspace.spectrogramViewport).toEqual({
      startMs: 7_000,
      durationMs: 5_000
    });
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```powershell
npm test -- src/domain/project/workspaceState.test.ts
```

Expected: FAIL because `src/domain/project/workspaceState.ts` does not exist.

- [ ] **Step 3: Extend project workspace types**

Modify `src/domain/project/types.ts`:

```ts
export interface LoopRange {
  startMs: number;
  endMs: number;
}

export interface WorkspaceSpectrogramViewport {
  startMs: number;
  durationMs: number;
}

export interface WorkspaceState {
  preset: "pure-spectrum" | "spectrum-analysis" | "wide-compare";
  activeDock: "analysis" | "stems" | "notes" | "compare" | "hidden";
  gridEnabled: boolean;
  bpm: number;
  beatOffsetMs: number;
  playbackRate: number;
  loopRange?: LoopRange;
  spectrogramViewport?: WorkspaceSpectrogramViewport;
}
```

- [ ] **Step 4: Implement workspace helpers**

Create `src/domain/project/workspaceState.ts`:

```ts
import { clampSpectrogramViewport, createDefaultSpectrogramViewport } from "../../components/spectrogramViewport";
import type { LoopRange, WorkspaceState } from "./types";

export const SUPPORTED_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;
type SupportedPlaybackRate = (typeof SUPPORTED_PLAYBACK_RATES)[number];

const DEFAULT_WORKSPACE_BASE = {
  preset: "pure-spectrum",
  activeDock: "analysis",
  gridEnabled: true,
  bpm: 120,
  beatOffsetMs: 0,
  playbackRate: 1
} as const;

export function createDefaultWorkspaceState(durationMs: number): WorkspaceState {
  return {
    ...DEFAULT_WORKSPACE_BASE,
    spectrogramViewport: createDefaultSpectrogramViewport(durationMs)
  };
}

export function normalizeWorkspaceState(
  workspace: Partial<WorkspaceState> | Record<string, unknown>,
  durationMs: number
): WorkspaceState {
  const defaultWorkspace = createDefaultWorkspaceState(durationMs);

  return {
    preset: isPreset(workspace.preset) ? workspace.preset : defaultWorkspace.preset,
    activeDock: isActiveDock(workspace.activeDock) ? workspace.activeDock : defaultWorkspace.activeDock,
    gridEnabled: typeof workspace.gridEnabled === "boolean" ? workspace.gridEnabled : defaultWorkspace.gridEnabled,
    bpm: finiteOrDefault(workspace.bpm, defaultWorkspace.bpm),
    beatOffsetMs: finiteOrDefault(workspace.beatOffsetMs, defaultWorkspace.beatOffsetMs),
    playbackRate: isSupportedPlaybackRate(workspace.playbackRate)
      ? workspace.playbackRate
      : defaultWorkspace.playbackRate,
    ...normalizeLoopRange(workspace.loopRange, durationMs),
    spectrogramViewport: normalizeSpectrogramViewport(
      workspace.spectrogramViewport,
      durationMs,
      defaultWorkspace.spectrogramViewport
    )
  };
}

function finiteOrDefault(value: unknown, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function isSupportedPlaybackRate(value: unknown): value is SupportedPlaybackRate {
  return SUPPORTED_PLAYBACK_RATES.includes(value as SupportedPlaybackRate);
}

function isPreset(value: unknown): value is WorkspaceState["preset"] {
  return value === "pure-spectrum" || value === "spectrum-analysis" || value === "wide-compare";
}

function isActiveDock(value: unknown): value is WorkspaceState["activeDock"] {
  return value === "analysis" || value === "stems" || value === "notes" || value === "compare" || value === "hidden";
}

function normalizeLoopRange(value: unknown, durationMs: number): Pick<WorkspaceState, "loopRange"> {
  if (!isLoopRange(value) || !Number.isFinite(durationMs) || durationMs <= 0) {
    return {};
  }

  const startMs = Math.min(durationMs, Math.max(0, Math.round(value.startMs)));
  const endMs = Math.min(durationMs, Math.max(0, Math.round(value.endMs)));
  if (endMs <= startMs) {
    return {};
  }

  return { loopRange: { startMs, endMs } };
}

function normalizeSpectrogramViewport(
  value: unknown,
  durationMs: number,
  fallback: WorkspaceState["spectrogramViewport"]
) {
  if (!isSpectrogramViewport(value)) {
    return fallback;
  }

  return clampSpectrogramViewport(value, durationMs);
}

function isLoopRange(value: unknown): value is LoopRange {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isFinite((value as LoopRange).startMs) &&
    Number.isFinite((value as LoopRange).endMs)
  );
}

function isSpectrogramViewport(value: unknown): value is NonNullable<WorkspaceState["spectrogramViewport"]> {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isFinite((value as NonNullable<WorkspaceState["spectrogramViewport"]>).startMs) &&
    Number.isFinite((value as NonNullable<WorkspaceState["spectrogramViewport"]>).durationMs)
  );
}
```

- [ ] **Step 5: Use defaults when creating imported projects**

Modify `src/domain/project/createProjectFromAudio.ts` so its workspace block comes from the helper:

```ts
import { createDefaultWorkspaceState } from "./workspaceState";

// inside createProjectFromAudio return object:
workspace: createDefaultWorkspaceState(metadata.durationMs)
```

- [ ] **Step 6: Update mock project defaults**

Modify `src/domain/project/mockProject.ts` so the mock project workspace includes:

```ts
workspace: createDefaultWorkspaceState(120_000)
```

Keep the existing mock project values outside `workspace` unchanged.

- [ ] **Step 7: Run focused project tests**

Run:

```powershell
npm test -- src/domain/project/workspaceState.test.ts src/domain/project/createProjectFromAudio.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit workspace state foundation**

Run:

```powershell
git add -- src/domain/project/types.ts src/domain/project/workspaceState.ts src/domain/project/workspaceState.test.ts src/domain/project/createProjectFromAudio.ts src/domain/project/mockProject.ts
git commit -m "Add focused workspace state helpers"
```

## Task 2: Spectrogram Rate, Loop, And Viewport Controls

**Files:**
- Modify: `src/components/SpectrogramView.tsx`
- Modify: `src/components/SpectrogramView.test.tsx`
- Modify: `src/components/SpectrogramTimelineNavigator.tsx`
- Modify: `src/components/SpectrogramTimelineNavigator.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing SpectrogramView interaction tests**

Add these tests to `src/components/SpectrogramView.test.tsx`:

```ts
it("renders playback rate choices and reports selected rate", async () => {
  const user = userEvent.setup();
  const onPlaybackRateChange = vi.fn();

  render(
    <SpectrogramView
      currentTimeMs={3_000}
      durationMs={12_000}
      spectrogramOverview={createSpectrogramOverview()}
      waveformOverview={createWaveformOverview()}
      isPlaying={false}
      playbackRate={1}
      loopRange={undefined}
      onLoopClear={vi.fn()}
      onLoopEndSet={vi.fn()}
      onLoopStartSet={vi.fn()}
      onPlaybackRateChange={onPlaybackRateChange}
      onPlaybackToggle={vi.fn()}
      onSeek={vi.fn()}
      onViewportChange={vi.fn()}
    />
  );

  await user.click(screen.getByRole("button", { name: "0.75x" }));

  expect(onPlaybackRateChange).toHaveBeenCalledWith(0.75);
});

it("sets and clears a loop range from the current playback time", async () => {
  const user = userEvent.setup();
  const onLoopStartSet = vi.fn();
  const onLoopEndSet = vi.fn();
  const onLoopClear = vi.fn();

  render(
    <SpectrogramView
      currentTimeMs={3_000}
      durationMs={12_000}
      spectrogramOverview={createSpectrogramOverview()}
      waveformOverview={createWaveformOverview()}
      isPlaying={false}
      playbackRate={1}
      loopRange={{ startMs: 1_000, endMs: 4_000 }}
      onLoopClear={onLoopClear}
      onLoopEndSet={onLoopEndSet}
      onLoopStartSet={onLoopStartSet}
      onPlaybackRateChange={vi.fn()}
      onPlaybackToggle={vi.fn()}
      onSeek={vi.fn()}
      onViewportChange={vi.fn()}
    />
  );

  await user.click(screen.getByRole("button", { name: "Set Loop Start" }));
  await user.click(screen.getByRole("button", { name: "Set Loop End" }));
  await user.click(screen.getByRole("button", { name: "Clear Loop" }));

  expect(onLoopStartSet).toHaveBeenCalledWith(3_000);
  expect(onLoopEndSet).toHaveBeenCalledWith(3_000);
  expect(onLoopClear).toHaveBeenCalledOnce();
  expect(screen.getByText("Loop 0:01-0:04")).toBeTruthy();
  expect(screen.getByTestId("spectrogram-navigator-loop-range")).toBeTruthy();
});

it("reports viewport changes from wheel zoom", () => {
  const onViewportChange = vi.fn();
  const { container } = render(
    <SpectrogramView
      currentTimeMs={2_500}
      durationMs={12_000}
      spectrogramOverview={createLongSpectrogramOverview(12, 4)}
      waveformOverview={createWaveformOverview()}
      isPlaying={false}
      playbackRate={1}
      loopRange={undefined}
      onLoopClear={vi.fn()}
      onLoopEndSet={vi.fn()}
      onLoopStartSet={vi.fn()}
      onPlaybackRateChange={vi.fn()}
      onPlaybackToggle={vi.fn()}
      onSeek={vi.fn()}
      onViewportChange={onViewportChange}
    />
  );

  const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
  stubCanvasFrameRect(frame);

  fireEvent.wheel(frame, { ctrlKey: true, deltaY: -100, clientX: 250 });

  expect(onViewportChange).toHaveBeenCalledWith(expect.objectContaining({
    startMs: expect.any(Number),
    durationMs: expect.any(Number)
  }));
});
```

Also add this import at the top:

```ts
import userEvent from "@testing-library/user-event";
```

- [ ] **Step 2: Write failing navigator loop display test**

Add this test to `src/components/SpectrogramTimelineNavigator.test.tsx`:

```ts
it("renders an active loop range on the full timeline", () => {
  render(
    <SpectrogramTimelineNavigator
      currentTimeMs={3_000}
      durationMs={12_000}
      loopRange={{ startMs: 3_000, endMs: 9_000 }}
      onViewportChange={vi.fn()}
      viewport={{ startMs: 0, durationMs: 10_000 }}
    />
  );

  const loopRange = screen.getByTestId("spectrogram-navigator-loop-range");

  expect(loopRange.style.left).toBe("25%");
  expect(loopRange.style.width).toBe("50%");
});
```

- [ ] **Step 3: Run focused component tests to verify failure**

Run:

```powershell
npm test -- src/components/SpectrogramView.test.tsx src/components/SpectrogramTimelineNavigator.test.tsx
```

Expected: FAIL because new props and loop DOM are not implemented.

- [ ] **Step 4: Add controlled props and callbacks to SpectrogramView**

Modify `SpectrogramViewProps` in `src/components/SpectrogramView.tsx`:

```ts
interface SpectrogramViewProps {
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;
  loopRange: { startMs: number; endMs: number } | undefined;
  spectrogramOverview: SpectrogramOverview | null | undefined;
  viewport?: SpectrogramViewport;
  waveformOverview: WaveformOverview | null | undefined;
  onLoopClear: () => Promise<void> | void;
  onLoopEndSet: (timeMs: number) => Promise<void> | void;
  onLoopStartSet: (timeMs: number) => Promise<void> | void;
  onPlaybackRateChange: (rate: number) => Promise<void> | void;
  onPlaybackToggle: () => Promise<void> | void;
  onSeek: (timeMs: number) => Promise<void> | void;
  onViewportChange: (viewport: SpectrogramViewport) => void;
}
```

Add:

```ts
const PLAYBACK_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;
```

Replace local viewport initialization with controlled fallback:

```ts
const [internalViewport, setInternalViewport] = useState(() =>
  viewport ?? createDefaultSpectrogramViewport(durationMs)
);
const activeViewport = viewport ?? internalViewport;

function updateViewport(nextViewport: SpectrogramViewport) {
  if (!viewport) {
    setInternalViewport(nextViewport);
  }
  onViewportChange(nextViewport);
}
```

Use `activeViewport` everywhere the component currently uses `viewport`.

- [ ] **Step 5: Render rate and loop controls**

In `src/components/SpectrogramView.tsx`, replace the current `.playback-time` block with:

```tsx
<div className="playback-time">
  <span>{formatTime(currentTimeMs)}</span>
  <span>/</span>
  <span>{formatTime(durationMs)}</span>
</div>
<div className="playback-rate-controls" aria-label="Playback speed">
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
<div className="loop-controls" aria-label="Loop controls">
  <button onClick={() => onLoopStartSet(currentTimeMs)}>Set Loop Start</button>
  <button onClick={() => onLoopEndSet(currentTimeMs)}>Set Loop End</button>
  {loopRange ? <button onClick={onLoopClear}>Clear Loop</button> : null}
  {loopRange ? (
    <span className="loop-summary">
      Loop {formatTime(loopRange.startMs)}-{formatTime(loopRange.endMs)}
    </span>
  ) : null}
</div>
```

Pass loop range into the navigator:

```tsx
<SpectrogramTimelineNavigator
  currentTimeMs={currentTimeMs}
  durationMs={durationMs}
  loopRange={loopRange}
  onSeek={onSeek}
  onViewportChange={updateViewport}
  viewport={activeViewport}
/>
```

- [ ] **Step 6: Render navigator loop overlay**

Modify `SpectrogramTimelineNavigatorProps`:

```ts
loopRange?: { startMs: number; endMs: number };
```

Compute:

```ts
const loopLeftPercent = loopRange ? timeToTrackPercent(loopRange.startMs, durationMs) : 0;
const loopRightPercent = loopRange ? timeToTrackPercent(loopRange.endMs, durationMs) : 0;
```

Render inside `.spectrogram-navigator-track` before the thumb:

```tsx
{loopRange ? (
  <div
    className="spectrogram-navigator-loop-range"
    data-testid="spectrogram-navigator-loop-range"
    style={{
      left: `${loopLeftPercent}%`,
      width: `${Math.max(0, loopRightPercent - loopLeftPercent)}%`
    }}
  />
) : null}
```

- [ ] **Step 7: Add compact styles**

Add to `src/styles.css`:

```css
.playback-rate-controls,
.loop-controls {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.playback-rate-button[aria-pressed="true"] {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}

.loop-summary {
  color: #475569;
  font-size: 0.85rem;
}

.spectrogram-navigator-loop-range {
  background: rgba(245, 158, 11, 0.28);
  border-inline: 1px solid rgba(180, 83, 9, 0.75);
  bottom: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
}
```

- [ ] **Step 8: Update existing SpectrogramView test renders**

For every existing `SpectrogramView` render in `src/components/SpectrogramView.test.tsx`, add:

```tsx
loopRange={undefined}
onLoopClear={vi.fn()}
onLoopEndSet={vi.fn()}
onLoopStartSet={vi.fn()}
onPlaybackRateChange={vi.fn()}
onViewportChange={vi.fn()}
```

Keep the existing `onPlaybackToggle` and `onSeek` props unchanged.

- [ ] **Step 9: Run component tests**

Run:

```powershell
npm test -- src/components/SpectrogramView.test.tsx src/components/SpectrogramTimelineNavigator.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit spectrogram controls**

Run:

```powershell
git add -- src/components/SpectrogramView.tsx src/components/SpectrogramView.test.tsx src/components/SpectrogramTimelineNavigator.tsx src/components/SpectrogramTimelineNavigator.test.tsx src/styles.css
git commit -m "Add focused timeline playback controls"
```

## Task 3: Workbench Playback Workspace Coordination

**Files:**
- Modify: `src/components/WorkbenchShell.tsx`
- Modify: `src/components/WorkbenchShell.test.tsx`

- [ ] **Step 1: Write failing WorkbenchShell tests**

Add tests to `src/components/WorkbenchShell.test.tsx`:

```ts
it("changes playback rate through the playback service and reports workspace updates", async () => {
  const user = userEvent.setup();
  const project = createMockProjectSummary();
  const setPlaybackRate = vi.fn().mockResolvedValue(undefined);
  const onWorkspaceChange = vi.fn();
  const audioFacade = {
    ...mockProjectAudioFacade,
    playback: {
      ...mockProjectAudioFacade.playback,
      getState: vi.fn(() => ({
        isPlaying: false,
        currentTimeMs: 3_000,
        playbackRate: 1
      })),
      setPlaybackRate
    }
  };

  render(
    <WorkbenchShell
      project={project}
      audioFacade={audioFacade}
      onWorkspaceChange={onWorkspaceChange}
    />
  );

  await user.click(screen.getByRole("button", { name: "0.75x" }));

  expect(setPlaybackRate).toHaveBeenCalledWith(0.75);
  expect(onWorkspaceChange).toHaveBeenCalledWith({
    playbackRate: 0.75
  });
});

it("uses an existing loop start when setting a loop end, then clears the range", async () => {
  const user = userEvent.setup();
  const project = {
    ...createMockProjectSummary(),
    workspace: {
      ...createMockProjectSummary().workspace,
      loopRange: {
        startMs: 1_000,
        endMs: 4_000
      }
    }
  };
  const setLoopRange = vi.fn().mockResolvedValue(undefined);
  const clearLoopRange = vi.fn().mockResolvedValue(undefined);
  const onWorkspaceChange = vi.fn();
  const audioFacade = {
    ...mockProjectAudioFacade,
    playback: {
      ...mockProjectAudioFacade.playback,
      clearLoopRange,
      getState: vi.fn(() => ({
        isPlaying: false,
        currentTimeMs: 3_000,
        playbackRate: 1,
        loopRange: {
          startMs: 1_000,
          endMs: 4_000
        }
      })),
      setLoopRange
    }
  };

  render(
    <WorkbenchShell
      project={project}
      audioFacade={audioFacade}
      onWorkspaceChange={onWorkspaceChange}
    />
  );

  await user.click(screen.getByRole("button", { name: "Set Loop End" }));

  expect(setLoopRange).toHaveBeenCalledWith(1_000, 3_000);
  expect(onWorkspaceChange).toHaveBeenLastCalledWith({
    loopRange: {
      startMs: 1_000,
      endMs: 3_000
    }
  });

  await user.click(screen.getByRole("button", { name: "Clear Loop" }));

  expect(clearLoopRange).toHaveBeenCalledOnce();
  expect(onWorkspaceChange).toHaveBeenLastCalledWith({
    loopRange: undefined
  });
});

it("reports viewport changes for persistence", () => {
  const project = createMockProjectSummary();
  const onWorkspaceChange = vi.fn();

  render(
    <WorkbenchShell
      project={project}
      audioFacade={mockProjectAudioFacade}
      onWorkspaceChange={onWorkspaceChange}
      spectrogramOverview={createSpectrogramOverview()}
    />
  );

  fireEvent.wheel(document.querySelector(".spectrogram-canvas-frame") as HTMLElement, {
    ctrlKey: true,
    deltaY: -100,
    clientX: 250
  });

  expect(onWorkspaceChange).toHaveBeenCalledWith({
    spectrogramViewport: expect.objectContaining({
      startMs: expect.any(Number),
      durationMs: expect.any(Number)
    })
  });
});
```

Add `fireEvent` to the Testing Library import:

```ts
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
```

- [ ] **Step 2: Run WorkbenchShell tests to verify failure**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: FAIL because `onWorkspaceChange` and new SpectrogramView props are not wired.

- [ ] **Step 3: Add workspace callback prop**

Modify `WorkbenchShellProps` in `src/components/WorkbenchShell.tsx`:

```ts
import type { WorkspaceState } from "../domain/project/types";

interface WorkbenchShellProps {
  project: ProjectSummary | null;
  audioFacade?: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  spectrogramOverview?: SpectrogramOverview | null;
  importError?: string | null;
  onWorkspaceChange?: (workspacePatch: Partial<WorkspaceState>) => void;
}
```

Default it in the function parameters:

```ts
onWorkspaceChange = () => {}
```

- [ ] **Step 4: Implement playback rate handler**

Add inside `WorkbenchShell`:

```ts
async function handlePlaybackRateChange(rate: number) {
  await audioFacade.playback.setPlaybackRate(rate);
  setPlaybackState(audioFacade.playback.getState());
  onWorkspaceChange({ playbackRate: rate });
}
```

- [ ] **Step 5: Implement loop handlers**

Add local pending loop start state:

```ts
const [pendingLoopStartMs, setPendingLoopStartMs] = useState<number | null>(null);
```

Add handlers:

```ts
function handleLoopStartSet(timeMs: number) {
  setPendingLoopStartMs(timeMs);
}

async function handleLoopEndSet(timeMs: number) {
  const startMs = pendingLoopStartMs ?? playbackState.loopRange?.startMs;
  if (typeof startMs !== "number" || timeMs <= startMs) {
    return;
  }

  const loopRange = {
    startMs,
    endMs: timeMs
  };

  await audioFacade.playback.setLoopRange(loopRange.startMs, loopRange.endMs);
  setPlaybackState(audioFacade.playback.getState());
  onWorkspaceChange({ loopRange });
}

async function handleLoopClear() {
  await audioFacade.playback.clearLoopRange();
  setPendingLoopStartMs(null);
  setPlaybackState(audioFacade.playback.getState());
  onWorkspaceChange({ loopRange: undefined });
}
```

- [ ] **Step 6: Pass focused controls into SpectrogramView**

Update the `SpectrogramView` call:

```tsx
<SpectrogramView
  currentTimeMs={playbackState.currentTimeMs}
  durationMs={durationMs}
  isPlaying={playbackState.isPlaying}
  loopRange={playbackState.loopRange ?? project.workspace.loopRange}
  onLoopClear={handleLoopClear}
  onLoopEndSet={handleLoopEndSet}
  onLoopStartSet={handleLoopStartSet}
  onPlaybackRateChange={handlePlaybackRateChange}
  onPlaybackToggle={handlePlaybackToggle}
  onSeek={handleSeek}
  onViewportChange={(spectrogramViewport) => onWorkspaceChange({ spectrogramViewport })}
  playbackRate={playbackState.playbackRate}
  spectrogramOverview={spectrogramOverview}
  viewport={project.workspace.spectrogramViewport}
  waveformOverview={waveformOverview}
/>
```

- [ ] **Step 7: Run WorkbenchShell tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit workbench coordination**

Run:

```powershell
git add -- src/components/WorkbenchShell.tsx src/components/WorkbenchShell.test.tsx
git commit -m "Wire workspace playback controls"
```

## Task 4: App Persistence And Open Restore

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing App tests for import defaults and save updates**

Add these tests to `src/App.test.tsx` inside the existing describe block:

```ts
it("saves focused workspace changes after playback rate updates", async () => {
  const audioData = new ArrayBuffer(8);
  window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
    audioData,
    filePath: "D:\\Music Library\\demo track.wav"
  });
  window.ziqiApp.saveProject = vi.fn().mockResolvedValue(null);
  renderApp();

  menuCommandListener?.("import-audio");
  await waitFor(() => {
    expect(screen.getByText("demo track")).toBeTruthy();
  });

  await userEvent.click(screen.getByRole("button", { name: "0.75x" }));
  menuCommandListener?.("save-project");

  await waitFor(() => {
    expect(window.ziqiApp.saveProject).toHaveBeenCalledWith(expect.objectContaining({
      project: expect.objectContaining({
        workspace: expect.objectContaining({
          playbackRate: 0.75,
          spectrogramViewport: {
            startMs: 0,
            durationMs: 10_000
          }
        })
      })
    }));
  });
});

it("creates imported projects with no loop range and default playback rate", async () => {
  renderApp();

  menuCommandListener?.("import-audio");
  await waitFor(() => {
    expect(screen.getByText("demo track")).toBeTruthy();
  });

  menuCommandListener?.("save-project");

  await waitFor(() => {
    expect(window.ziqiApp.saveProject).toHaveBeenCalledWith(expect.objectContaining({
      project: expect.objectContaining({
        workspace: expect.not.objectContaining({
          loopRange: expect.anything()
        })
      })
    }));
  });
});
```

Add the missing import:

```ts
import userEvent from "@testing-library/user-event";
```

- [ ] **Step 2: Write failing App test for project open restoration**

Add:

```ts
it("restores focused workspace playback state after opening a project", async () => {
  const openedAudioData = new ArrayBuffer(8);
  const openedProject = createProjectSummary("audio/demo track.wav");
  openedProject.workspace = {
    ...openedProject.workspace,
    playbackRate: 0.75,
    loopRange: {
      startMs: 1_000,
      endMs: 4_000
    },
    spectrogramViewport: {
      startMs: 2_000,
      durationMs: 5_000
    }
  };
  window.ziqiApp.openProject = vi.fn().mockResolvedValue({
    audioData: openedAudioData,
    project: openedProject,
    projectFilePath: "D:\\Projects\\demo.ziqiproject\\demo.ziqi",
    projectRootPath: "D:\\Projects\\demo.ziqiproject"
  });
  renderApp();

  menuCommandListener?.("open-project");

  await waitFor(() => {
    expect(screen.getByText("demo track")).toBeTruthy();
  });

  expect(FakeAudioElement.instances[0].playbackRate).toBe(0.75);
  expect(screen.getByText("Loop 0:01-0:04")).toBeTruthy();
  expect(screen.getByText("0:02-0:07")).toBeTruthy();
});
```

- [ ] **Step 3: Run App tests to verify failure**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: FAIL because `App` does not persist workspace changes or restore rate/loop.

- [ ] **Step 4: Add workspace update handler in App**

Modify imports in `src/App.tsx`:

```ts
import type { ProjectSummary, WorkspaceState } from "./domain/project/types";
import { normalizeWorkspaceState } from "./domain/project/workspaceState";
```

Add inside `App`:

```ts
function handleWorkspaceChange(workspacePatch: Partial<WorkspaceState>) {
  setProject((currentProject) => {
    if (!currentProject) {
      return currentProject;
    }

    return {
      ...currentProject,
      workspace: {
        ...currentProject.workspace,
        ...workspacePatch
      }
    };
  });
}
```

Pass it to `WorkbenchShell`:

```tsx
<WorkbenchShell
  audioFacade={audioFacade}
  importError={importError}
  onWorkspaceChange={handleWorkspaceChange}
  project={project}
  spectrogramOverview={spectrogramOverview}
  waveformOverview={waveformOverview}
/>
```

- [ ] **Step 5: Normalize and restore opened project workspace**

In `handleOpenProject`, after spectrogram generation and before `activateOpenedProject`, create:

```ts
const normalizedProject = {
  ...openedProject.project,
  workspace: normalizeWorkspaceState(
    openedProject.project.workspace,
    openedProject.project.sourceAudio.durationMs
  )
};
```

Then restore runtime playback state after `audioFacade.source.load(...)` and before `audioFacade.playback.seek(0)`:

```ts
await audioFacade.playback.setPlaybackRate(normalizedProject.workspace.playbackRate);
if (normalizedProject.workspace.loopRange) {
  await audioFacade.playback.setLoopRange(
    normalizedProject.workspace.loopRange.startMs,
    normalizedProject.workspace.loopRange.endMs
  );
} else {
  await audioFacade.playback.clearLoopRange();
}
await audioFacade.playback.seek(0);
```

Use `normalizedProject` in `setProject(normalizedProject)`.

- [ ] **Step 6: Normalize imported project defaults**

In `handleImportAudio`, after `createProjectFromAudio`, normalize before setting state:

```ts
const importedProject = createProjectFromAudio({
  filePath: selectedFile.filePath,
  metadata
});

setProject({
  ...importedProject,
  workspace: normalizeWorkspaceState(importedProject.workspace, metadata.durationMs)
});
```

Also reset runtime playback state:

```ts
await audioFacade.playback.setPlaybackRate(1);
await audioFacade.playback.clearLoopRange();
await audioFacade.playback.seek(0);
```

- [ ] **Step 7: Run App tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit App persistence**

Run:

```powershell
git add -- src/App.tsx src/App.test.tsx
git commit -m "Persist focused workspace state"
```

## Task 5: Full Verification And Electron Smoke

**Files:**
- No planned source edits unless verification reveals a defect.

- [ ] **Step 1: Run full automated test suite**

Run:

```powershell
npm test
```

Expected:

```text
Test Files  16 passed
Tests       all passed
```

The exact total test count may be higher than the baseline because this plan adds tests.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite build complete without errors.

- [ ] **Step 3: Launch Electron app**

Run:

```powershell
$electron = 'D:\WORKSPACE\ZiQi\.worktrees\milestone-1-focused-workflow\node_modules\.bin\electron.cmd'
$args = @('--remote-debugging-port=9222', 'dist-electron\main.js')
$proc = Start-Process -FilePath $electron -ArgumentList $args -WorkingDirectory 'D:\WORKSPACE\ZiQi\.worktrees\milestone-1-focused-workflow' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9222/json' -TimeoutSec 5 | Select-Object -ExpandProperty Content
```

Expected: JSON output listing at least one Electron renderer target.

- [ ] **Step 4: Manual smoke the focused M1 workflow**

In the Electron window:

1. Use `File > Import Audio`.
2. Choose a real local audio file.
3. Confirm waveform and spectrogram render.
4. Press `Play`, seek on the navigator, then press `Pause`.
5. Select `0.75x` and confirm the displayed active rate changes.
6. Seek to a passage, press `Set Loop Start`, seek later, press `Set Loop End`.
7. Play through the loop end and confirm playback jumps back to the loop start.
8. Use `File > Save Project` and choose a parent folder.
9. Close or replace the current project by using `File > Open Project`.
10. Open the saved `.ziqi` file.
11. Confirm the waveform and spectrogram regenerate.
12. Confirm the `0.75x` rate, loop summary, and viewport range restore.

Expected: all checks pass without renderer errors.

- [ ] **Step 5: Fix verification-only issues if found**

If tests or smoke reveal a defect, make the smallest targeted fix in the file that owns the broken behavior, then rerun the failing command. Use a commit message that names the verification defect:

```powershell
git add -- <changed-files>
git commit -m "Fix focused workspace verification issue"
```

- [ ] **Step 6: Final status**

Run:

```powershell
git status --short
```

Expected: no uncommitted changes.

Report:

```text
Focused M1 workflow complete.
Automated tests: passing.
Build: passing.
Electron smoke: passing.
```

## Self-Review

Spec coverage:

- Playback rate UI: Task 2 renders choices; Task 3 wires playback service; Task 4 persists state.
- Single loop range: Task 2 renders controls and overlay; Task 3 wires playback service; Task 4 restores saved loop state.
- Minimal workspace persistence: Task 1 defines defaults and validation; Task 4 updates and restores project state.
- Electron runtime verification: Task 5 covers build and manual smoke.
- Out-of-scope guardrails: no task adds BPM grid, channel modes, harmonic references, EQ, markers, providers, stems, analysis providers, or LLM features.

Plan hygiene:

- No unfinished markers or open-ended "add tests" steps.
- Each code-changing task includes concrete file paths, test code, implementation snippets, commands, and expected outcomes.

Type consistency:

- `LoopRange` and `WorkspaceSpectrogramViewport` are introduced in Task 1 and reused by later tasks through `WorkspaceState`.
- `loopRange`, `spectrogramViewport`, and `playbackRate` property names match the approved design spec.
- `onWorkspaceChange` carries `Partial<WorkspaceState>` consistently from `WorkbenchShell` to `App`.
