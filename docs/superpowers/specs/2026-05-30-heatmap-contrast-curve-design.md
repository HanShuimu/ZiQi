# Heatmap Contrast Curve Design

## Goal

Correct the pitch heatmap `Contrast` control so it behaves like contrast instead of gamma.

The current control uses a power curve:

```ts
normalized ** (1 / contrast)
```

This changes global brightness distribution. Values above `1` brighten much of the lower and middle range, which feels like an overall boost rather than a separation of strong and weak energy.

The desired behavior is a contrast control that keeps `contrast = 1` neutral, makes values above the pivot brighter, and makes values below the pivot darker.

## Non-Goals

- Do not add a new Gamma control.
- Do not rename the persisted `contrast` field.
- Do not change Gain, Range, Floor, or Intensity semantics.
- Do not change STFT analysis output.
- Do not introduce per-song adaptive normalization.
- Do not change `.ziqi` schema shape.

## Chosen Behavior

Keep the existing `contrast` setting name and slider. Change the mapping after dB normalization from gamma to pivot contrast:

```ts
const pivot = 0.5;
const contrasted = (normalized - pivot) * settings.contrast + pivot;
```

Then keep the existing final clamp and color intensity multiply:

```ts
return clamp01(contrasted * settings.colorIntensity);
```

This gives the expected control semantics:

- `contrast = 1`: neutral.
- `contrast > 1`: darker darks and brighter brights.
- `contrast < 1`: compressed contrast, bringing values toward the middle.

The current calibrated slider range `0.6..1.8` remains appropriate for this first version. It gives useful contrast adjustment without making small movements too destructive.

## Data Compatibility

The persisted field stays:

```ts
contrast: number
```

No migration is required. Existing projects that saved contrast values will continue loading through the current clamp behavior, but the visual meaning changes from gamma-like brightness shaping to actual contrast. This is acceptable because the old behavior did not match the control label.

## Implementation Scope

Modify:

- `src/core/audio/pitchHeatmap.ts`
  - Change only the contrast curve inside `mapPitchEnergyToDisplayValue`.
  - Keep dB normalization, noise floor cutoff, dynamic range behavior, gain behavior, and intensity behavior unchanged.

- `src/core/audio/pitchHeatmap.test.ts`
  - Add/adjust tests to prove:
    - `contrast = 1` is neutral after normalization.
    - `contrast > 1` reduces a below-pivot value and increases an above-pivot value.
    - `contrast < 1` moves below/above-pivot values toward the pivot.
    - noise floor cutoff still returns `0`.

Optional:

- `src/features/spectrogramViewer/SpectrogramView.test.tsx`
  - Only update if an existing assertion assumes old gamma behavior.

## Verification

Automated checks:

- `npm test -- src/core/audio/pitchHeatmap.test.ts`
- `npm test -- src/features/spectrogramViewer/SpectrogramView.test.tsx`
- `npm test`
- `npm run lint`
- `npm run build`

Manual/runtime check with:

```text
D:\WORKSPACE\ZiQi_Projects\Active Planets - 木漏れ日カーテン.ziqiproject\Active Planets - 木漏れ日カーテン.ziqi
```

Expected:

- Increasing `Contrast` should make weak background energy less prominent while making strong note lanes stand out more.
- Decreasing `Contrast` should reduce separation and make the heatmap flatter.
- It should no longer feel like a simple global brighten/dim control.
