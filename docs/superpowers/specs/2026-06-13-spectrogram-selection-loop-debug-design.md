# Spectrogram Selection, Loop, Ruler, and Debug Design

Date: 2026-06-13

## 1. Purpose

The current spectrum workflow makes range selection too hard. `Set Loop Start` and
`Set Loop End` require too much indirect cursor management, the playhead is not
visible enough inside the heatmap, and there is no reusable selected range model
for future LLM analysis.

This design adds a unified selected range model:

1. Click in the spectrogram to seek.
2. Ctrl-drag in the spectrogram to select a time range.
3. Use the selected range as the single source for loop playback and LLM debug
   analysis.
4. Add a slim two-row ruler above the spectrogram for natural time and musical
   bar/beat context.
5. Add an Electron native `Debug` menu with a selected-range description panel.

## 2. Goals

- Make spectrogram click-to-seek direct and obvious.
- Make the playhead clearly visible in the spectrogram and ruler.
- Replace the awkward loop start/end workflow with direct range selection.
- Persist the selected range and loop enabled state in project workspace state.
- Keep spectrum colors readable by avoiding colored fills over the spectrogram.
- Add a slim two-row ruler above the spectrogram:
  - row 1: natural time ticks;
  - row 2: bar/beat ticks calculated from workspace beat settings.
- Add a native `Debug` menu command that opens an in-app debug panel.
- Generate both natural-language and structured JSON descriptions for the
  selected range.
- Keep `SpectrogramViewer` and `SpectrogramView` from accumulating more logic by
  extracting selection, ruler, overlay, and debug summary responsibilities.

## 3. Non-Goals

- Do not add real LLM calls in this project.
- Do not implement saved markers, annotations, or a range library.
- Do not support multiple selected ranges.
- Do not preserve or migrate old `workspace.loopRange` data in this project.
- Do not restore the removed workbench dock tabs.
- Do not redesign the whole workspace control zone.
- Do not change the heatmap color algorithm.

## 4. Workspace Model

The workspace state should use a unified selection and loop model:

```ts
selectedTimeRange?: {
  startMs: number;
  endMs: number;
};

loopEnabled: boolean;
```

`selectedTimeRange` is the only current selected musical passage. It is used by:

- the spectrogram selection overlay;
- the two-row ruler selected-range highlight;
- debug and future LLM range summaries;
- loop playback when `loopEnabled` is true.

`loopEnabled` only controls playback behavior. It does not define a range.

New projects default to:

```ts
{
  loopEnabled: false,
  selectedTimeRange: undefined
}
```

Saved projects should write the new fields. Old `workspace.loopRange` is not
migrated in this project and should not be treated as the active selection.

Normalize rules:

- `selectedTimeRange` is valid only when both times are finite numbers.
- Values are rounded to integer milliseconds.
- Values are clamped to `[0, durationMs]`.
- Ranges with `endMs <= startMs` are discarded.
- `loopEnabled` is restored only when the saved value is boolean, otherwise it
  defaults to `false`.
- If no valid `selectedTimeRange` exists, `loopEnabled` should normalize to
  `false`.

## 5. Playback Semantics

The playback service should only receive an actual loop range when both are true:

- `selectedTimeRange` exists;
- `loopEnabled` is true.

When `loopEnabled` is false or the selected range is cleared, the renderer should
clear the playback service loop range.

This preserves the existing playback service rule that normal playback time is
read from the media element and only explicit seeks or loop jumps write
`currentTime`.

## 6. Spectrogram Interaction

### 6.1 Click To Seek

Plain left click in the spectrogram sets playback progress to the clicked time.
It does not clear the selected range.

The clicked time is derived from the active spectrogram viewport and the
rendered heatmap bounds:

```text
timeMs = viewport.startMs + xRatio * viewport.durationMs
```

The result is clamped to the audio duration.

### 6.2 Ctrl Drag To Select

Ctrl + left-button drag creates or replaces `selectedTimeRange`.

Rules:

- The selection previews while dragging.
- Releasing the pointer commits the normalized range to workspace state.
- Drag direction does not matter; right-to-left drag normalizes to
  `startMs < endMs`.
- A very small drag should be ignored to avoid accidental range creation.
- A later Ctrl-drag replaces the previous selected range.
- Plain clicks and non-Ctrl drags do not clear the selected range.

The initial implementation should use a simple pixel threshold. A time threshold
may be added later if needed, but it is not required for the first version.

## 7. Spectrogram Visuals

The spectrogram playhead should be much more visible:

- high-contrast cyan/blue line;
- subtle white outline or glow;
- drawn above grid and heatmap content.

The selected range inside the spectrogram should not use colored fill and should
not dim the outside area. The heatmap colors carry analysis meaning, so the range
must preserve them.

Recommended selected range treatment:

- neutral double boundary at start and end;
- white outer edge plus dark inner stroke for contrast on bright and dark
  heatmap areas;
- compact time label such as `03.200-05.900`;
- no fill over the selected spectrogram content.

## 8. Two-Row Ruler

Add a slim two-row ruler above the spectrogram in the same right-side time
column as the waveform, spectrogram canvas, and navigator.

Use the approved D1 direction:

- total height around 44 px;
- row 1: natural time ruler;
- row 2: bar/beat ruler;
- selected range highlighted in amber/gold within the ruler only;
- playhead line aligned with the spectrogram playhead;
- left axis column remains aligned with the piano axis.

### 8.1 Natural Time Row

The natural time row should generate readable ticks from the active viewport.
Ticks are not fixed left/middle/right labels.

The tick generator should choose intervals from a small "nice duration" set, for
example:

```text
50 ms, 100 ms, 200 ms, 500 ms,
1 s, 2 s, 5 s, 10 s, 15 s, 30 s,
1 min, 2 min, 5 min
```

The chosen interval should produce a reasonable number of major labels for the
current viewport width. Minor and medium ticks may be derived from the major
interval where the viewport is wide enough.

Labels should avoid overflow at the left and right edges.

### 8.2 Bar/Beat Row

The bar/beat row uses:

- `workspace.bpm`;
- `workspace.beatsPerBar`;
- `workspace.beatOffsetMs`.

Bar starts are major ticks. Beat positions inside the bar are minor ticks.

The main label format is:

```text
bar:beat
```

Examples:

```text
12:1
13:1
14:1
```

When the viewport is too dense, the row may show fewer labels while retaining
short beat ticks where readable.

## 9. Workspace Controls

Remove the primary workflow dependency on:

- `Set Loop Start`;
- `Set Loop End`.

Add a selected-state `Loop` button.

Rules:

- default is off;
- no selected range means the button is disabled or cannot activate;
- turning it on sets `loopEnabled: true`;
- turning it off sets `loopEnabled: false`;
- clearing the selected range also sets `loopEnabled: false`;
- if there is a selected range and the button is on, playback loops from
  `selectedTimeRange.endMs` back to `selectedTimeRange.startMs`.

The UI may retain a compact selected-range summary and a clear-selection command.
The clear command should clear the range and disable loop playback.

## 10. Native Debug Menu

Add an Electron native top-level `Debug` menu.

Menu order:

- Windows/Linux: `File | Debug`;
- macOS: `ZiQi | File | Debug`.

First command:

```text
Describe Selected Range for LLM
```

This command should dispatch through the existing `menu:command` pathway to the
renderer. It opens an in-app debug selection panel.

## 11. Debug Selection Panel

The panel should contain a simple one-line status area at the top.

Status text rules:

- no project: `Please open a project first.`
- project exists but no `selectedTimeRange`: `Please select a time range first.`
- selected range exists but spectrogram/pitch data is unavailable:
  `analysis unavailable`
- selected range exists and analysis is available:
  `Selected range 03.200-05.900 (2.700s)` or equivalent.

When no useful output can be generated, the panel should show the status only
and should not show empty text or JSON sections.

When output is available, the panel shows:

- natural-language text;
- structured JSON;
- `Copy Text`;
- `Copy JSON`.

The panel should not be placed inside the spectrogram canvas. It is an app-level
debug surface opened by the native debug menu command.

## 12. Selected Range Summary

Create a pure selected-range summary generator. The debug panel should only
render its output.

Inputs:

- project metadata;
- `selectedTimeRange`;
- workspace beat settings;
- `PitchEnergyOverview` where available;
- `SpectrogramOverview` fallback where pitch energy is not available.

Output:

```ts
{
  text: string;
  json: {
    range: {
      startMs: number;
      endMs: number;
      durationMs: number;
    };
    beatContext: {
      bpm: number;
      beatsPerBar: number;
      beatOffsetMs: number;
      startBarBeat: string;
      endBarBeat: string;
    };
    pitchSummary: {
      strongestMidiRange?: [number, number];
      strongestNoteRange?: [string, string];
      peakMoments: Array<{
        startMs: number;
        endMs: number;
        energy: number;
      }>;
      averageEnergyByPitchBand: Array<{
        label: string;
        energy: number;
      }>;
    };
    source: {
      projectName: string;
      audioName: string;
      analysisKind: "pitch-energy" | "spectrogram";
    };
  };
}
```

The first version should avoid overclaiming musical interpretation. It should
describe stable analysis facts such as time range, beat context, prominent pitch
bands, and high-energy moments.

## 13. Component Boundaries

`SpectrogramViewer` and `SpectrogramView` are already heavy enough. New behavior
should continue the existing direction of moving logic into focused modules.

Existing split responsibilities include:

- `src/core/spectrogramViewport.ts` for viewport math;
- `src/features/spectrogramViewer/spectrogramViewport.ts` for viewport filtering;
- `src/features/spectrogramViewer/pitchHover.ts` for hover pitch/time mapping;
- `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx` for the
  existing navigator;
- `src/core/audio/pitchHeatmap.ts` for heatmap display mapping.

Recommended additions:

```text
src/features/spectrogramViewer/selectedRange.ts
src/features/spectrogramViewer/timeRuler.ts
src/features/spectrogramViewer/useSpectrogramSelection.ts
src/features/spectrogramViewer/SpectrogramTimeRuler.tsx
src/features/spectrogramViewer/SpectrogramSelectionOverlay.tsx
src/features/spectrogramViewer/DebugSelectionPanel.tsx
src/features/spectrogramViewer/selectedRangeSummary.ts
```

Responsibilities:

- `selectedRange.ts`: normalize ranges, apply thresholds, map x positions to
  viewport time.
- `timeRuler.ts`: generate natural time ticks and bar/beat ticks.
- `useSpectrogramSelection.ts`: own click-to-seek and Ctrl-drag interaction
  state.
- `SpectrogramTimeRuler.tsx`: render the slim two-row ruler.
- `SpectrogramSelectionOverlay.tsx`: render the neutral spectrogram selection
  boundaries.
- `selectedRangeSummary.ts`: generate natural-language and JSON debug output.
- `DebugSelectionPanel.tsx`: display status, text, JSON, and copy controls.

`SpectrogramViewer` should coordinate playback service state, workspace
persistence, loop toggling, and menu-triggered debug panel visibility.

`SpectrogramView` should compose visual pieces and forward interaction events.
It should not become the long-term owner of selection math, ruler generation,
summary generation, or debug panel UI.

## 14. Error Handling

- Invalid selected ranges are discarded during normalization.
- A Ctrl-drag below the threshold is ignored rather than creating a zero-width
  range.
- If selected analysis frames are missing, the debug panel reports
  `analysis unavailable`.
- Clipboard copy failures should show a small panel-local failure state or leave
  the copy action visibly unsuccessful; they should not crash the app.
- Loop playback should not enable without a selected range.

## 15. Testing Strategy

Automated tests should cover:

- default workspace includes `loopEnabled: false` and no selected range;
- valid selected ranges normalize and clamp to duration;
- invalid selected ranges are discarded;
- old `loopRange` is not migrated into `selectedTimeRange`;
- spectrogram plain click seeks without clearing selection;
- Ctrl-drag creates and replaces selected ranges;
- reverse Ctrl-drag normalizes start and end;
- too-small Ctrl-drag does not create a range;
- playhead and selection overlays render with the expected classes;
- the two-row ruler renders natural time and bar/beat ticks aligned to the
  viewport;
- selected range is highlighted in the ruler but not filled over the heatmap;
- `Set Loop Start` and `Set Loop End` no longer appear in the primary controls;
- Loop button is disabled or inactive without selection;
- enabling Loop with a selected range applies playback loop range;
- disabling Loop clears playback loop range;
- clearing selection disables loop playback;
- native menu includes `Debug`;
- `Describe Selected Range for LLM` dispatches the correct command;
- debug panel status covers no project, no selection, unavailable analysis, and
  available output;
- selected-range summary generator produces stable text and JSON for fixed input.

Verification should include:

- `npm test`;
- `npm run build`;
- Electron smoke test.

Electron smoke should confirm:

1. `window.ziqiApp` exists in the renderer.
2. Native `File | Debug` menu is present.
3. Import or open audio.
4. Click in the spectrogram to seek.
5. Ctrl-drag to select a range.
6. Confirm the ruler and spectrogram selection visuals align.
7. Toggle Loop and confirm playback jumps from selected end to start.
8. Open `Debug > Describe Selected Range for LLM`.
9. Confirm status, text, JSON, and copy controls render.

## 16. Acceptance Criteria

This feature is complete when:

- plain spectrogram click seeks to the clicked time;
- Ctrl-drag selects a time range and replaces the previous selection;
- plain click does not clear selection;
- the playhead is clearly visible in the spectrogram;
- selected range is clearly visible without changing heatmap colors;
- a slim two-row ruler appears above the spectrogram;
- natural time ticks are generated from the current viewport;
- bar/beat ticks are generated from workspace beat settings;
- selected range is highlighted in the ruler;
- selected range and `loopEnabled` are saved to the project;
- old `loopRange` is not used as the new selection model;
- Loop button controls whether the selected range actually loops playback;
- native `Debug` menu opens the debug selection panel;
- debug panel shows the requested one-line status;
- available debug output includes natural language and JSON with copy controls;
- new logic is extracted into focused modules instead of making
  `SpectrogramViewer` and `SpectrogramView` substantially heavier;
- automated tests and build pass;
- Electron smoke confirms real runtime menu, selection, loop, and debug behavior.
