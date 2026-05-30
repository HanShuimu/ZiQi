# Heatmap Contrast Curve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the pitch heatmap `Contrast` control behave like true pivot contrast instead of gamma while preserving existing settings shape and slider range.

**Architecture:** Keep `PitchHeatmapDisplaySettings.contrast` and all non-contrast display controls unchanged. Add focused tests around known normalized values, then replace the gamma power curve inside `mapPitchEnergyToDisplayValue` with a `0.5` pivot contrast transform.

**Tech Stack:** TypeScript, Vitest.

---

## File Structure

- Modify `src/core/audio/pitchHeatmap.test.ts`
  - Add tests that prove contrast pivots around `0.5`.
  - Keep existing defaults, clamp, energy, and noise floor tests.

- Modify `src/core/audio/pitchHeatmap.ts`
  - Change only the contrast curve in `mapPitchEnergyToDisplayValue`.
  - Do not change defaults, ranges, types, STFT output, UI sliders, or `.ziqi` schema.

---

### Task 1: Add Failing Contrast Curve Tests

**Files:**
- Modify: `src/core/audio/pitchHeatmap.test.ts`

- [ ] **Step 1: Add a helper for normalized display inputs**

Inside `src/core/audio/pitchHeatmap.test.ts`, after the imports and before `describe`, add:

```ts
function energyForNormalizedDisplayValue(value: number) {
  const db =
    DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.noiseFloorDb +
    DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.dynamicRangeDb * value;

  return 10 ** (db / 20);
}
```

- [ ] **Step 2: Add neutral contrast and pivot contrast tests**

After `"maps energy through display controls into 0..1"`, add:

```ts
  it("keeps contrast 1 neutral for normalized display values", () => {
    expect(
      mapPitchEnergyToDisplayValue(
        energyForNormalizedDisplayValue(0.25),
        DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS
      )
    ).toBeCloseTo(0.25, 5);
    expect(
      mapPitchEnergyToDisplayValue(
        energyForNormalizedDisplayValue(0.75),
        DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS
      )
    ).toBeCloseTo(0.75, 5);
  });

  it("increases contrast around the midpoint instead of brightening globally", () => {
    const highContrast = {
      ...DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
      contrast: 1.8
    };

    expect(
      mapPitchEnergyToDisplayValue(energyForNormalizedDisplayValue(0.25), highContrast)
    ).toBeLessThan(0.25);
    expect(
      mapPitchEnergyToDisplayValue(energyForNormalizedDisplayValue(0.75), highContrast)
    ).toBeGreaterThan(0.75);
  });

  it("reduces contrast around the midpoint", () => {
    const lowContrast = {
      ...DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
      contrast: 0.6
    };

    expect(
      mapPitchEnergyToDisplayValue(energyForNormalizedDisplayValue(0.25), lowContrast)
    ).toBeGreaterThan(0.25);
    expect(
      mapPitchEnergyToDisplayValue(energyForNormalizedDisplayValue(0.75), lowContrast)
    ).toBeLessThan(0.75);
  });
```

- [ ] **Step 3: Run the core test and verify it fails before implementation**

Run:

```bash
npm test -- src/core/audio/pitchHeatmap.test.ts
```

Expected: FAIL. The high-contrast below-pivot assertion should fail because the old gamma curve brightens `0.25` instead of making it darker.

- [ ] **Step 4: Commit the failing tests**

Run:

```bash
git add -- src/core/audio/pitchHeatmap.test.ts
git commit -m "Add heatmap contrast curve tests"
```

---

### Task 2: Implement Pivot Contrast Mapping

**Files:**
- Modify: `src/core/audio/pitchHeatmap.ts`
- Test: `src/core/audio/pitchHeatmap.test.ts`

- [ ] **Step 1: Replace the gamma curve with pivot contrast**

In `src/core/audio/pitchHeatmap.ts`, replace:

```ts
  const contrasted = normalized ** (1 / settings.contrast);
```

with:

```ts
  const contrastPivot = 0.5;
  const contrasted = (normalized - contrastPivot) * settings.contrast + contrastPivot;
```

Do not change this line:

```ts
  return clamp01(contrasted * settings.colorIntensity);
```

- [ ] **Step 2: Run the core tests**

Run:

```bash
npm test -- src/core/audio/pitchHeatmap.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit the implementation**

Run:

```bash
git add -- src/core/audio/pitchHeatmap.ts src/core/audio/pitchHeatmap.test.ts
git commit -m "Use pivot contrast for heatmap display"
```

---

### Task 3: Verification

**Files:**
- Verify only unless a test reveals a direct issue.

- [ ] **Step 1: Run focused heatmap and viewer tests**

Run:

```bash
npm test -- src/core/audio/pitchHeatmap.test.ts src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Manual runtime check**

Open this project:

```text
D:\WORKSPACE\ZiQi_Projects\Active Planets - 木漏れ日カーテン.ziqiproject\Active Planets - 木漏れ日カーテン.ziqi
```

Expected:

- Increasing `Contrast` makes weak background energy less prominent and strong note lanes stand out more.
- Decreasing `Contrast` reduces separation and makes the heatmap flatter.
- The control no longer feels like a simple global brighten/dim control.

---

## Completion Criteria

- `mapPitchEnergyToDisplayValue` no longer uses `normalized ** (1 / settings.contrast)`.
- `contrast = 1` is neutral.
- `contrast > 1` darkens below-pivot values and brightens above-pivot values.
- `contrast < 1` pulls values toward the pivot.
- Gain, Range, Floor, Intensity, defaults, ranges, UI sliders, and persisted field names are unchanged.
- Focused tests, full tests, lint, and build pass.
