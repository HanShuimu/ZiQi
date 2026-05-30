# Heatmap Display Range Calibration Design

## Goal

Calibrate the pitch heatmap display sliders so their absolute dB ranges match the current multiresolution STFT energy scale better.

The current default display window is too low for raw STFT magnitudes. Small changes to `Floor` or `Range` can push most visible energy above the display top, making the heatmap turn red. The first fix should keep the existing display mapping formula and only adjust defaults, clamp ranges, and UI slider limits.

## Non-Goals

- Do not change `mapPitchEnergyToDisplayValue`.
- Do not introduce per-song adaptive normalization.
- Do not alter STFT analysis output values.
- Do not change the `.ziqi` schema.
- Do not redesign the control panel layout.

## Current Behavior

The display mapping computes:

```ts
db = 20 * Math.log10(energy) + gainDb
normalized = (db - noiseFloorDb) / dynamicRangeDb
```

Values at or above `noiseFloorDb + dynamicRangeDb` clamp to `1` and render at the top of the color ramp.

Current defaults are:

```ts
gainDb: 0
contrast: 1
dynamicRangeDb: 80
noiseFloorDb: -90
colorIntensity: 1
```

That creates a default display window of `-90 dB` to `-10 dB`. This was reasonable when pitch energy behaved like a normalized value, but raw FFT magnitudes can easily occupy a much higher absolute dB range.

## Chosen Calibration

Use a wider and higher absolute dB window:

| Setting | Current Range | Current Default | New Range | New Default |
| --- | ---: | ---: | ---: | ---: |
| Gain | `-24..36 dB` | `0 dB` | `-48..24 dB` | `0 dB` |
| Contrast | `0.5..3` | `1` | `0.6..1.8` | `1` |
| Range | `40..120 dB` | `80 dB` | `80..150 dB` | `110 dB` |
| Floor | `-120..-40 dB` | `-90 dB` | `-80..0 dB` | `-40 dB` |
| Intensity | `0.5..2` | `1` | `0.5..1.4` | `1` |

The new default display window is:

```text
floor = -40 dB
top = -40 dB + 110 dB = 70 dB
```

This keeps the interpretation absolute and predictable while reducing the chance that a normal full-song STFT heatmap starts as all red or all blue.

## Implementation Scope

Modify only the display settings definitions and matching UI slider limits:

- `src/core/audio/pitchHeatmap.ts`
  - update `DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS`
  - update `SETTING_RANGES`
- `src/features/spectrogramViewer/WorkspaceControlZone.tsx`
  - update slider `min`, `max`, and `step` where needed
- Tests that assert defaults or clamp boundaries
  - update expectations to the new numeric ranges

## Compatibility

Existing projects may contain older `pitchHeatmapDisplay` values. They should continue loading through `clampPitchHeatmapDisplaySettings`.

Because the new floor range is narrower and higher, old values such as `noiseFloorDb: -90` will clamp to `-80`. This is acceptable because the old value is tuned for the pre-STFT scale and is now likely too low.

No migration is required because the existing project data shape does not change.

## Verification

Automated checks:

- Display setting defaults match the new calibrated values.
- Clamp tests verify the new min/max boundaries.
- Control-zone tests verify slider changes still update project analysis view state.
- Existing spectrogram viewer tests pass.

Manual/runtime checks with:

```text
D:\WORKSPACE\ZiQi_Projects\Active Planets - 木漏れ日カーテン.ziqiproject\Active Planets - 木漏れ日カーテン.ziqi
```

Expected result:

- Opening the project should not start with an all-red heatmap.
- Pulling `Range` toward its minimum should increase contrast without immediately saturating the full heatmap.
- Pulling `Floor` downward should reveal quieter content, and upward should hide noise, without tiny movements causing total saturation.
- `Reset` should return to `Gain 0`, `Contrast 1`, `Range 110`, `Floor -40`, `Intensity 1`.
