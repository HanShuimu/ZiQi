# Bar Grid Alignment Design

## Goal

Add a project-level bar alignment grid to the pitch heatmap workspace.

The user should be able to enter three numeric values in the workspace controls:

- beats per bar, default `4`;
- BPM, default `120`;
- offset, default `0ms`.

The pitch heatmap should draw thin white vertical lines at the start of each bar according to those values. When the user points at the heatmap, the existing pitch readout should also show the pointed time in both precise clock format and raw milliseconds, for example:

```text
00:06.000 (6000 ms)
```

## Decisions Confirmed

- Use workspace state, not component-local state.
- `beatOffsetMs = 0` means the first bar line starts at audio time `0ms`.
- Positive offset shifts the whole bar grid later.
- Negative offset shifts the whole bar grid earlier.
- Time readout should show both `mm:ss.mmm` and raw milliseconds.

## Non-Goals

- Do not add automatic BPM detection.
- Do not add snapping, bar selection, beat subdivision lines, or annotation creation.
- Do not redesign the whole control zone.
- Do not replace the existing fixed time grid; the bar grid is an additional overlay.
- Do not change audio analysis, playback service behavior, or Electron file boundaries.

## Workspace State

Extend `WorkspaceState` with one new persisted field:

```ts
beatsPerBar: number;
```

Reuse existing persisted fields:

```ts
bpm: number;
beatOffsetMs: number;
```

Default workspace state should become:

```ts
beatsPerBar: 4;
bpm: 120;
beatOffsetMs: 0;
```

Workspace normalization should keep old projects loadable. If a saved project lacks `beatsPerBar`, use `4`. If `bpm`, `beatsPerBar`, or `beatOffsetMs` are missing or invalid, normalize to safe defaults.

Validation rules:

- `beatsPerBar` must be a finite positive number; normalize invalid or non-positive values to `4`.
- `bpm` must be a finite positive number; normalize invalid or non-positive values to `120`.
- `beatOffsetMs` must be finite; normalize invalid values to `0`.
- UI input should round `beatsPerBar` and `bpm` to whole numbers because the requested controls are simple numeric music settings.
- Offset should be stored as a whole millisecond value and may be negative.

## Control Zone

Add one workspace control group for bar alignment, placed near the existing playback and speed controls.

Controls:

- `拍数`: numeric input, default `4`, no slider.
- `BPM`: numeric input, default `120`, no slider.
- BPM decrement button: arrow button that applies `bpm - 1`.
- BPM increment button: arrow button that applies `bpm + 1`.
- `偏移 ms`: numeric input, default `0`, no slider.

Each edit should call the existing `onWorkspaceChange` path with only the changed workspace field.

Keyboard playback shortcuts should continue ignoring focused controls. The existing shortcut guard already ignores `input` and `button`, so these controls fit the current model.

## Bar Line Model

Compute the bar interval from the workspace values:

```text
barDurationMs = (60_000 / bpm) * beatsPerBar
```

The start of each bar is:

```text
barStartMs = beatOffsetMs + n * barDurationMs
```

where `n` is any integer. Negative offsets are valid; the first visible line may come from a positive or negative `n`.

Only visible lines inside the active spectrogram viewport should be rendered:

```text
viewportStartMs = viewport.startMs
viewportEndMs = viewport.startMs + viewport.durationMs
```

Find the first visible `n` using the viewport start and step forward by `barDurationMs` until reaching the viewport end. Include a line at the viewport start when it lands exactly on a bar start, and exclude a line at the viewport end to avoid duplicating boundary lines while panning. This avoids generating lines for the whole audio file.

For each visible bar time, use the existing viewport mapping:

```text
leftPercent = timeToViewportPercent(barStartMs, viewport)
```

Render each line inside the heatmap canvas frame as a thin white vertical overlay. The line should be pointer-transparent and visually lighter than the playback cursor, but clearer than the existing faint time grid.

The line should identify the start of every bar, not every beat.

## Interaction With Existing Time Grid

The current `spectrogram-time-grid-line` remains as a general time reference.

Bar grid lines should use a separate class and test id, for example:

```text
spectrogram-bar-grid-line
```

This keeps tests and styling separate from the existing fixed time grid.

If a bar line overlaps the playback cursor or hover time line:

- playback cursor remains the strongest playback indicator;
- hover time line remains blue and interactive-state-specific;
- bar line stays thin and white.

## Hover Time Readout

The existing heatmap hover state already calculates:

```ts
pointerState.timeMs
```

Keep the same time mapping and pitch mapping. Change the displayed time text from:

```text
00:06.000
```

to:

```text
00:06.000 (6000 ms)
```

The timeline navigator can continue using the compact precise time label unless implementation shows a clear reason to share the expanded label there. The user request specifically names the pitch display area.

## Accessibility

Numeric inputs need accessible labels matching their purpose:

- `Beats per bar`
- `BPM`
- `Beat offset milliseconds`

Arrow buttons for BPM should have labels such as:

- `Decrease BPM`
- `Increase BPM`

The bar grid lines are decorative visual guides and should not be focusable.

## Testing

Automated tests should cover:

- default workspace state includes `beatsPerBar: 4`, `bpm: 120`, and `beatOffsetMs: 0`;
- workspace normalization fills `beatsPerBar` for older project data;
- invalid non-positive `beatsPerBar` and `bpm` normalize to defaults;
- invalid offset normalizes to `0`, while negative finite offset is preserved;
- control zone renders numeric inputs for beats per bar, BPM, and offset;
- changing each numeric input reports the matching workspace patch;
- BPM arrow buttons report `bpm - 1` and `bpm + 1`;
- spectrogram view renders visible bar lines from `beatsPerBar`, `bpm`, and `beatOffsetMs`;
- negative offset produces the correct visible bar line positions;
- hover status shows `mm:ss.mmm (N ms)`;
- existing playback cursor, hover line, and fixed time grid tests continue passing.

Manual/browser verification should cover:

- opening a loaded project shows the bar grid controls in the control zone;
- editing `BPM`, `拍数`, or `偏移 ms` immediately moves the white bar lines;
- BPM arrow buttons make small visible adjustments;
- zooming or panning the spectrogram keeps bar lines aligned to audio time;
- negative offset shifts the visible bar grid earlier;
- hover over the heatmap shows both precise time and millisecond time.

## Success Criteria

- Bar alignment settings are part of project workspace state and survive save/open through the existing project state path.
- The control zone uses numeric inputs, not sliders, for beats per bar, BPM, and offset.
- BPM has simple `+1` and `-1` arrow buttons.
- The heatmap shows thin white lines at every visible bar start.
- The bar line positions follow `beatsPerBar`, `bpm`, `beatOffsetMs`, and the active viewport.
- Hovering the heatmap shows pitch plus time formatted as `mm:ss.mmm (N ms)`.
- The implementation stays scoped to workspace state, spectrogram viewer controls/view rendering, styles, and related tests.
