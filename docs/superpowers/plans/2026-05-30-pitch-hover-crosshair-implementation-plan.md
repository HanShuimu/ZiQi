# Pitch Hover Crosshair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pitch-and-time hover crosshair to the pitch heatmap, with a status strip, aligned piano-key highlight, heatmap row highlight, vertical time line, and timeline time marker.

**Architecture:** Keep pointer state local to `SpectrogramView`. Extract pitch lane and pointer mapping math into a small helper module so tests can prove the piano axis, heatmap overlay, and status strip all use the same 88-lane geometry. Pass the active hover time into `SpectrogramTimelineNavigator` as an optional prop so the navigator can render a matching time marker without owning heatmap hover state.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, existing ZiQi spectrogram viewport helpers.

---

## File Structure

- Create: `src/features/spectrogramViewer/pitchHover.ts`
  - Owns pitch hover math, lane percentages, note lookup, pointer-to-time mapping, and precise time formatting.
  - Has no React dependency.
- Create: `src/features/spectrogramViewer/pitchHover.test.ts`
  - Tests pitch lane alignment, Y-to-pitch mapping, X-to-time mapping, clamping, and precise time labels.
- Modify: `src/features/spectrogramViewer/SpectrogramView.tsx`
  - Adds local hover state, status strip markup, heatmap overlays, piano-key active state, and passes hover time to the navigator.
- Modify: `src/features/spectrogramViewer/SpectrogramView.test.tsx`
  - Tests status strip placement, hover state updates, piano key active state, overlay positions, clear-on-leave, and existing playback cursor behavior.
- Modify: `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx`
  - Accepts optional `hoverTimeMs` and renders a full-timeline time marker and label while the hover time is inside the current viewport.
- Modify: `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx`
  - Tests hover time marker position, label, and no-marker behavior when hover time is absent or outside the viewport.
- Modify: `src/styles.css`
  - Adds status strip, heatmap hover overlay, active piano key, and timeline hover marker styles.

## Task 1: Add Pitch Hover Geometry Helpers

**Files:**
- Create: `src/features/spectrogramViewer/pitchHover.ts`
- Create: `src/features/spectrogramViewer/pitchHover.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/features/spectrogramViewer/pitchHover.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SpectrogramViewport } from "../../core/spectrogramViewport";
import {
  formatPreciseTimeLabel,
  getPitchHoverStateFromPoint,
  getPitchLaneStyle
} from "./pitchHover";

const viewport: SpectrogramViewport = {
  startMs: 60_000,
  durationMs: 10_000
};

const bounds = {
  left: 100,
  top: 50,
  width: 1_000,
  height: 528
};

describe("pitch hover helpers", () => {
  it("maps pitch indexes to exact 88-lane percentages", () => {
    expect(getPitchLaneStyle(0)).toEqual({
      bottomPercent: 0,
      topPercent: 98.86363636363636,
      heightPercent: 1.1363636363636365
    });
    expect(getPitchLaneStyle(87)).toEqual({
      bottomPercent: 98.86363636363636,
      topPercent: 0,
      heightPercent: 1.1363636363636365
    });
  });

  it("maps the top of the heatmap to C8 and the bottom to A0", () => {
    expect(
      getPitchHoverStateFromPoint({
        clientX: 100,
        clientY: 50,
        bounds,
        viewport
      })
    ).toMatchObject({
      pitchIndex: 87,
      midiNumber: 108,
      noteName: "C8"
    });

    expect(
      getPitchHoverStateFromPoint({
        clientX: 100,
        clientY: 577,
        bounds,
        viewport
      })
    ).toMatchObject({
      pitchIndex: 0,
      midiNumber: 21,
      noteName: "A0"
    });
  });

  it("maps pointer x to viewport time and x percent", () => {
    expect(
      getPitchHoverStateFromPoint({
        clientX: 600,
        clientY: 50 + 528 / 2,
        bounds,
        viewport
      })
    ).toMatchObject({
      xPercent: 50,
      timeMs: 65_000
    });
  });

  it("clamps pointer coordinates to the heatmap bounds", () => {
    expect(
      getPitchHoverStateFromPoint({
        clientX: -10,
        clientY: -10,
        bounds,
        viewport
      })
    ).toMatchObject({
      xPercent: 0,
      pitchIndex: 87,
      timeMs: 60_000
    });

    expect(
      getPitchHoverStateFromPoint({
        clientX: 2_000,
        clientY: 2_000,
        bounds,
        viewport
      })
    ).toMatchObject({
      xPercent: 100,
      pitchIndex: 0,
      timeMs: 70_000
    });
  });

  it("returns null when geometry or viewport cannot support hover", () => {
    expect(
      getPitchHoverStateFromPoint({
        clientX: 0,
        clientY: 0,
        bounds: { ...bounds, width: 0 },
        viewport
      })
    ).toBeNull();

    expect(
      getPitchHoverStateFromPoint({
        clientX: 0,
        clientY: 0,
        bounds,
        viewport: { startMs: 0, durationMs: 0 }
      })
    ).toBeNull();
  });

  it("formats precise time labels with milliseconds", () => {
    expect(formatPreciseTimeLabel(0)).toBe("00:00.000");
    expect(formatPreciseTimeLabel(84_320)).toBe("01:24.320");
    expect(formatPreciseTimeLabel(3_661_009)).toBe("61:01.009");
  });
});
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```powershell
npm test -- src/features/spectrogramViewer/pitchHover.test.ts
```

Expected: FAIL because `src/features/spectrogramViewer/pitchHover.ts` does not exist.

- [ ] **Step 3: Implement the helper module**

Create `src/features/spectrogramViewer/pitchHover.ts`:

```ts
import type { SpectrogramViewport } from "../../core/spectrogramViewport";
import {
  PITCH_HEATMAP_NOTE_COUNT,
  getMidiNumberForPitchIndex
} from "../../core/audio/pitchHeatmap";
import { PIANO_KEYS } from "../../services/audio/spectrogram";

export interface HeatmapPointerState {
  pitchIndex: number;
  midiNumber: number;
  noteName: string;
  frequencyHz: number;
  timeMs: number;
  xPercent: number;
  yPercent: number;
}

export interface HeatmapPointerBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getPitchLaneStyle(pitchIndex: number): {
  bottomPercent: number;
  topPercent: number;
  heightPercent: number;
} {
  const boundedPitchIndex = clampInteger(pitchIndex, 0, PITCH_HEATMAP_NOTE_COUNT - 1);
  const heightPercent = 100 / PITCH_HEATMAP_NOTE_COUNT;
  const bottomPercent = boundedPitchIndex * heightPercent;

  return {
    bottomPercent,
    topPercent: 100 - bottomPercent - heightPercent,
    heightPercent
  };
}

export function getPitchLaneCssProperties(pitchIndex: number): {
  bottom: string;
  height: string;
} {
  const laneStyle = getPitchLaneStyle(pitchIndex);

  return {
    bottom: `${laneStyle.bottomPercent}%`,
    height: `${laneStyle.heightPercent}%`
  };
}

export function getPitchHoverStateFromPoint({
  clientX,
  clientY,
  bounds,
  viewport
}: {
  clientX: number;
  clientY: number;
  bounds: HeatmapPointerBounds;
  viewport: SpectrogramViewport;
}): HeatmapPointerState | null {
  if (bounds.width <= 0 || bounds.height <= 0 || viewport.durationMs <= 0) {
    return null;
  }

  const xRatio = clamp01((clientX - bounds.left) / bounds.width);
  const yRatio = clamp01((clientY - bounds.top) / bounds.height);
  const topLaneIndex = Math.min(
    PITCH_HEATMAP_NOTE_COUNT - 1,
    Math.floor(yRatio * PITCH_HEATMAP_NOTE_COUNT)
  );
  const pitchIndex = PITCH_HEATMAP_NOTE_COUNT - 1 - topLaneIndex;
  const midiNumber = getMidiNumberForPitchIndex(pitchIndex);
  const pianoKey = PIANO_KEYS[pitchIndex];

  return {
    pitchIndex,
    midiNumber,
    noteName: pianoKey.name,
    frequencyHz: pianoKey.frequencyHz,
    timeMs: Math.round(viewport.startMs + xRatio * viewport.durationMs),
    xPercent: xRatio * 100,
    yPercent: yRatio * 100
  };
}

export function formatPreciseTimeLabel(timeMs: number) {
  const safeTimeMs = Math.max(0, Math.round(Number.isFinite(timeMs) ? timeMs : 0));
  const totalSeconds = Math.floor(safeTimeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = safeTimeMs % 1000;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
```

- [ ] **Step 4: Run helper tests and verify they pass**

Run:

```powershell
npm test -- src/features/spectrogramViewer/pitchHover.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the helper module**

Run:

```powershell
git add -- src/features/spectrogramViewer/pitchHover.ts src/features/spectrogramViewer/pitchHover.test.ts
git commit -m "Add pitch hover geometry helpers"
```

Expected: commit succeeds with only the helper and helper test files.

## Task 2: Add Status Strip and Heatmap/Piano Hover Overlays

**Files:**
- Modify: `src/features/spectrogramViewer/SpectrogramView.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramView.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing SpectrogramView hover tests**

Append these tests to `src/features/spectrogramViewer/SpectrogramView.test.tsx` inside the existing `describe("SpectrogramView", () => { ... })` block:

```ts
  it("shows an idle pitch hover status strip above the spectrogram rows", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        loopRange={undefined}
        onSeek={vi.fn()}
        onViewportChange={vi.fn()}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={createWaveformOverview()}
      />
    );

    const statusStrip = screen.getByTestId("pitch-hover-status");
    const timeGrid = container.querySelector(".spectrogram-time-grid");

    expect(statusStrip.textContent).toContain("Hover over the heatmap");
    expect(statusStrip.compareDocumentPosition(timeGrid as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("updates pitch status, piano key, and heatmap overlays on pointer move", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        loopRange={undefined}
        onSeek={vi.fn()}
        onViewportChange={vi.fn()}
        spectrogramOverview={createLongSpectrogramOverview(12, 4)}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
        waveformOverview={createWaveformOverview()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.pointerMove(frame, { clientX: 500, clientY: 160 });

    expect(screen.getByTestId("pitch-hover-status").textContent).toContain("D#5");
    expect(screen.getByTestId("pitch-hover-status").textContent).toContain("00:06.000");
    expect(screen.getByTestId("pitch-hover-row").style.bottom).toBe("61.36363636363637%");
    expect(screen.getByTestId("pitch-hover-row").style.height).toBe("1.1363636363636365%");
    expect(screen.getByTestId("pitch-hover-time-line").style.left).toBe("50%");

    const activeKey = container.querySelector(".piano-key-active") as HTMLElement;
    expect(activeKey).toBeTruthy();
    expect(activeKey.title).toBe("D#5");
    expect(activeKey.style.bottom).toBe(screen.getByTestId("pitch-hover-row").style.bottom);
  });

  it("clears pitch hover state when the pointer leaves the heatmap", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        loopRange={undefined}
        onSeek={vi.fn()}
        onViewportChange={vi.fn()}
        spectrogramOverview={createLongSpectrogramOverview(12, 4)}
        waveformOverview={createWaveformOverview()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.pointerMove(frame, { clientX: 500, clientY: 210 });
    expect(screen.getByTestId("pitch-hover-row")).toBeTruthy();

    fireEvent.pointerLeave(frame);

    expect(screen.queryByTestId("pitch-hover-row")).toBeNull();
    expect(screen.queryByTestId("pitch-hover-time-line")).toBeNull();
    expect(screen.getByTestId("pitch-hover-status").textContent).toContain("Hover over the heatmap");
    expect(container.querySelector(".piano-key-active")).toBeNull();
  });
```

- [ ] **Step 2: Run SpectrogramView tests and verify they fail**

Run:

```powershell
npm test -- src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: FAIL because the status strip and hover overlay test ids do not exist.

- [ ] **Step 3: Update SpectrogramView imports and state**

In `src/features/spectrogramViewer/SpectrogramView.tsx`, replace:

```ts
import { PIANO_KEYS, magnitudeToSpectrogramColor } from "../../services/audio/spectrogram";
```

with:

```ts
import { PIANO_KEYS, magnitudeToSpectrogramColor } from "../../services/audio/spectrogram";
import type { HeatmapPointerState } from "./pitchHover";
import {
  formatPreciseTimeLabel,
  getPitchHoverStateFromPoint,
  getPitchLaneCssProperties
} from "./pitchHover";
```

Remove this constant:

```ts
const PIANO_KEY_HEIGHT_PERCENT = 1.4;
```

Inside `SpectrogramView`, after `const canvasRef = useRef<HTMLCanvasElement | null>(null);`, add:

```ts
  const [pointerState, setPointerState] = useState<HeatmapPointerState | null>(null);
```

- [ ] **Step 4: Add pointer handlers**

In `src/features/spectrogramViewer/SpectrogramView.tsx`, add these functions before `handleSpectrogramWheel`:

```ts
  function handleHeatmapPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!hasPitchFrames) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    setPointerState(
      getPitchHoverStateFromPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        bounds,
        viewport: activeViewport
      })
    );
  }

  function handleHeatmapPointerLeave() {
    setPointerState(null);
  }
```

- [ ] **Step 5: Add the status strip markup**

In `src/features/spectrogramViewer/SpectrogramView.tsx`, inside:

```tsx
return (
  <div className="spectrogram-view" style={SPECTROGRAM_VIEW_STYLE}>
```

add this block before `<div className="spectrogram-time-grid">`:

```tsx
      <div className="pitch-hover-status" data-testid="pitch-hover-status" aria-live="polite">
        {pointerState ? (
          <>
            <span className="pitch-hover-status-label">Pointer</span>
            <strong>{pointerState.noteName}</strong>
            <span>{pointerState.frequencyHz.toFixed(2)} Hz</span>
            <span>MIDI {pointerState.midiNumber}</span>
            <span className="pitch-hover-status-time">
              {formatPreciseTimeLabel(pointerState.timeMs)}
            </span>
          </>
        ) : (
          <>
            <span className="pitch-hover-status-label">Pointer</span>
            <span>Hover over the heatmap</span>
          </>
        )}
      </div>
```

- [ ] **Step 6: Align piano keys to shared lane geometry**

In the `PIANO_KEYS.map` callback, replace:

```tsx
              const bottomPercent = getPianoKeyBottomPercent(index);
```

with:

```tsx
              const laneStyle = getPitchLaneCssProperties(index);
              const isActive = pointerState?.pitchIndex === index;
              const bottomPercent = Number.parseFloat(String(laneStyle.bottom));
```

Replace the `className` expression with:

```tsx
                  className={[
                    key.isBlackKey ? "piano-key piano-key-black" : "piano-key piano-key-white",
                    isActive ? "piano-key-active" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
```

Replace the `style` prop with:

```tsx
                  style={laneStyle}
```

Keep `data-bottom-percent={bottomPercent}` so existing tests can continue to assert the exposed value.

- [ ] **Step 7: Add heatmap overlay markup and pointer handlers**

In `src/features/spectrogramViewer/SpectrogramView.tsx`, replace:

```tsx
          <div className="spectrogram-canvas-frame" onWheel={handleSpectrogramWheel}>
```

with:

```tsx
          <div
            className="spectrogram-canvas-frame"
            onPointerLeave={handleHeatmapPointerLeave}
            onPointerMove={handleHeatmapPointerMove}
            onWheel={handleSpectrogramWheel}
          >
```

After the `spectrogram-empty` block and before `timeGridLines.map`, add:

```tsx
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
```

In the `SpectrogramTimelineNavigator` props, add:

```tsx
            hoverTimeMs={pointerState?.timeMs}
```

Remove the now-unused `getPianoKeyBottomPercent` function at the bottom of the file.

- [ ] **Step 8: Add CSS for the status strip and overlays**

In `src/styles.css`, add after the `.spectrogram-view` block:

```css
.pitch-hover-status {
  align-items: center;
  background: #fff7ef;
  border: 1px solid #d8c8b3;
  border-radius: 8px;
  color: #211d1a;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  min-height: 2.4rem;
  padding: 0.45rem 0.65rem;
}

.pitch-hover-status-label {
  color: var(--skin-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.pitch-hover-status-time {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
```

Replace the `.piano-key` height rule:

```css
  height: 1.4%;
```

with:

```css
  height: calc(100% / 88);
```

Add after `.piano-key-black`:

```css
.piano-key-active {
  background: #f2c95e;
  box-shadow: inset 0 0 0 1px rgba(25, 21, 18, 0.38);
  z-index: 2;
}
```

Add after `.spectrogram-time-grid-line`:

```css
.spectrogram-hover-row {
  background: rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.34);
  left: 0;
  pointer-events: none;
  position: absolute;
  right: 0;
}

.spectrogram-hover-time-line {
  background: rgba(255, 255, 255, 0.72);
  bottom: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  width: 2px;
}
```

- [ ] **Step 9: Run SpectrogramView tests and verify they pass**

Run:

```powershell
npm test -- src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit SpectrogramView hover UI**

Run:

```powershell
git add -- src/features/spectrogramViewer/SpectrogramView.tsx src/features/spectrogramViewer/SpectrogramView.test.tsx src/styles.css
git commit -m "Add pitch hover status and heatmap overlays"
```

Expected: commit succeeds with the SpectrogramView UI, tests, and CSS.

## Task 3: Add Timeline Hover Time Marker

**Files:**
- Modify: `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx`
- Modify: `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing timeline marker tests**

Append these tests to `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx` inside the existing `describe("SpectrogramTimelineNavigator", () => { ... })` block:

```ts
  it("renders a hover time marker when hover time is inside the viewport", () => {
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={0}
        durationMs={20_000}
        hoverTimeMs={15_000}
        onViewportChange={vi.fn()}
        viewport={{ startMs: 10_000, durationMs: 10_000 }}
      />
    );

    expect(screen.getByTestId("spectrogram-navigator-hover-time").style.left).toBe("75%");
    expect(screen.getByText("00:15.000")).toBeTruthy();
  });

  it("does not render a hover time marker outside the viewport", () => {
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={0}
        durationMs={20_000}
        hoverTimeMs={5_000}
        onViewportChange={vi.fn()}
        viewport={{ startMs: 10_000, durationMs: 10_000 }}
      />
    );

    expect(screen.queryByTestId("spectrogram-navigator-hover-time")).toBeNull();
  });
```

- [ ] **Step 2: Run navigator tests and verify they fail**

Run:

```powershell
npm test -- src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx
```

Expected: FAIL because `hoverTimeMs` is not a supported prop and the marker does not render.

- [ ] **Step 3: Update navigator imports and props**

In `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx`, replace:

```ts
  timeToTrackPercent
} from "../../core/spectrogramViewport";
```

with:

```ts
  timeToTrackPercent
} from "../../core/spectrogramViewport";
import { formatPreciseTimeLabel } from "../../features/spectrogramViewer/pitchHover";
```

In `SpectrogramTimelineNavigatorProps`, add:

```ts
  hoverTimeMs?: number;
```

In the component parameter list, add:

```ts
  hoverTimeMs,
```

after `durationMs`.

- [ ] **Step 4: Compute marker visibility and position**

After the existing `loopRightPercent` constant, add:

```ts
  const isHoverTimeVisible =
    typeof hoverTimeMs === "number" &&
    hoverTimeMs >= viewport.startMs &&
    hoverTimeMs <= viewport.startMs + viewport.durationMs;
  const hoverTimePercent = isHoverTimeVisible
    ? timeToTrackPercent(hoverTimeMs, durationMs)
    : 0;
```

- [ ] **Step 5: Render the timeline hover marker**

Inside the `spectrogram-navigator-viewport-track` div, after the `loopRange` block and before the thumb, add:

```tsx
        {isHoverTimeVisible ? (
          <div
            className="spectrogram-navigator-hover-time"
            data-testid="spectrogram-navigator-hover-time"
            style={{ left: `${hoverTimePercent}%` }}
          >
            <span>{formatPreciseTimeLabel(hoverTimeMs)}</span>
          </div>
        ) : null}
```

- [ ] **Step 6: Add CSS for the timeline hover marker**

In `src/styles.css`, add after `.spectrogram-navigator-loop-range`:

```css
.spectrogram-navigator-hover-time {
  bottom: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  width: 2px;
  background: #211d1a;
  z-index: 2;
}

.spectrogram-navigator-hover-time span {
  background: #211d1a;
  border-radius: 6px;
  color: #fffaf3;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  left: 50%;
  padding: 2px 6px;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
}
```

- [ ] **Step 7: Run navigator tests and verify they pass**

Run:

```powershell
npm test -- src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run SpectrogramView tests again**

Run:

```powershell
npm test -- src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS, including the hover tests from Task 2.

- [ ] **Step 9: Commit timeline hover marker**

Run:

```powershell
git add -- src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx src/styles.css
git commit -m "Add timeline hover time marker"
```

Expected: commit succeeds with the navigator marker and tests.

## Task 4: Verify Integration and Runtime Behavior

**Files:**
- Modify only if verification exposes a defect in files changed by Tasks 1-3.

- [ ] **Step 1: Run focused automated tests**

Run:

```powershell
npm test -- src/features/spectrogramViewer/pitchHover.test.ts
npm test -- src/features/spectrogramViewer/SpectrogramView.test.tsx
npm test -- src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx
```

Expected: all three commands PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 4: Start the local dev server**

Run:

```powershell
$proc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','--host','127.0.0.1' -WorkingDirectory 'D:\WORKSPACE\ZiQi' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 6
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173' -TimeoutSec 5 | Select-Object -ExpandProperty StatusCode
```

Expected: `200`.

- [ ] **Step 5: Verify in the browser**

Use the Browser plugin to open:

```text
http://127.0.0.1:5173
```

Manual expectations:

- The pitch hover status strip appears below the control zone and above the waveform/spectrogram rows.
- Moving the mouse vertically over the heatmap keeps the highlighted piano key and heatmap row perfectly aligned.
- Moving the mouse horizontally over the heatmap moves the vertical hover line and updates the status strip time.
- The timeline navigator shows the same hover time as a marker label.
- The existing playback cursor remains visible and visually distinct.
- Ctrl+wheel zoom and horizontal wheel pan still work over the heatmap frame.

- [ ] **Step 6: Commit any verification fix**

Only if Step 5 exposes a defect, make the smallest fix in the affected file, rerun the failing focused test, then run:

```powershell
git add -- <changed-files>
git commit -m "Fix pitch hover crosshair verification issue"
```

Expected: skip this step when verification finds no defect.

## Final Verification

Before reporting completion after execution, run:

```powershell
npm test
npm run build
```

Expected: both PASS.

Then check:

```powershell
git status --short
```

Expected: no uncommitted product-code changes except intentionally untracked `.superpowers/` visual companion files.
