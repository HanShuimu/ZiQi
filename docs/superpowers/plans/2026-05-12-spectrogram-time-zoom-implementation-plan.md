# Spectrogram Time Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add horizontal time zoom and pan to the spectrogram, with a default 10 second viewport and an all-track navigation bar.

**Architecture:** Keep spectrogram analysis data unchanged and add a runtime-only viewport for rendering. Put pure viewport math in a focused helper module, keep React interaction wiring in `SpectrogramView`, and add a small navigator component for all-track positioning.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, jsdom, CSS.

---

## File Structure

- Create `src/components/spectrogramViewport.ts`
  - Owns viewport constants, clamping, default viewport creation, zoom math, pan math, time-to-percent mapping, frame filtering, waveform filtering, and time labels.
  - Has no React or DOM dependency.
- Create `src/components/spectrogramViewport.test.ts`
  - Tests the pure viewport rules before any component wiring.
- Create `src/components/SpectrogramTimelineNavigator.tsx`
  - Renders the all-track navigation bar, playhead, viewport slider, and time labels.
  - Emits viewport updates through `onViewportChange`.
- Create `src/components/SpectrogramTimelineNavigator.test.tsx`
  - Tests click and drag behavior for the navigator.
- Modify `src/components/SpectrogramView.tsx`
  - Stores viewport state, draws only the visible time window, handles wheel interactions, hides the main playhead outside the viewport, and renders the navigator.
- Modify `src/components/SpectrogramView.test.tsx`
  - Tests viewport rendering, wheel zoom/pan, cursor visibility, and navigator integration.
- Modify `src/styles.css`
  - Adds restrained styles for the navigator and viewport slider.
- Modify `electron/projectFiles.test.ts`
  - Adds a regression assertion that serialized `.ziqi` payloads do not contain viewport or zoom/pan state.

---

### Task 1: Add Pure Spectrogram Viewport Math

**Files:**
- Create: `src/components/spectrogramViewport.ts`
- Create: `src/components/spectrogramViewport.test.ts`

- [ ] **Step 1: Write failing tests for viewport math**

Create `src/components/spectrogramViewport.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import type { SpectrogramOverview, WaveformOverview } from "../domain/audio/types";
import {
  createDefaultSpectrogramViewport,
  filterSpectrogramFramesForViewport,
  filterWaveformPointsForViewport,
  formatTimeLabel,
  formatViewportRange,
  isTimeInsideViewport,
  panSpectrogramViewport,
  timeToViewportPercent,
  zoomSpectrogramViewport
} from "./spectrogramViewport";

function createSpectrogramOverview(): SpectrogramOverview {
  return {
    durationMs: 20_000,
    framesPerSecond: 10,
    minFrequencyHz: 27.5,
    maxFrequencyHz: 4186,
    binsPerFrame: 2,
    frames: [
      { startMs: 0, endMs: 100, magnitudes: [0.1, 0.2] },
      { startMs: 9_900, endMs: 10_000, magnitudes: [0.3, 0.4] },
      { startMs: 10_000, endMs: 10_100, magnitudes: [0.5, 0.6] },
      { startMs: 19_900, endMs: 20_000, magnitudes: [0.7, 0.8] }
    ]
  };
}

function createWaveformOverview(): WaveformOverview {
  return {
    durationMs: 20_000,
    pointsPerSecond: 2,
    points: [
      { startMs: 0, endMs: 500, peak: 0.2 },
      { startMs: 9_500, endMs: 10_000, peak: 0.4 },
      { startMs: 10_000, endMs: 10_500, peak: 0.8 },
      { startMs: 19_500, endMs: 20_000, peak: 0.5 }
    ]
  };
}

describe("spectrogram viewport helpers", () => {
  it("defaults long audio to a 10 second viewport", () => {
    expect(createDefaultSpectrogramViewport(20_000)).toEqual({
      startMs: 0,
      durationMs: 10_000
    });
  });

  it("defaults short audio to its full duration", () => {
    expect(createDefaultSpectrogramViewport(8_000)).toEqual({
      startMs: 0,
      durationMs: 8_000
    });
  });

  it("returns a non-interactive zero viewport for invalid durations", () => {
    expect(createDefaultSpectrogramViewport(0)).toEqual({
      startMs: 0,
      durationMs: 0
    });
    expect(createDefaultSpectrogramViewport(Number.NaN)).toEqual({
      startMs: 0,
      durationMs: 0
    });
  });

  it("zooms around the mouse anchor and keeps the anchor time stable", () => {
    const zoomed = zoomSpectrogramViewport({
      viewport: { startMs: 0, durationMs: 10_000 },
      totalDurationMs: 20_000,
      anchorRatio: 0.25,
      deltaY: -100
    });

    expect(zoomed.durationMs).toBeLessThan(10_000);
    expect(timeToViewportPercent(2_500, zoomed)).toBeCloseTo(25, 0);
  });

  it("clamps zoom between one second and the full duration", () => {
    const fullyZoomedIn = zoomSpectrogramViewport({
      viewport: { startMs: 5_000, durationMs: 1_100 },
      totalDurationMs: 20_000,
      anchorRatio: 0.5,
      deltaY: -10_000
    });
    const fullyZoomedOut = zoomSpectrogramViewport({
      viewport: { startMs: 5_000, durationMs: 5_000 },
      totalDurationMs: 20_000,
      anchorRatio: 0.5,
      deltaY: 10_000
    });

    expect(fullyZoomedIn.durationMs).toBe(1_000);
    expect(fullyZoomedOut).toEqual({ startMs: 0, durationMs: 20_000 });
  });

  it("pans by a ratio of the current viewport width and clamps to bounds", () => {
    expect(
      panSpectrogramViewport({
        viewport: { startMs: 5_000, durationMs: 10_000 },
        totalDurationMs: 20_000,
        direction: 1
      })
    ).toEqual({ startMs: 6_000, durationMs: 10_000 });

    expect(
      panSpectrogramViewport({
        viewport: { startMs: 15_000, durationMs: 10_000 },
        totalDurationMs: 20_000,
        direction: 1
      })
    ).toEqual({ startMs: 10_000, durationMs: 10_000 });
  });

  it("filters frames and waveform points to the viewport", () => {
    const viewport = { startMs: 9_900, durationMs: 200 };

    expect(filterSpectrogramFramesForViewport(createSpectrogramOverview(), viewport)).toEqual([
      { startMs: 9_900, endMs: 10_000, magnitudes: [0.3, 0.4] },
      { startMs: 10_000, endMs: 10_100, magnitudes: [0.5, 0.6] }
    ]);
    expect(filterWaveformPointsForViewport(createWaveformOverview(), viewport)).toEqual([
      { startMs: 9_500, endMs: 10_000, peak: 0.4 },
      { startMs: 10_000, endMs: 10_500, peak: 0.8 }
    ]);
  });

  it("maps and formats visible time values", () => {
    const viewport = { startMs: 10_000, durationMs: 10_000 };

    expect(timeToViewportPercent(12_500, viewport)).toBe(25);
    expect(isTimeInsideViewport(20_000, viewport)).toBe(true);
    expect(isTimeInsideViewport(20_001, viewport)).toBe(false);
    expect(formatTimeLabel(65_250)).toBe("1:05");
    expect(formatViewportRange(viewport)).toBe("0:10-0:20");
  });
});
```

- [ ] **Step 2: Run viewport tests to verify they fail**

Run:

```bash
npm test -- src/components/spectrogramViewport.test.ts
```

Expected: FAIL because `src/components/spectrogramViewport.ts` does not exist.

- [ ] **Step 3: Add the viewport helper implementation**

Create `src/components/spectrogramViewport.ts` with:

```ts
import type { SpectrogramOverview, WaveformOverview } from "../domain/audio/types";

export interface SpectrogramViewport {
  startMs: number;
  durationMs: number;
}

export const DEFAULT_SPECTROGRAM_VIEWPORT_DURATION_MS = 10_000;
export const MIN_SPECTROGRAM_VIEWPORT_DURATION_MS = 1_000;
const WHEEL_ZOOM_STEP = 1.2;
const PAN_STEP_RATIO = 0.1;

export function createDefaultSpectrogramViewport(totalDurationMs: number): SpectrogramViewport {
  if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
    return { startMs: 0, durationMs: 0 };
  }

  return {
    startMs: 0,
    durationMs: Math.min(DEFAULT_SPECTROGRAM_VIEWPORT_DURATION_MS, totalDurationMs)
  };
}

export function clampSpectrogramViewport(
  viewport: SpectrogramViewport,
  totalDurationMs: number
): SpectrogramViewport {
  if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
    return { startMs: 0, durationMs: 0 };
  }

  const minDurationMs = Math.min(MIN_SPECTROGRAM_VIEWPORT_DURATION_MS, totalDurationMs);
  const durationMs = Math.min(
    totalDurationMs,
    Math.max(minDurationMs, Math.round(viewport.durationMs))
  );
  const maxStartMs = Math.max(0, totalDurationMs - durationMs);
  const startMs = Math.min(maxStartMs, Math.max(0, Math.round(viewport.startMs)));

  return { startMs, durationMs };
}

export function zoomSpectrogramViewport({
  viewport,
  totalDurationMs,
  anchorRatio,
  deltaY
}: {
  viewport: SpectrogramViewport;
  totalDurationMs: number;
  anchorRatio: number;
  deltaY: number;
}) {
  if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0 || viewport.durationMs <= 0) {
    return { startMs: 0, durationMs: 0 };
  }

  const boundedAnchorRatio = Math.min(1, Math.max(0, anchorRatio));
  const zoomFactor = deltaY < 0 ? 1 / WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP;
  const nextDurationMs = viewport.durationMs * zoomFactor;
  const anchorTimeMs = viewport.startMs + viewport.durationMs * boundedAnchorRatio;
  const nextStartMs = anchorTimeMs - nextDurationMs * boundedAnchorRatio;

  return clampSpectrogramViewport(
    {
      startMs: nextStartMs,
      durationMs: nextDurationMs
    },
    totalDurationMs
  );
}

export function panSpectrogramViewport({
  viewport,
  totalDurationMs,
  direction
}: {
  viewport: SpectrogramViewport;
  totalDurationMs: number;
  direction: number;
}) {
  return clampSpectrogramViewport(
    {
      ...viewport,
      startMs: viewport.startMs + viewport.durationMs * PAN_STEP_RATIO * direction
    },
    totalDurationMs
  );
}

export function filterSpectrogramFramesForViewport(
  spectrogramOverview: SpectrogramOverview,
  viewport: SpectrogramViewport
) {
  const endMs = viewport.startMs + viewport.durationMs;

  return spectrogramOverview.frames.filter(
    (frame) => frame.endMs > viewport.startMs && frame.startMs < endMs
  );
}

export function filterWaveformPointsForViewport(
  waveformOverview: WaveformOverview | null | undefined,
  viewport: SpectrogramViewport
) {
  const points = waveformOverview?.points ?? [];
  const endMs = viewport.startMs + viewport.durationMs;

  return points.filter((point) => point.endMs > viewport.startMs && point.startMs < endMs);
}

export function timeToViewportPercent(timeMs: number, viewport: SpectrogramViewport) {
  if (viewport.durationMs <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, ((timeMs - viewport.startMs) / viewport.durationMs) * 100));
}

export function timeToTrackPercent(timeMs: number, totalDurationMs: number) {
  if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (timeMs / totalDurationMs) * 100));
}

export function isTimeInsideViewport(timeMs: number, viewport: SpectrogramViewport) {
  return timeMs >= viewport.startMs && timeMs <= viewport.startMs + viewport.durationMs;
}

export function formatTimeLabel(timeMs: number) {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatViewportRange(viewport: SpectrogramViewport) {
  return `${formatTimeLabel(viewport.startMs)}-${formatTimeLabel(
    viewport.startMs + viewport.durationMs
  )}`;
}
```

- [ ] **Step 4: Run viewport tests to verify they pass**

Run:

```bash
npm test -- src/components/spectrogramViewport.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit viewport helper**

Run:

```bash
git add -- src/components/spectrogramViewport.ts src/components/spectrogramViewport.test.ts
git commit -m "Add spectrogram viewport math"
```

Expected: Commit succeeds with only the helper and its tests.

---

### Task 2: Render the Main Spectrogram Through the Viewport

**Files:**
- Modify: `src/components/SpectrogramView.tsx`
- Modify: `src/components/SpectrogramView.test.tsx`

- [ ] **Step 1: Add failing component tests for default viewport rendering**

In `src/components/SpectrogramView.test.tsx`, update the imports:

```ts
import { cleanup, render, screen, within } from "@testing-library/react";
```

Update `createWaveformOverview()` so it includes points inside and outside the first 10 seconds:

```ts
function createWaveformOverview(): WaveformOverview {
  return {
    pointsPerSecond: 1,
    durationMs: 12_000,
    points: [
      { startMs: 0, endMs: 1_000, peak: 0.2 },
      { startMs: 9_000, endMs: 10_000, peak: 0.8 },
      { startMs: 10_000, endMs: 11_000, peak: 0.4 }
    ]
  };
}
```

Update `createSpectrogramOverview()` so one frame falls outside the default 10 second viewport:

```ts
function createSpectrogramOverview(): SpectrogramOverview {
  return {
    durationMs: 12_000,
    framesPerSecond: 1,
    minFrequencyHz: 27.5,
    maxFrequencyHz: 4186,
    binsPerFrame: 4,
    frames: [
      { startMs: 0, endMs: 1_000, magnitudes: [0, 0.25, 0.5, 1] },
      { startMs: 9_000, endMs: 10_000, magnitudes: [1, 0.5, 0.25, 0] },
      { startMs: 10_000, endMs: 11_000, magnitudes: [0.25, 0.25, 0.25, 0.25] }
    ]
  };
}
```

Add this test:

```ts
it("defaults long audio to a 10 second viewport for drawing and waveform points", () => {
  render(
    <SpectrogramView
      currentTimeMs={3_000}
      durationMs={12_000}
      spectrogramOverview={createSpectrogramOverview()}
      waveformOverview={createWaveformOverview()}
    />
  );

  const waveform = screen.getByRole("img", { name: "Audio waveform overview" });
  expect(within(waveform).getAllByTestId("waveform-point")).toHaveLength(2);

  const canvas = screen.getByRole("img", { name: "Audio spectrogram" }) as HTMLCanvasElement;
  const binDrawCalls = drawCalls.filter(
    (call) =>
      !(
        call.x === 0 &&
        call.y === 0 &&
        call.width === canvas.width &&
        call.height === canvas.height
      )
  );

  expect(binDrawCalls).toHaveLength(8);
});
```

Add this test:

```ts
it("hides the main spectrogram cursor when playback is outside the viewport", () => {
  render(
    <SpectrogramView
      currentTimeMs={11_000}
      durationMs={12_000}
      spectrogramOverview={createSpectrogramOverview()}
      waveformOverview={createWaveformOverview()}
    />
  );

  expect(screen.queryByTestId("spectrogram-cursor")).toBeNull();
});
```

- [ ] **Step 2: Run component tests to verify they fail**

Run:

```bash
npm test -- src/components/SpectrogramView.test.tsx
```

Expected: FAIL because `SpectrogramView` still renders the whole song and always shows the main cursor.

- [ ] **Step 3: Wire viewport state and filtered rendering**

In `src/components/SpectrogramView.tsx`, change the React import:

```ts
import { useEffect, useMemo, useRef, useState } from "react";
```

Add imports from the helper:

```ts
import {
  createDefaultSpectrogramViewport,
  filterSpectrogramFramesForViewport,
  filterWaveformPointsForViewport,
  isTimeInsideViewport,
  timeToViewportPercent
} from "./spectrogramViewport";
```

Inside `SpectrogramView`, after the `canvasRef` line, add:

```ts
const [viewport, setViewport] = useState(() => createDefaultSpectrogramViewport(durationMs));

useEffect(() => {
  setViewport(createDefaultSpectrogramViewport(durationMs));
}, [durationMs, spectrogramOverview]);
```

Replace the current `renderedWaveformPoints` memo with:

```ts
const visibleWaveformPoints = useMemo(
  () => filterWaveformPointsForViewport(waveformOverview, viewport),
  [viewport, waveformOverview]
);
const renderedWaveformPoints = useMemo(
  () => getRenderedWaveformPoints(visibleWaveformPoints),
  [visibleWaveformPoints]
);
```

Replace `progressPercent` with:

```ts
const isPlaybackVisible = isTimeInsideViewport(currentTimeMs, viewport);
const progressPercent = isPlaybackVisible ? timeToViewportPercent(currentTimeMs, viewport) : 0;
```

Replace `timeGridLines` with:

```ts
const timeGridLines = useMemo(() => createTimeGridLines(viewport), [viewport]);
```

Inside the canvas `useEffect`, after filling the black background, add:

```ts
const visibleFrames = filterSpectrogramFramesForViewport(spectrogramOverview, viewport);
```

Replace every use of `spectrogramOverview.frames` for rendered columns with `visibleFrames`:

```ts
const renderedColumnCount = Math.min(canvas.width, visibleFrames.length);
```

```ts
const startFrameIndex = Math.floor((columnIndex * visibleFrames.length) / renderedColumnCount);
const endFrameIndex = Math.max(
  startFrameIndex + 1,
  Math.floor(((columnIndex + 1) * visibleFrames.length) / renderedColumnCount)
);
```

```ts
const magnitude = getMaxMagnitudeForColumn(
  visibleFrames,
  startFrameIndex,
  endFrameIndex,
  binIndex
);
```

Update the effect dependency list:

```ts
}, [hasSpectrogramFrames, spectrogramOverview, viewport]);
```

Render the cursors only when playback is visible. In the waveform overview, replace the cursor div with:

```tsx
{isPlaybackVisible ? (
  <div className="cursor-line cursor-line-vertical" style={{ left: `${progressPercent}%` }} />
) : null}
```

In the spectrogram canvas frame, replace the cursor div with:

```tsx
{isPlaybackVisible ? (
  <div
    className="cursor-line cursor-line-vertical"
    data-testid="spectrogram-cursor"
    style={{ left: `${progressPercent}%` }}
  />
) : null}
```

Change `getRenderedWaveformPoints` so it accepts an array:

```ts
function getRenderedWaveformPoints(points: RenderedWaveformPoint[]): RenderedWaveformPoint[] {
  if (points.length <= MAX_RENDERED_WAVEFORM_POINTS) {
    return points;
  }

  return Array.from({ length: MAX_RENDERED_WAVEFORM_POINTS }, (_, index) => {
    const startIndex = Math.floor((index * points.length) / MAX_RENDERED_WAVEFORM_POINTS);
    const endIndex = Math.floor(((index + 1) * points.length) / MAX_RENDERED_WAVEFORM_POINTS);
    const group = points.slice(startIndex, Math.max(startIndex + 1, endIndex));

    return {
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      peak: Math.max(...group.map((point) => point.peak))
    };
  });
}
```

Replace `createTimeGridLines(durationMs: number)` with:

```ts
function createTimeGridLines(viewport: { startMs: number; durationMs: number }) {
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
```

- [ ] **Step 4: Run component tests to verify they pass**

Run:

```bash
npm test -- src/components/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit viewport rendering**

Run:

```bash
git add -- src/components/SpectrogramView.tsx src/components/SpectrogramView.test.tsx
git commit -m "Render spectrogram through time viewport"
```

Expected: Commit succeeds.

---

### Task 3: Add Wheel Zoom and Horizontal Pan

**Files:**
- Modify: `src/components/SpectrogramView.tsx`
- Modify: `src/components/SpectrogramView.test.tsx`

- [ ] **Step 1: Add failing tests for wheel interactions**

In `src/components/SpectrogramView.test.tsx`, update the imports:

```ts
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
```

Add this helper near the fixtures:

```ts
function stubCanvasFrameRect(element: Element) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 1_000,
    height: 420,
    top: 0,
    right: 1_000,
    bottom: 420,
    left: 0,
    toJSON: () => ({})
  });
}
```

Add this test:

```ts
it("zooms horizontally with ctrl wheel around the mouse position", () => {
  const { container } = render(
    <SpectrogramView
      currentTimeMs={2_500}
      durationMs={12_000}
      spectrogramOverview={createLongSpectrogramOverview(12, 4)}
      waveformOverview={createWaveformOverview()}
    />
  );

  const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
  stubCanvasFrameRect(frame);

  fireEvent.wheel(frame, { ctrlKey: true, deltaY: -100, clientX: 250 });

  expect(screen.getByTestId("spectrogram-cursor").style.left).toBe("25%");
});
```

Add this test:

```ts
it("pans horizontally with horizontal wheel movement", () => {
  const { container } = render(
    <SpectrogramView
      currentTimeMs={6_000}
      durationMs={12_000}
      spectrogramOverview={createLongSpectrogramOverview(12, 4)}
      waveformOverview={createWaveformOverview()}
    />
  );

  const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
  stubCanvasFrameRect(frame);

  fireEvent.wheel(frame, { deltaX: 100, deltaY: 0, clientX: 500 });

  expect(screen.getByTestId("spectrogram-cursor").style.left).toBe("50%");
});
```

- [ ] **Step 2: Run component tests to verify they fail**

Run:

```bash
npm test -- src/components/SpectrogramView.test.tsx
```

Expected: FAIL because wheel events do not update viewport.

- [ ] **Step 3: Implement wheel interaction handlers**

In `src/components/SpectrogramView.tsx`, add helper imports:

```ts
import {
  createDefaultSpectrogramViewport,
  filterSpectrogramFramesForViewport,
  filterWaveformPointsForViewport,
  isTimeInsideViewport,
  panSpectrogramViewport,
  timeToViewportPercent,
  zoomSpectrogramViewport
} from "./spectrogramViewport";
```

Add this handler inside `SpectrogramView`, before the return:

```ts
function handleSpectrogramWheel(event: React.WheelEvent<HTMLDivElement>) {
  if (durationMs <= 0) {
    return;
  }

  if (event.ctrlKey) {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const anchorRatio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0.5;

    setViewport((currentViewport) =>
      zoomSpectrogramViewport({
        viewport: currentViewport,
        totalDurationMs: durationMs,
        anchorRatio,
        deltaY: event.deltaY
      })
    );
    return;
  }

  if (event.deltaX !== 0) {
    event.preventDefault();
    setViewport((currentViewport) =>
      panSpectrogramViewport({
        viewport: currentViewport,
        totalDurationMs: durationMs,
        direction: Math.sign(event.deltaX)
      })
    );
  }
}
```

Add the handler to the spectrogram canvas frame:

```tsx
<div className="spectrogram-canvas-frame" onWheel={handleSpectrogramWheel}>
```

- [ ] **Step 4: Run component tests to verify they pass**

Run:

```bash
npm test -- src/components/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit wheel interaction**

Run:

```bash
git add -- src/components/SpectrogramView.tsx src/components/SpectrogramView.test.tsx
git commit -m "Add spectrogram wheel zoom and pan"
```

Expected: Commit succeeds.

---

### Task 4: Add the All-Track Timeline Navigator

**Files:**
- Create: `src/components/SpectrogramTimelineNavigator.tsx`
- Create: `src/components/SpectrogramTimelineNavigator.test.tsx`
- Modify: `src/components/SpectrogramView.tsx`

- [ ] **Step 1: Write failing navigator tests**

Create `src/components/SpectrogramTimelineNavigator.test.tsx` with:

```ts
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpectrogramTimelineNavigator } from "./SpectrogramTimelineNavigator";

function stubTrackRect(element: Element) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 1_000,
    height: 32,
    top: 0,
    right: 1_000,
    bottom: 32,
    left: 0,
    toJSON: () => ({})
  });
}

describe("SpectrogramTimelineNavigator", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders track labels, viewport range, playhead, and viewport thumb", () => {
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={6_000}
        durationMs={12_000}
        onViewportChange={vi.fn()}
        viewport={{ startMs: 0, durationMs: 10_000 }}
      />
    );

    expect(screen.getByText("0:00")).toBeTruthy();
    expect(screen.getByText("0:12")).toBeTruthy();
    expect(screen.getByText("0:00-0:10")).toBeTruthy();
    expect(screen.getByTestId("spectrogram-navigator-playhead").style.left).toBe("50%");
    expect(screen.getByTestId("spectrogram-navigator-thumb").style.left).toBe("0%");
    expect(screen.getByTestId("spectrogram-navigator-thumb").style.width).toBe("83.33333333333334%");
  });

  it("moves the viewport center when clicking the track", () => {
    const onViewportChange = vi.fn();
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={0}
        durationMs={20_000}
        onViewportChange={onViewportChange}
        viewport={{ startMs: 0, durationMs: 10_000 }}
      />
    );

    const track = screen.getByTestId("spectrogram-navigator-track");
    stubTrackRect(track);

    fireEvent.pointerDown(track, { clientX: 750 });

    expect(onViewportChange).toHaveBeenCalledWith({ startMs: 10_000, durationMs: 10_000 });
  });

  it("drags the viewport thumb without changing zoom", () => {
    const onViewportChange = vi.fn();
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={0}
        durationMs={20_000}
        onViewportChange={onViewportChange}
        viewport={{ startMs: 0, durationMs: 10_000 }}
      />
    );

    const track = screen.getByTestId("spectrogram-navigator-track");
    const thumb = screen.getByTestId("spectrogram-navigator-thumb");
    stubTrackRect(track);

    fireEvent.pointerDown(thumb, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 600, pointerId: 1 });

    expect(onViewportChange).toHaveBeenLastCalledWith({
      startMs: 10_000,
      durationMs: 10_000
    });
  });
});
```

- [ ] **Step 2: Run navigator tests to verify they fail**

Run:

```bash
npm test -- src/components/SpectrogramTimelineNavigator.test.tsx
```

Expected: FAIL because the navigator component does not exist.

- [ ] **Step 3: Implement the navigator component**

Create `src/components/SpectrogramTimelineNavigator.tsx` with:

```tsx
import {
  clampSpectrogramViewport,
  formatTimeLabel,
  formatViewportRange,
  timeToTrackPercent
} from "./spectrogramViewport";
import type { SpectrogramViewport } from "./spectrogramViewport";

interface SpectrogramTimelineNavigatorProps {
  currentTimeMs: number;
  durationMs: number;
  viewport: SpectrogramViewport;
  onViewportChange(viewport: SpectrogramViewport): void;
}

export function SpectrogramTimelineNavigator({
  currentTimeMs,
  durationMs,
  viewport,
  onViewportChange
}: SpectrogramTimelineNavigatorProps) {
  if (durationMs <= 0 || viewport.durationMs <= 0) {
    return null;
  }

  const viewportLeftPercent = timeToTrackPercent(viewport.startMs, durationMs);
  const viewportWidthPercent = Math.min(100, (viewport.durationMs / durationMs) * 100);
  const playheadPercent = timeToTrackPercent(currentTimeMs, durationMs);

  function viewportForClientX(clientX: number, track: HTMLElement) {
    const bounds = track.getBoundingClientRect();
    const ratio = bounds.width > 0 ? (clientX - bounds.left) / bounds.width : 0;
    const centerMs = Math.min(1, Math.max(0, ratio)) * durationMs;

    return clampSpectrogramViewport(
      {
        startMs: centerMs - viewport.durationMs / 2,
        durationMs: viewport.durationMs
      },
      durationMs
    );
  }

  function handleTrackPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    onViewportChange(viewportForClientX(event.clientX, event.currentTarget));
  }

  function handleThumbPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const thumb = event.currentTarget;
    const track = thumb.parentElement;
    if (!(track instanceof HTMLElement)) {
      return;
    }

    const startClientX = event.clientX;
    const startViewport = viewport;
    thumb.setPointerCapture(event.pointerId);

    function handlePointerMove(pointerEvent: PointerEvent) {
      const bounds = track.getBoundingClientRect();
      const deltaRatio = bounds.width > 0 ? (pointerEvent.clientX - startClientX) / bounds.width : 0;
      onViewportChange(
        clampSpectrogramViewport(
          {
            ...startViewport,
            startMs: startViewport.startMs + deltaRatio * durationMs
          },
          durationMs
        )
      );
    }

    function handlePointerUp() {
      thumb.removeEventListener("pointermove", handlePointerMove);
      thumb.removeEventListener("pointerup", handlePointerUp);
      thumb.removeEventListener("pointercancel", handlePointerUp);
    }

    thumb.addEventListener("pointermove", handlePointerMove);
    thumb.addEventListener("pointerup", handlePointerUp);
    thumb.addEventListener("pointercancel", handlePointerUp);
  }

  return (
    <div className="spectrogram-navigator" aria-label="Spectrogram time navigator">
      <div className="spectrogram-navigator-labels">
        <span>{formatTimeLabel(0)}</span>
        <span>{formatViewportRange(viewport)}</span>
        <span>{formatTimeLabel(durationMs)}</span>
      </div>
      <div
        className="spectrogram-navigator-track"
        data-testid="spectrogram-navigator-track"
        onPointerDown={handleTrackPointerDown}
      >
        <div
          className="spectrogram-navigator-thumb"
          data-testid="spectrogram-navigator-thumb"
          onPointerDown={handleThumbPointerDown}
          style={{
            left: `${viewportLeftPercent}%`,
            width: `${viewportWidthPercent}%`
          }}
        />
        <div
          className="spectrogram-navigator-playhead"
          data-testid="spectrogram-navigator-playhead"
          style={{ left: `${playheadPercent}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run navigator tests to verify they pass**

Run:

```bash
npm test -- src/components/SpectrogramTimelineNavigator.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Render navigator from SpectrogramView**

In `src/components/SpectrogramView.tsx`, add:

```ts
import { SpectrogramTimelineNavigator } from "./SpectrogramTimelineNavigator";
```

Before the closing `</div>` of `.spectrogram-view`, render:

```tsx
<SpectrogramTimelineNavigator
  currentTimeMs={currentTimeMs}
  durationMs={durationMs}
  onViewportChange={setViewport}
  viewport={viewport}
/>
```

- [ ] **Step 6: Add SpectrogramView integration assertion**

In `src/components/SpectrogramView.test.tsx`, add this assertion to `"renders waveform strip, piano rail, time grid, and spectrogram canvas"`:

```ts
expect(screen.getByLabelText("Spectrogram time navigator")).toBeTruthy();
```

- [ ] **Step 7: Run component and navigator tests**

Run:

```bash
npm test -- src/components/SpectrogramTimelineNavigator.test.tsx src/components/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit timeline navigator**

Run:

```bash
git add -- src/components/SpectrogramTimelineNavigator.tsx src/components/SpectrogramTimelineNavigator.test.tsx src/components/SpectrogramView.tsx src/components/SpectrogramView.test.tsx
git commit -m "Add spectrogram timeline navigator"
```

Expected: Commit succeeds.

---

### Task 5: Style the Navigator and Preserve Layout Stability

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/SpectrogramTimelineNavigator.test.tsx`

- [ ] **Step 1: Add failing style contract test**

In `src/components/SpectrogramTimelineNavigator.test.tsx`, add:

```ts
it("keeps the thumb draggable when the viewport is very small", () => {
  render(
    <SpectrogramTimelineNavigator
      currentTimeMs={0}
      durationMs={120_000}
      onViewportChange={vi.fn()}
      viewport={{ startMs: 60_000, durationMs: 1_000 }}
    />
  );

  expect(screen.getByTestId("spectrogram-navigator-thumb").className).toContain(
    "spectrogram-navigator-thumb"
  );
});
```

This test is intentionally light because jsdom does not compute CSS. The CSS rule in Step 3 is the real layout guarantee.

- [ ] **Step 2: Run navigator tests**

Run:

```bash
npm test -- src/components/SpectrogramTimelineNavigator.test.tsx
```

Expected: PASS or FAIL only if the navigator class names differ from Task 4.

- [ ] **Step 3: Add navigator CSS**

Append these styles after `.spectrogram-time-grid-line` in `src/styles.css`:

```css
.spectrogram-navigator {
  display: grid;
  gap: 0.35rem;
}

.spectrogram-navigator-labels {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr) 4rem;
  align-items: center;
  color: #6e6256;
  font-size: 0.82rem;
}

.spectrogram-navigator-labels span:nth-child(2) {
  justify-self: center;
  min-width: 0;
}

.spectrogram-navigator-labels span:last-child {
  justify-self: end;
}

.spectrogram-navigator-track {
  position: relative;
  height: 28px;
  border: 1px solid #d8c8b3;
  border-radius: 8px;
  background: #fff7ef;
  overflow: hidden;
  cursor: pointer;
}

.spectrogram-navigator-thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  min-width: 18px;
  border: 1px solid rgba(185, 106, 48, 0.85);
  border-radius: 6px;
  background: rgba(244, 179, 110, 0.55);
  cursor: grab;
}

.spectrogram-navigator-thumb:active {
  cursor: grabbing;
}

.spectrogram-navigator-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(53, 34, 18, 0.72);
  pointer-events: none;
}
```

- [ ] **Step 4: Run CSS-adjacent tests**

Run:

```bash
npm test -- src/components/SpectrogramTimelineNavigator.test.tsx src/components/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit navigator styling**

Run:

```bash
git add -- src/styles.css src/components/SpectrogramTimelineNavigator.test.tsx
git commit -m "Style spectrogram timeline navigator"
```

Expected: Commit succeeds.

---

### Task 6: Guard Project Persistence Against Viewport State

**Files:**
- Modify: `electron/projectFiles.test.ts`

- [ ] **Step 1: Add failing-or-passing regression test for project payload shape**

In `electron/projectFiles.test.ts`, add this test after `"creates a .ziqi payload with a stable format and schema version"`:

```ts
it("does not serialize runtime spectrogram viewport state", () => {
  const payload = createZiqiProjectPayload(project);
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain("viewport");
  expect(serialized).not.toContain("zoom");
  expect(serialized).not.toContain("pan");
});
```

This may pass immediately. Keep it as a regression test because the feature is intentionally runtime-only.

- [ ] **Step 2: Run project file tests**

Run:

```bash
npm test -- electron/projectFiles.test.ts
```

Expected: PASS. If it fails because the serialized payload contains one of those words, inspect the payload and remove only runtime spectrogram viewport state from project serialization.

- [ ] **Step 3: Commit persistence guard**

Run:

```bash
git add -- electron/projectFiles.test.ts
git commit -m "Guard against persisting spectrogram viewport"
```

Expected: Commit succeeds.

---

### Task 7: Full Verification and Real Runtime Smoke

**Files:**
- No planned source changes.

- [ ] **Step 1: Run the focused tests**

Run:

```bash
npm test -- src/components/spectrogramViewport.test.ts src/components/SpectrogramTimelineNavigator.test.tsx src/components/SpectrogramView.test.tsx electron/projectFiles.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run Electron smoke verification**

Run the existing app build in Electron and manually verify:

```bash
npm run build
npm start
```

Expected:

- Import a real audio file longer than 10 seconds.
- The spectrogram defaults to the first 10 seconds.
- `Ctrl + vertical wheel` zooms horizontally around the mouse position.
- A true horizontal wheel moves the viewport left and right.
- The timeline navigator thumb moves the viewport without changing zoom.
- Clicking the navigator track moves the viewport near the clicked time.
- Playback does not auto-scroll the viewport.
- The main playhead is visible only while playback is inside the viewport.
- The navigator playhead remains visible.
- Saving and reopening a project resets the viewport to the default 10 second window.

- [ ] **Step 5: Final commit if smoke fixes were needed**

If Step 4 required small fixes, commit only those fixes:

```bash
git add -- src/components src/styles.css electron/projectFiles.test.ts
git commit -m "Stabilize spectrogram time zoom"
```

Expected: Commit is only needed if smoke verification revealed an issue.

---

## Self-Review

Spec coverage:

- Default 10 second viewport: Task 1 and Task 2.
- Short audio shows full duration: Task 1.
- `Ctrl + vertical wheel` zoom: Task 3.
- Mouse-centered zoom: Task 1 and Task 3.
- True horizontal wheel pan: Task 1 and Task 3.
- Navigator drag and click: Task 4.
- Playback does not auto-scroll viewport: Task 2 keeps playback independent from viewport, Task 7 smoke verifies.
- Frequency axis remains A0-C8: Task 2 does not change piano axis or frequency mapping.
- Runtime-only state, no `.ziqi` persistence: Task 6.
- No vertical zoom, no Shift wheel, no mini waveform: no tasks add these.

Red-flag scan:

- The plan contains no incomplete markers or missing-detail markers.

Type consistency:

- `SpectrogramViewport` has `startMs` and `durationMs` in every task.
- Helper names used by tests and components match the helper implementation.
- Navigator props are consistent across tests and `SpectrogramView`.
