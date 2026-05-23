# Pitch Heatmap Analysis Design

Date: 2026-05-23

## 1. Purpose

ZiQi's current spectrogram is not accurate enough for the core music-analysis workflow. Adjacent notes often appear with the same color, and users cannot tune the visual mapping when a recording is weak, noisy, or dynamically compressed.

This design replaces the main continuous spectrogram with an A0-C8 pitch heatmap. The new view treats the 88 piano keys as first-class analysis tracks. Each visible row maps to one MIDI note, so adjacent semitones are always represented as separate lanes.

Precision has priority over calculation speed. The system must not reduce analysis quality to save time.

## 2. Goals

- Replace the main spectrogram with an 88-key pitch heatmap covering A0-C8.
- Use Essentia.js Constant-Q analysis through `SpectrumCQ`.
- Represent analysis output with a pitch-specific data model, not generic frequency bins.
- Ensure adjacent semitones are independent visual tracks.
- Add user-adjustable heatmap display sliders in the existing control area.
- Persist heatmap display settings in `.ziqi` project files.
- Restore display settings when opening a saved project.
- Keep display sliders fast by redrawing the heatmap without re-running audio analysis.
- Preserve the existing Electron audio boundary: renderer receives audio bytes and performs analysis from controlled audio data, not direct local path reads.

## 3. Non-Goals

- Do not keep the current continuous spectrogram as a parallel primary mode.
- Do not expose CQT engine parameters as first-version user controls.
- Do not add vertical pitch zoom in the first version.
- Do not add pitch labels, hover readouts, note editing, transcription, annotations, or automatic note detection.
- Do not cache pitch heatmap analysis data in `.ziqi`.
- Do not add a separate settings page for heatmap display controls.
- Do not change playback service semantics.

## 4. Recommended Approach

Use Essentia.js `SpectrumCQ` as the first pitch-analysis engine.

The first version should configure CQT for 88 semitone bins:

```text
minFrequency = 27.5
numberBins = 88
binsPerOctave = 12
sampleRate = decoded audio sampleRate
```

The resulting CQT magnitude vector becomes one frame of pitch energy. Each output frame has 88 values, where index 0 is A0 and index 87 is C8.

This approach is preferred over increasing the existing FFT spectrogram resolution because the product requirement is semitone separation across the full piano range, especially low frequencies. A generic fixed-window FFT spectrogram is a poor fit for that requirement. CQT is aligned with musical pitch spacing and lets the UI use stable note lanes.

## 5. Data Model

Add a pitch-specific analysis model:

```ts
interface PitchEnergyOverview {
  durationMs: number;
  framesPerSecond: number;
  minMidiNumber: 21;
  maxMidiNumber: 108;
  notesPerFrame: 88;
  frames: PitchEnergyFrame[];
}

interface PitchEnergyFrame {
  startMs: number;
  endMs: number;
  energies: number[];
}
```

`energies` is always ordered from low pitch to high pitch:

- index 0: MIDI 21, A0;
- index 48: MIDI 69, A4;
- index 87: MIDI 108, C8.

The old `SpectrogramOverview` may remain temporarily while code migrates, but the main workspace should consume `PitchEnergyOverview`.

## 6. Display Settings

Add project-level heatmap display settings:

```ts
interface PitchHeatmapDisplaySettings {
  gainDb: number;
  contrast: number;
  dynamicRangeDb: number;
  noiseFloorDb: number;
  colorIntensity: number;
}
```

Default and clamp ranges:

| Setting | Default | Range | Purpose |
| --- | --- | --- | --- |
| `gainDb` | `0` | `-24..36` | Brighten or darken overall energy. |
| `contrast` | `1` | `0.5..3` | Expand or compress visible differences. |
| `dynamicRangeDb` | `80` | `40..120` | Map a dB range into the color scale. |
| `noiseFloorDb` | `-90` | `-120..-40` | Treat lower values as background. |
| `colorIntensity` | `1` | `0.5..2` | Control final color strength. |

These settings affect only rendering. Changing them must not trigger decoding, Essentia.js loading, or CQT analysis.

## 7. Project Persistence

Persist display settings in the `.ziqi` project payload under `analysisView.pitchHeatmapDisplay`:

```ts
interface ProjectSummary {
  analysisView?: {
    pitchHeatmapDisplay: PitchHeatmapDisplaySettings;
  };
}
```

Rules:

- Saving a project writes the current heatmap display settings.
- Opening a project restores saved heatmap display settings.
- Opening an old project with no settings uses defaults.
- Opening a project with out-of-range values clamps them to valid ranges.
- Resetting the controls restores defaults and updates project state.

The pitch-energy analysis output is not persisted in `.ziqi`; it is regenerated from the project audio when opening the project.

## 8. UI Design

Add a compact `Heatmap Display` group inside the existing control area. Do not create a separate settings page or floating panel.

Controls:

- `Gain` slider.
- `Contrast` slider.
- `Range` slider.
- `Floor` slider.
- `Intensity` slider.
- `Reset` button.

Behavior:

- Slider changes update project state immediately.
- Slider changes redraw the heatmap immediately.
- Slider changes do not re-run CQT analysis.
- The values are included when the user saves the project.
- The control group should remain visually compact and consistent with existing playback, rate, and loop controls.

## 9. Rendering Design

The main canvas renders 88 pitch rows:

- Bottom row: A0.
- Top row: C8.
- Every row maps to exactly one MIDI note.
- The left piano axis aligns exactly with the 88 rows.
- The existing time viewport and horizontal zoom/pan behavior continue to define the visible time range.

When multiple analysis frames map to one canvas column, the renderer uses the maximum energy for each pitch lane rather than a simple average. This avoids hiding short notes during horizontal compression.

The color mapping pipeline:

1. Convert or normalize CQT magnitude into a display-space energy value.
2. Apply `gainDb`.
3. Clamp values below `noiseFloorDb` to background.
4. Map the remaining range through `dynamicRangeDb`.
5. Apply `contrast`.
6. Apply `colorIntensity`.
7. Convert the final `0..1` value to the existing blue-green-yellow-red heatmap style.

The row mapping must not depend on container height in a way that merges semitones. The pitch heatmap uses a minimum lane height of 6 px, so the 88-lane canvas has a minimum visual height of 528 px. If the layout cannot fit that height, the pitch area scrolls vertically instead of collapsing multiple semitones into one row.

## 10. Analysis Flow

Import audio:

1. Electron main reads the selected audio bytes through the existing controlled file boundary.
2. Renderer creates the playback object URL.
3. Renderer decodes audio for waveform and pitch analysis.
4. Waveform service generates `WaveformOverview`.
5. Pitch energy service loads Essentia.js if needed.
6. Pitch energy service generates `PitchEnergyOverview`.
7. App commits project, waveform overview, pitch overview, playback URL, and default display settings.

Open project:

1. Electron main reads `.ziqi` and project audio bytes.
2. Renderer creates the playback object URL.
3. Renderer decodes audio for waveform and pitch analysis.
4. Renderer regenerates `WaveformOverview`.
5. Renderer regenerates `PitchEnergyOverview`.
6. Renderer restores saved heatmap display settings or defaults.
7. App activates the opened project only after required analysis succeeds.

## 11. Error Handling

Essentia.js is an external WASM-backed runtime dependency, so loading and initialization must be treated as a real failure point.

Failure rules:

- If Essentia.js fails to load, the import/open operation fails and the current project state remains unchanged.
- If CQT analysis fails, the import/open operation fails and the current project state remains unchanged.
- If display settings are missing, use defaults.
- If display settings are out of range, clamp them.
- If a slider emits an invalid value, clamp it before updating state.

User-facing messages:

```text
Failed to load pitch analysis engine.
Failed to generate pitch heatmap.
```

## 12. Testing Strategy

Unit tests:

- `PitchEnergyOverview` maps indexes to MIDI notes A0-C8 correctly.
- Defaults, reset behavior, and clamp rules for `PitchHeatmapDisplaySettings` are stable.
- The display mapping keeps values in `0..1`.
- Gain, contrast, dynamic range, noise floor, and intensity each affect rendered values predictably.
- Synthetic A4 input peaks on MIDI 69 and does not merge with A#4.
- Synthetic A0 and A#0 inputs peak on different adjacent lanes, allowing leakage but requiring different maxima.

Component tests:

- The control area renders `Heatmap Display` sliders and reset.
- Moving a slider updates project state.
- Moving a slider triggers heatmap redraw without invoking analysis.
- The pitch canvas keeps 88 independent rows.
- The left piano axis aligns with heatmap rows.

Project tests:

- Saving writes `pitchHeatmapDisplay`.
- Opening restores `pitchHeatmapDisplay`.
- Opening an old project supplies defaults.
- Opening out-of-range settings clamps values.

Verification commands:

```text
npm test
npm run build
```

Electron smoke:

- Import real audio.
- Confirm `window.ziqiApp` exists in the renderer.
- Confirm Essentia.js loads in the packaged renderer environment.
- Confirm the 88-key heatmap appears.
- Confirm adjacent semitone lanes are visually separate.
- Move each display slider and confirm immediate redraw.
- Save, close or replace the project, reopen it, and confirm display settings are restored.

## 13. Acceptance Criteria

- The loaded-project main analysis view is an A0-C8 pitch heatmap, not the previous continuous spectrogram.
- The heatmap has 88 independent semitone lanes.
- Essentia.js `SpectrumCQ` is used for first-version pitch energy analysis.
- Users can adjust Gain, Contrast, Range, Floor, and Intensity from the existing control area.
- Display setting changes redraw the heatmap without rerunning CQT analysis.
- Display settings are saved into `.ziqi` and restored on open.
- Old project files still open with default display settings.
- Failed pitch analysis does not replace the current project state with partial data.

## 14. References

- Essentia.js: https://mtg.github.io/essentia.js/
- Essentia.js `SpectrumCQ` API: https://mtg.github.io/essentia.js/docs/api/Essentia.html
- Essentia licensing: https://essentia.upf.edu/licensing_information.html
