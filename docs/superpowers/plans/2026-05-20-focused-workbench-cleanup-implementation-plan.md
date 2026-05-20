# Focused Workbench Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refocus the loaded-project workbench into a single primary spectrum workspace with minimal topbar metadata, grouped controls above the waveform, aligned waveform/spectrogram/navigator rows, high-contrast playhead styling, and a dual-track navigator.

**Architecture:** Keep runtime ownership where it already lives: `SpectrogramViewer` coordinates playback service state and workspace persistence, while visual subcomponents receive props and call handlers. Remove visible `ProjectSidebar` and `WorkbenchDocks` from `TranscriptionWorkspace`, extract a `WorkspaceControlZone` for scalable grouped controls, and update `SpectrogramView` plus `SpectrogramTimelineNavigator` to render the aligned time-column layout.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Electron runtime smoke after build.

---

## File Map

- Modify `src/components/WorkbenchShell.tsx`: loaded-project topbar metadata; remove preset display.
- Modify `src/components/WorkbenchShell.test.tsx`: focused workbench tests, topbar tests, control-zone tests, alignment/class tests.
- Modify `src/workspaces/transcription/TranscriptionWorkspace.tsx`: remove `ProjectSidebar` and `WorkbenchDocks` rendering; simplify layout.
- Create `src/features/spectrogramViewer/WorkspaceControlZone.tsx`: grouped playback/speed/loop control UI.
- Modify `src/features/spectrogramViewer/SpectrogramViewer.tsx`: pass control props to `WorkspaceControlZone`; keep playback/service coordination.
- Modify `src/features/spectrogramViewer/SpectrogramView.tsx`: remove inline playback control row; align waveform/spectrogram/navigator in the shared two-column grid.
- Modify `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx`: split navigator into playback progress and viewport range tracks.
- Modify `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx`: dual-track behavior and separate interaction tests.
- Modify `src/styles.css`: focused workspace layout, control-zone groups, aligned time-column grid, cyan playhead styling, dual-track navigator styling, responsive updates.

---

### Task 1: Lock Focused Workbench Shell Expectations

**Files:**
- Modify: `src/components/WorkbenchShell.test.tsx`

- [ ] **Step 1: Add focused topbar and rail/dock absence tests**

Add these tests inside `describe("WorkbenchShell transport controls", () => { ... })`, near the existing command-strip and empty-state tests:

```tsx
it("renders loaded project metadata in the topbar without preset", () => {
  const project = createMockProjectSummary();

  renderWorkbenchShell(<WorkbenchShell project={project} />);

  expect(screen.getByRole("heading", { name: "Demo Track Study" })).toBeTruthy();
  expect(screen.getByText("demo-track.wav")).toBeTruthy();
  expect(screen.getByText("4:02")).toBeTruthy();
  expect(screen.getByText("2ch")).toBeTruthy();
  expect(screen.getByText("48kHz")).toBeTruthy();
  expect(screen.queryByText(/Preset:/)).toBeNull();
  expect(screen.queryByRole("heading", { name: "Transcription Workbench" })).toBeNull();
});

it("does not render the project rail or bottom docks in the focused workspace", () => {
  const project = createMockProjectSummary();

  renderWorkbenchShell(<WorkbenchShell project={project} />);

  expect(screen.queryByText("Assets")).toBeNull();
  expect(screen.queryByText("Annotations")).toBeNull();
  expect(screen.queryByText("Vocals Stem")).toBeNull();
  expect(screen.queryByText("Possible tonic shift")).toBeNull();
  expect(screen.queryByText("Analysis")).toBeNull();
  expect(screen.queryByText("Stems")).toBeNull();
  expect(screen.queryByText("Session Notes")).toBeNull();
  expect(screen.queryByText("Compare")).toBeNull();
  expect(screen.queryByText("Hidden")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: FAIL because the current topbar still renders `Transcription Workbench` and `Preset: ...`, and the loaded workbench still renders project rail and dock content.

- [ ] **Step 3: Commit failing tests**

```powershell
git add -- src/components/WorkbenchShell.test.tsx
git commit -m "Add focused workbench shell tests"
```

---

### Task 2: Implement Topbar Metadata and Single Workspace Layout

**Files:**
- Modify: `src/components/WorkbenchShell.tsx`
- Modify: `src/workspaces/transcription/TranscriptionWorkspace.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Update `WorkbenchShell.tsx` loaded topbar**

Add helper functions below `WorkbenchShell`:

```tsx
function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatSampleRate(sampleRate: number) {
  if (sampleRate % 1000 === 0) {
    return `${sampleRate / 1000}kHz`;
  }

  return `${Math.round((sampleRate / 1000) * 10) / 10}kHz`;
}
```

Replace the loaded-project `<header className="topbar">...</header>` with:

```tsx
<header className="topbar">
  <div className="topbar-title">
    <div className="eyebrow">ZiQi Workbench</div>
    <h1>{project.name}</h1>
    <p>{project.sourceAudio.name}</p>
  </div>
  <div className="topbar-meta" aria-label="Source audio metadata">
    <span>{formatDuration(project.sourceAudio.durationMs)}</span>
    <span>{project.sourceAudio.channelCount}ch</span>
    <span>{formatSampleRate(project.sourceAudio.sampleRate)}</span>
  </div>
</header>
```

Keep the empty-project topbar unchanged.

- [ ] **Step 2: Simplify `TranscriptionWorkspace.tsx`**

Remove these imports:

```tsx
import { ProjectSidebar } from "../../features/projectSidebar/ProjectSidebar";
import { WorkbenchDocks } from "../../features/workbenchDocks/WorkbenchDocks";
```

Replace the returned JSX with:

```tsx
return (
  <main className="workspace-grid workspace-grid-focused">
    <section className="main-column">
      <SpectrogramViewer
        project={project}
        audioFacade={audioFacade}
        waveformOverview={waveformOverview}
        spectrogramOverview={spectrogramOverview}
        onWorkspaceChange={onWorkspaceChange}
      />
    </section>
  </main>
);
```

- [ ] **Step 3: Add focused layout CSS**

In `src/styles.css`, update the existing workspace CSS by adding:

```css
.topbar-title {
  min-width: 0;
}

.topbar-title p {
  color: var(--skin-text-muted);
  margin: 0.25rem 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-grid-focused {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 4: Run focused shell tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: PASS for the new topbar and rail/dock absence tests. Other tests may still pass because controls have not moved yet.

- [ ] **Step 5: Commit shell layout changes**

```powershell
git add -- src/components/WorkbenchShell.tsx src/workspaces/transcription/TranscriptionWorkspace.tsx src/styles.css
git commit -m "Focus workbench shell layout"
```

---

### Task 3: Add Control Zone Tests

**Files:**
- Modify: `src/components/WorkbenchShell.test.tsx`

- [ ] **Step 1: Update control tests to expect the grouped control zone**

Add this test before `"renders a single play toggle in the spectrum timeline controls"`:

```tsx
it("renders grouped workspace controls above the waveform", () => {
  const project = createMockProjectSummary();

  renderWorkbenchShell(<WorkbenchShell project={project} />);

  const controlZone = screen.getByLabelText("Workspace controls");
  const waveform = screen.getByRole("img", { name: "Audio waveform overview" });

  expect(controlZone.compareDocumentPosition(waveform) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText("Playback")).toBeTruthy();
  expect(screen.getByText("Speed")).toBeTruthy();
  expect(screen.getByText("Loop")).toBeTruthy();
});
```

Update existing tests that look for `"Playback timeline controls"` only if they begin to fail after the implementation. The play button, speed buttons, and loop buttons should keep their accessible names.

- [ ] **Step 2: Run tests to verify the new test fails**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: FAIL because `Workspace controls` and the group headings do not exist yet.

- [ ] **Step 3: Commit failing control-zone test**

```powershell
git add -- src/components/WorkbenchShell.test.tsx
git commit -m "Add grouped workspace control test"
```

---

### Task 4: Extract `WorkspaceControlZone`

**Files:**
- Create: `src/features/spectrogramViewer/WorkspaceControlZone.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramViewer.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramView.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Create `WorkspaceControlZone.tsx`**

Create `src/features/spectrogramViewer/WorkspaceControlZone.tsx`:

```tsx
import { Button } from "../../ui";

const PLAYBACK_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;

export interface WorkspaceControlZoneProps {
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;
  loopRange: { startMs: number; endMs: number } | undefined;
  onLoopClear: () => Promise<void> | void;
  onLoopEndSet: (timeMs: number) => Promise<void> | void;
  onLoopStartSet: (timeMs: number) => Promise<void> | void;
  onPlaybackRateChange: (rate: number) => Promise<void> | void;
  onPlaybackToggle: () => Promise<void> | void;
}

export function WorkspaceControlZone({
  currentTimeMs,
  durationMs,
  isPlaying,
  playbackRate,
  loopRange,
  onLoopClear,
  onLoopEndSet,
  onLoopStartSet,
  onPlaybackRateChange,
  onPlaybackToggle
}: WorkspaceControlZoneProps) {
  return (
    <div className="workspace-control-zone" aria-label="Workspace controls">
      <div className="workspace-control-group">
        <div className="workspace-control-label">Playback</div>
        <Button className="playback-toggle" activating={isPlaying} onClick={onPlaybackToggle}>
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <div className="playback-time">
          <span>{formatTime(currentTimeMs)}</span>
          <span>/</span>
          <span>{formatTime(durationMs)}</span>
        </div>
      </div>

      <div className="workspace-control-group" aria-label="Playback speed">
        <div className="workspace-control-label">Speed</div>
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
      </div>

      <div className="workspace-control-group" aria-label="Loop controls">
        <div className="workspace-control-label">Loop</div>
        <button onClick={() => onLoopStartSet(currentTimeMs)}>Set Loop Start</button>
        <button onClick={() => onLoopEndSet(currentTimeMs)}>Set Loop End</button>
        {loopRange ? <button onClick={onLoopClear}>Clear Loop</button> : null}
        {loopRange ? (
          <span className="loop-summary">
            Loop {formatTime(loopRange.startMs)}-{formatTime(loopRange.endMs)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Use `WorkspaceControlZone` in `SpectrogramViewer.tsx`**

Add:

```tsx
import { WorkspaceControlZone } from "./WorkspaceControlZone";
```

In the `return` block, render the control zone before `SpectrogramView`:

```tsx
<WorkspaceControlZone
  currentTimeMs={playbackState.currentTimeMs}
  durationMs={durationMs}
  isPlaying={playbackState.isPlaying}
  loopRange={playbackState.loopRange ?? project.workspace.loopRange}
  onLoopClear={handleLoopClear}
  onLoopEndSet={handleLoopEndSet}
  onLoopStartSet={handleLoopStartSet}
  onPlaybackRateChange={handlePlaybackRateChange}
  onPlaybackToggle={handlePlaybackToggle}
  playbackRate={playbackState.playbackRate}
/>
```

Place it after `.spectrum-head` and before `<SpectrogramView ... />`.

- [ ] **Step 3: Remove inline control props from `SpectrogramView.tsx`**

Remove:

```tsx
import { Button } from "../../ui";
const PLAYBACK_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;
```

Remove these props from `SpectrogramViewProps` and the function destructuring:

```tsx
isPlaying: boolean;
playbackRate: number;
onLoopClear: () => Promise<void> | void;
onLoopEndSet: (timeMs: number) => Promise<void> | void;
onLoopStartSet: (timeMs: number) => Promise<void> | void;
onPlaybackRateChange: (rate: number) => Promise<void> | void;
onPlaybackToggle: () => Promise<void> | void;
```

Remove the `formatTime` helper from `SpectrogramView.tsx`.

Delete the entire JSX block:

```tsx
<div className="playback-timeline-control" aria-label="Playback timeline controls">
  ...
</div>
```

Keep `currentTimeMs`, `durationMs`, `loopRange`, `onSeek`, and `onViewportChange` because the waveform, spectrogram, and navigator still need them.

- [ ] **Step 4: Update the `SpectrogramView` call in `SpectrogramViewer.tsx`**

Remove these props from `<SpectrogramView ... />`:

```tsx
isPlaying={playbackState.isPlaying}
onLoopClear={handleLoopClear}
onLoopEndSet={handleLoopEndSet}
onLoopStartSet={handleLoopStartSet}
onPlaybackRateChange={handlePlaybackRateChange}
onPlaybackToggle={handlePlaybackToggle}
playbackRate={playbackState.playbackRate}
```

- [ ] **Step 5: Add control-zone CSS**

In `src/styles.css`, add:

```css
.workspace-control-zone {
  align-items: stretch;
  border: 1px solid var(--skin-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.58);
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.75rem;
}

.workspace-control-group {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  min-height: 2.6rem;
}

.workspace-control-label {
  color: var(--skin-accent);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}
```

Keep existing `.playback-time`, `.playback-rate-controls`, `.loop-controls`, `.loop-summary`, and `.playback-rate-button[aria-pressed="true"]` styles unless they become unused.

- [ ] **Step 6: Run focused shell tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: PASS. Existing play/pause, speed, loop, and spacebar tests should still pass because the controls keep their accessible names and handlers.

- [ ] **Step 7: Commit control zone extraction**

```powershell
git add -- src/features/spectrogramViewer/WorkspaceControlZone.tsx src/features/spectrogramViewer/SpectrogramViewer.tsx src/features/spectrogramViewer/SpectrogramView.tsx src/styles.css src/components/WorkbenchShell.test.tsx
git commit -m "Extract grouped workspace controls"
```

---

### Task 5: Add Navigator Dual-Track Tests

**Files:**
- Modify: `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx`

- [ ] **Step 1: Update render test for separate tracks**

Replace `"renders track labels, viewport range, playhead, and viewport thumb"` with:

```tsx
it("renders labels, a playback track, a viewport track, playhead, and viewport thumb", () => {
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
  expect(screen.getByTestId("spectrogram-navigator-playback-track")).toBeTruthy();
  expect(screen.getByTestId("spectrogram-navigator-viewport-track")).toBeTruthy();
  expect(screen.getByTestId("spectrogram-navigator-playhead").style.left).toBe("50%");
  expect(screen.getByTestId("spectrogram-navigator-thumb").style.left).toBe("0%");
  expect(screen.getByTestId("spectrogram-navigator-thumb").style.width).toBe("83.33333333333334%");
});
```

- [ ] **Step 2: Update click tests to use the correct track**

In the seek tests, replace:

```tsx
const track = screen.getByTestId("spectrogram-navigator-track");
```

with:

```tsx
const track = screen.getByTestId("spectrogram-navigator-playback-track");
```

In viewport center and drag tests, replace the same line with:

```tsx
const track = screen.getByTestId("spectrogram-navigator-viewport-track");
```

- [ ] **Step 3: Run navigator tests to verify failures**

Run:

```powershell
npm test -- src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx
```

Expected: FAIL because the two new test ids do not exist yet.

- [ ] **Step 4: Commit failing navigator tests**

```powershell
git add -- src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx
git commit -m "Add dual-track navigator tests"
```

---

### Task 6: Implement Dual-Track Navigator

**Files:**
- Modify: `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Split navigator JSX into two tracks**

Replace the single `.spectrogram-navigator-track` JSX block with:

```tsx
<div
  className="spectrogram-navigator-playback-track"
  data-testid="spectrogram-navigator-playback-track"
  onPointerDown={handlePlaybackTrackPointerDown}
>
  <div
    className="spectrogram-navigator-playhead"
    data-testid="spectrogram-navigator-playhead"
    style={{ left: `${playheadPercent}%` }}
  />
</div>
<div
  className="spectrogram-navigator-viewport-track"
  data-testid="spectrogram-navigator-viewport-track"
  onPointerDown={handleViewportTrackPointerDown}
>
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
  <div
    className="spectrogram-navigator-thumb"
    data-testid="spectrogram-navigator-thumb"
    onPointerDown={handleThumbPointerDown}
    style={{
      left: `${viewportLeftPercent}%`,
      width: `${viewportWidthPercent}%`
    }}
  />
</div>
```

- [ ] **Step 2: Replace track pointer handlers**

Replace `handleTrackPointerDown` with:

```tsx
function handlePlaybackTrackPointerDown(event: React.PointerEvent<HTMLDivElement>) {
  if (event.target !== event.currentTarget || !onSeek) {
    return;
  }

  onSeek(timeForClientX(event.clientX, event.currentTarget));
}

function handleViewportTrackPointerDown(event: React.PointerEvent<HTMLDivElement>) {
  if (event.target !== event.currentTarget) {
    return;
  }

  onViewportChange(viewportForClientX(event.clientX, event.currentTarget));
}
```

Keep `timeForClientX`, `viewportForClientX`, and `handleThumbPointerDown`.

- [ ] **Step 3: Update navigator CSS**

In `src/styles.css`, replace `.spectrogram-navigator-track` with:

```css
.spectrogram-navigator-playback-track {
  cursor: pointer;
  height: 18px;
  position: relative;
}

.spectrogram-navigator-playback-track::before {
  background: #d8c8b3;
  content: "";
  height: 2px;
  left: 0;
  position: absolute;
  right: 0;
  top: 8px;
}

.spectrogram-navigator-viewport-track {
  position: relative;
  height: 28px;
  border: 1px solid #d8c8b3;
  border-radius: 8px;
  background: #fff7ef;
  overflow: hidden;
  cursor: pointer;
}
```

Update any selectors that assumed `.spectrogram-navigator-track` as the parent to work with `.spectrogram-navigator-viewport-track`.

- [ ] **Step 4: Run navigator tests**

Run:

```powershell
npm test -- src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit dual-track navigator**

```powershell
git add -- src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx src/styles.css src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx
git commit -m "Split spectrogram navigator tracks"
```

---

### Task 7: Add Alignment and Playhead Style Tests

**Files:**
- Modify: `src/components/WorkbenchShell.test.tsx`

- [ ] **Step 1: Add alignment and playhead style tests**

Add these tests after the waveform rendering test:

```tsx
it("aligns waveform, spectrum, and navigator in the shared time grid", () => {
  const project = createMockProjectSummary();

  renderWorkbenchShell(
    <WorkbenchShell
      project={project}
      audioFacade={mockProjectAudioFacade}
      spectrogramOverview={createSpectrogramOverview()}
    />
  );

  expect(document.querySelector(".spectrogram-time-grid")).toBeTruthy();
  expect(document.querySelector(".spectrogram-waveform-row")).toBeTruthy();
  expect(document.querySelector(".spectrogram-body")).toBeTruthy();
  expect(document.querySelector(".spectrogram-navigator-row")).toBeTruthy();
});

it("uses high-contrast playhead classes for waveform and spectrogram cursors", () => {
  const project = createMockProjectSummary();
  const waveformOverview: WaveformOverview = {
    pointsPerSecond: 50,
    durationMs: 120_000,
    points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
  };

  renderWorkbenchShell(
    <WorkbenchShell
      project={project}
      audioFacade={mockProjectAudioFacade}
      spectrogramOverview={createSpectrogramOverview()}
      waveformOverview={waveformOverview}
    />
  );

  expect(document.querySelector(".waveform-cursor")).toBeTruthy();
  expect(document.querySelector(".spectrogram-cursor")).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify failures**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: FAIL because the shared grid row classes and cursor-specific classes do not exist yet.

- [ ] **Step 3: Commit failing alignment/style tests**

```powershell
git add -- src/components/WorkbenchShell.test.tsx
git commit -m "Add focused spectrum alignment tests"
```

---

### Task 8: Implement Time-Column Alignment and Playhead Styling

**Files:**
- Modify: `src/features/spectrogramViewer/SpectrogramView.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Wrap visual rows in a shared grid**

In `SpectrogramView.tsx`, replace the top-level waveform, body, and navigator siblings with:

```tsx
<div className="spectrogram-time-grid">
  <div className="spectrogram-axis-spacer" />
  <div className="waveform-overview spectrogram-waveform-row" aria-label="Audio waveform overview" role="img">
    ...
    {isPlaybackVisible ? (
      <div
        className="cursor-line cursor-line-vertical waveform-cursor"
        style={{ left: `${progressPercent}%` }}
      />
    ) : null}
  </div>

  <div className="piano-axis" aria-label="Piano pitch axis">
    ...
  </div>
  <div className="spectrogram-canvas-frame" onWheel={handleSpectrogramWheel}>
    ...
    {isPlaybackVisible ? (
      <div
        className="cursor-line cursor-line-vertical spectrogram-cursor"
        data-testid="spectrogram-cursor"
        style={{ left: `${progressPercent}%` }}
      />
    ) : null}
  </div>

  <div className="spectrogram-axis-spacer" />
  <div className="spectrogram-navigator-row">
    <SpectrogramTimelineNavigator
      currentTimeMs={currentTimeMs}
      durationMs={durationMs}
      loopRange={loopRange}
      onSeek={onSeek}
      onViewportChange={updateViewport}
      viewport={activeViewport}
    />
  </div>
</div>
```

Remove the old wrapper:

```tsx
<div className="spectrogram-body">...</div>
```

or keep the `spectrogram-body` class on the piano/canvas row only if needed by tests. The plan expects `.spectrogram-body` to still exist, so wrap the piano axis and canvas frame with:

```tsx
<div className="spectrogram-body">
  ...
</div>
```

only if that wrapper can still participate in the two-column grid. The simpler implementation is to keep `.spectrogram-body` as `display: contents` in CSS.

- [ ] **Step 2: Update CSS for shared time grid**

In `src/styles.css`, add or replace:

```css
.spectrogram-time-grid {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 0.5rem;
}

.spectrogram-axis-spacer {
  min-width: 0;
}

.spectrogram-body {
  display: contents;
}

.spectrogram-waveform-row,
.spectrogram-navigator-row {
  min-width: 0;
}
```

Remove the old `.spectrogram-body` rule that set:

```css
display: grid;
grid-template-columns: 52px minmax(0, 1fr);
gap: 0.5rem;
height: var(--spectrogram-display-height);
```

Keep height on `.piano-axis` and `.spectrogram-canvas-frame`.

- [ ] **Step 3: Update playhead color CSS**

Replace the existing `.cursor-line-vertical` background with:

```css
.cursor-line-vertical {
  top: 0;
  bottom: 0;
  left: 38%;
  width: 2px;
  background: #0ea5e9;
}

.spectrogram-cursor {
  background: #38bdf8;
  box-shadow:
    0 0 8px rgba(56, 189, 248, 0.8),
    0 0 0 1px rgba(255, 255, 255, 0.45);
}

.waveform-cursor {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7);
}
```

Update `.spectrogram-navigator-playhead` to:

```css
.spectrogram-navigator-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #0ea5e9;
  pointer-events: none;
}
```

- [ ] **Step 4: Run focused shell tests**

Run:

```powershell
npm test -- src/components/WorkbenchShell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit alignment and playhead styling**

```powershell
git add -- src/features/spectrogramViewer/SpectrogramView.tsx src/styles.css src/components/WorkbenchShell.test.tsx
git commit -m "Align spectrum timeline surfaces"
```

---

### Task 9: Full Verification and Electron Smoke

**Files:**
- No planned file changes.

- [ ] **Step 1: Run all automated tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS with TypeScript and Vite build output.

- [ ] **Step 3: Launch Electron for smoke**

Run the existing local Electron smoke launch pattern:

```powershell
$electron = 'D:\WORKSPACE\ZiQi\node_modules\.bin\electron.cmd'
$args = @('--remote-debugging-port=9222', 'dist-electron\main.js')
$proc = Start-Process -FilePath $electron -ArgumentList $args -WorkingDirectory 'D:\WORKSPACE\ZiQi' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9222/json' -TimeoutSec 5 | Select-Object -ExpandProperty Content
```

Expected: JSON listing the Electron renderer target.

- [ ] **Step 4: Manually smoke the focused workflow**

In the launched Electron app:

1. Confirm `window.ziqiApp` exists in the renderer devtools console.
2. Import or open a real audio project.
3. Confirm there is no left project rail and no bottom docks.
4. Confirm topbar shows project name, source audio name, duration, channel count, and sample rate.
5. Confirm the grouped control zone is above the waveform.
6. Confirm waveform, spectrogram, and navigator align in the same right-side time column.
7. Confirm the spectrogram playhead is blue/cyan and visible on the black background.
8. Confirm navigator has separate playback and viewport tracks.
9. Play, pause, seek, change speed, set loop start/end, clear loop.
10. Save and reopen the project, confirming playback rate, loop range, and viewport restore.

- [ ] **Step 5: Commit any verification-only fixes**

Only if verification reveals a small necessary fix:

```powershell
git add -- src/components/WorkbenchShell.tsx src/workspaces/transcription/TranscriptionWorkspace.tsx src/features/spectrogramViewer src/capabilities/timelineViewport src/styles.css src/components/WorkbenchShell.test.tsx src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx
git commit -m "Polish focused workbench cleanup"
```

If no fixes are needed, do not create a commit.

---

## Self-Review

Spec coverage:

- Rail and docks removal: Tasks 1 and 2.
- Minimal topbar metadata without preset: Tasks 1 and 2.
- Grouped control zone above waveform: Tasks 3 and 4.
- Existing playback, speed, loop behavior retained: Tasks 3 and 4.
- Shared time-column alignment: Tasks 7 and 8.
- High-contrast playhead styling: Tasks 7 and 8.
- Dual-track navigator: Tasks 5 and 6.
- Persistence behavior preserved: Tasks 4, 8, and full verification in Task 9.
- Automated tests, build, Electron smoke: Task 9.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified implementation placeholders remain.
- "Future tools" is intentional UI copy from the spec's reserved control group, not an implementation placeholder.

Type consistency:

- `WorkspaceControlZoneProps` uses existing playback and loop prop shapes from `SpectrogramView`.
- `SpectrogramTimelineNavigator` keeps existing public props and only splits internal track rendering.
- Existing `onWorkspaceChange` patch fields remain `playbackRate`, `loopRange`, and `spectrogramViewport`.
