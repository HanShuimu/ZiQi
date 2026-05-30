# Pitch Hover Crosshair Design

## Goal

Improve the pitch heatmap inspection interaction so the user can point at the heatmap and immediately read both pitch and time.

The interaction should make the heatmap feel spatially trustworthy:

- the left piano axis and heatmap lanes must align exactly;
- hovering the heatmap highlights the pointed semitone across the full heatmap row;
- the matching piano key is highlighted at the same vertical position;
- hovering also shows a vertical time line at the pointed time;
- the timeline shows the same pointed time as a readable label;
- a compact status strip shows the current pitch and time details.

## Non-Goals

- Do not change pitch analysis output or STFT behavior.
- Do not change saved project schema.
- Do not add note selection persistence in this first pass.
- Do not add editing, annotation, or snapping behavior.
- Do not redesign the whole control zone.
- Do not replace the existing playback cursor.

## Placement

Add a status strip between the existing workspace control zone and the spectrogram display.

The vertical order should be:

1. spectrum panel header;
2. workspace control zone;
3. pitch hover status strip;
4. waveform row;
5. piano axis and heatmap;
6. timeline navigator.

This keeps the readout close to the heatmap without covering spectral content or reducing heatmap width.

## Hover Model

The heatmap should track one transient pointer state while the mouse is inside the heatmap canvas frame:

```ts
interface HeatmapPointerState {
  pitchIndex: number;
  midiNumber: number;
  noteName: string;
  frequencyHz: number;
  timeMs: number;
  xPercent: number;
  yPercent: number;
}
```

The pointer state is cleared when the mouse leaves the heatmap canvas frame.

The status strip should show an idle hint when no pointer state exists. When the pointer is active, it should show:

- note name, for example `A4`;
- frequency, for example `440.00 Hz`;
- MIDI number, for example `MIDI 69`;
- time, for example `01:24.320`.

## Pitch Alignment

The piano axis and heatmap must share the same lane geometry.

Use the existing 88-key pitch range:

- `PITCH_HEATMAP_NOTE_COUNT = 88`;
- MIDI `21..108`;
- A0 through C8.

Each lane should occupy:

```text
100% / 88
```

of the display height. The heatmap canvas already draws each pitch index into a fixed lane height. The DOM piano keys and hover overlay should use the same pitch-index-derived lane top/bottom calculations instead of a separate percentage formula based on `PIANO_KEYS.length - 1`.

The lowest pitch index must align to the bottom heatmap lane. The highest pitch index must align to the top heatmap lane.

## Horizontal Pitch Highlight

When the pointer is active:

- draw a shallow horizontal highlight across the full heatmap row for `pitchIndex`;
- draw a matching highlight over the piano key lane for the same `pitchIndex`;
- keep the highlight pointer-transparent so it does not block wheel zoom or future interactions.

The row highlight should be visually lighter than the playback cursor and time grid, so it reads as inspection state rather than playback state.

## Vertical Time Highlight

When the pointer is active:

- map pointer X inside the heatmap canvas frame to the active spectrogram viewport time;
- draw a vertical line inside the heatmap at `xPercent`;
- draw a matching time marker in the timeline navigator at the same viewport-relative X position;
- show the formatted time label on or near the timeline marker.

The vertical hover line is separate from the playback cursor. Playback should continue to use the existing `currentTimeMs` cursor. If both overlap, the playback cursor may remain visually stronger.

## Time Mapping

Time should be calculated from the active spectrogram viewport:

```text
timeMs = viewport.startMs + xRatio * viewport.durationMs
```

Clamp `xRatio` to `0..1` before calculating time.

The timeline label should use the same `timeMs` value as the status strip. Formatting should support minutes and milliseconds, for example:

```text
01:24.320
```

## Error and Empty States

If pitch frames are not available yet, the existing empty heatmap state remains. Pointer hover does not need to show pitch details while there is no usable pitch range.

If the heatmap dimensions are unavailable or zero, pointer state should not update.

If the pointer leaves the heatmap frame, clear the crosshair and return the status strip to its idle state.

## Accessibility

The status strip should expose the current pointer readout as readable text.

The hover overlays are visual aids and should not be focusable. They should not change keyboard playback shortcuts.

## Testing

Automated tests should cover:

- the status strip renders between controls and the spectrogram view;
- pointer movement over the heatmap maps Y to the expected pitch index;
- pointer movement maps X to the expected viewport time;
- the corresponding piano key receives an active state;
- the horizontal heatmap highlight uses the same lane position as the piano key;
- the vertical heatmap highlight and timeline marker use the same X position;
- leaving the heatmap clears hover state;
- the existing playback cursor behavior remains intact.

Manual/browser verification should cover:

- moving the mouse up and down keeps the piano highlight and heatmap row perfectly aligned;
- moving the mouse left and right updates the status strip time and timeline label;
- hover crosshair does not interfere with wheel zoom or horizontal pan;
- playback cursor remains distinguishable from hover time line.

## Success Criteria

- The user can point at any heatmap cell and read its pitch and time without guessing.
- Piano keys and heatmap lanes are visibly aligned from A0 through C8.
- The hover row and highlighted piano key remain locked together.
- The hover time line and timeline time label remain locked together.
- No product code outside the spectrogram viewer and closely related tests needs to change.
