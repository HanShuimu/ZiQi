# Heatmap Display Range Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calibrate the pitch heatmap Gain, Contrast, Range, Floor, and Intensity defaults and slider limits for the current absolute STFT dB scale without changing the display mapping formula.

**Architecture:** Keep `PitchHeatmapDisplaySettings` and `mapPitchEnergyToDisplayValue` unchanged. Update the default settings and clamp ranges in the core helper, mirror those numeric ranges in the control-zone sliders, and update tests that assert clamp/default behavior.

**Tech Stack:** TypeScript, React, Vitest, Testing Library.

---

## File Structure

- Modify `src/core/audio/pitchHeatmap.ts`
  - Update `DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS`.
  - Update `SETTING_RANGES`.
  - Do not change `mapPitchEnergyToDisplayValue`.

- Modify `src/features/spectrogramViewer/WorkspaceControlZone.tsx`
  - Update slider `min` and `max` values to match `SETTING_RANGES`.
  - Keep the same labels, handlers, and layout.

- Modify `src/core/audio/pitchHeatmap.test.ts`
  - Update default and clamp assertions for the new numeric calibration.
  - Add an assertion that the default display top is `70 dB`.

- Modify `src/components/WorkbenchShell.test.tsx` only if needed
  - Existing persistence test should continue passing because it spreads `DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS`.

---

### Task 1: Update Tests For Calibrated Defaults And Clamps

**Files:**
- Modify: `src/core/audio/pitchHeatmap.test.ts`

- [ ] **Step 1: Add explicit default calibration assertions**

In `src/core/audio/pitchHeatmap.test.ts`, after the `"creates fixed-width pitch energy frames"` test, add:

```ts
  it("uses calibrated absolute dB display defaults for STFT energy", () => {
    expect(DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS).toEqual({
      gainDb: 0,
      contrast: 1,
      dynamicRangeDb: 110,
      noiseFloorDb: -40,
      colorIntensity: 1
    });
    expect(
      DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.noiseFloorDb +
        DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.dynamicRangeDb
    ).toBe(70);
  });
```

- [ ] **Step 2: Update the clamp boundary test expectations**

Replace the expected object in `"clamps display settings loaded from project files"` with:

```ts
    ).toEqual({
      gainDb: 24,
      contrast: 0.6,
      dynamicRangeDb: 150,
      noiseFloorDb: 0,
      colorIntensity: 1.4
    });
```

- [ ] **Step 3: Add lower-bound clamp coverage**

Add this test after the upper-bound clamp test:

```ts
  it("clamps display settings to calibrated lower bounds", () => {
    expect(
      clampPitchHeatmapDisplaySettings({
        gainDb: -99,
        contrast: 0,
        dynamicRangeDb: 1,
        noiseFloorDb: -999,
        colorIntensity: 0
      })
    ).toEqual({
      gainDb: -48,
      contrast: 0.6,
      dynamicRangeDb: 80,
      noiseFloorDb: -80,
      colorIntensity: 0.5
    });
  });
```

- [ ] **Step 4: Run the core test and verify it fails before implementation**

Run:

```bash
npm test -- src/core/audio/pitchHeatmap.test.ts
```

Expected: FAIL because defaults and clamp ranges still use the old values.

- [ ] **Step 5: Commit the failing tests**

Run:

```bash
git add -- src/core/audio/pitchHeatmap.test.ts
git commit -m "Add heatmap display calibration tests"
```

---

### Task 2: Apply Calibrated Core Defaults And Ranges

**Files:**
- Modify: `src/core/audio/pitchHeatmap.ts`
- Test: `src/core/audio/pitchHeatmap.test.ts`

- [ ] **Step 1: Update core defaults**

In `src/core/audio/pitchHeatmap.ts`, replace `DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS` with:

```ts
export const DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS: PitchHeatmapDisplaySettings = {
  gainDb: 0,
  contrast: 1,
  dynamicRangeDb: 110,
  noiseFloorDb: -40,
  colorIntensity: 1
};
```

- [ ] **Step 2: Update core clamp ranges**

In `src/core/audio/pitchHeatmap.ts`, replace `SETTING_RANGES` with:

```ts
const SETTING_RANGES = {
  gainDb: { min: -48, max: 24 },
  contrast: { min: 0.6, max: 1.8 },
  dynamicRangeDb: { min: 80, max: 150 },
  noiseFloorDb: { min: -80, max: 0 },
  colorIntensity: { min: 0.5, max: 1.4 }
} as const;
```

- [ ] **Step 3: Run the core tests**

Run:

```bash
npm test -- src/core/audio/pitchHeatmap.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit the core calibration**

Run:

```bash
git add -- src/core/audio/pitchHeatmap.ts src/core/audio/pitchHeatmap.test.ts
git commit -m "Calibrate heatmap display defaults"
```

---

### Task 3: Match Control-Zone Slider Limits To Core Ranges

**Files:**
- Modify: `src/features/spectrogramViewer/WorkspaceControlZone.tsx`
- Test: `src/components/WorkbenchShell.test.tsx`
- Test: `src/features/spectrogramViewer/SpectrogramView.test.tsx`

- [ ] **Step 1: Update slider min/max values**

In `src/features/spectrogramViewer/WorkspaceControlZone.tsx`, update only these `input` props:

```tsx
// Gain
max={24}
min={-48}

// Contrast
max={1.8}
min={0.6}

// Range
max={150}
min={80}

// Floor
max={0}
min={-80}

// Intensity
max={1.4}
min={0.5}
```

Keep current `step` values:

```tsx
// dB controls
step={1}

// Contrast and Intensity
step={0.1}
```

- [ ] **Step 2: Add a UI range assertion to the persistence test**

In `src/components/WorkbenchShell.test.tsx`, inside `"reports pitch heatmap display changes for persistence"`, before changing Gain, add:

```ts
    expect(screen.getByLabelText("Gain")).toMatchObject({ min: "-48", max: "24" });
    expect(screen.getByLabelText("Contrast")).toMatchObject({ min: "0.6", max: "1.8" });
    expect(screen.getByLabelText("Range")).toMatchObject({ min: "80", max: "150" });
    expect(screen.getByLabelText("Floor")).toMatchObject({ min: "-80", max: "0" });
    expect(screen.getByLabelText("Intensity")).toMatchObject({ min: "0.5", max: "1.4" });
```

- [ ] **Step 3: Run affected UI tests**

Run:

```bash
npm test -- src/components/WorkbenchShell.test.tsx src/features/spectrogramViewer/SpectrogramView.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run the core test again**

Run:

```bash
npm test -- src/core/audio/pitchHeatmap.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the slider calibration**

Run:

```bash
git add -- src/features/spectrogramViewer/WorkspaceControlZone.tsx src/components/WorkbenchShell.test.tsx
git commit -m "Match heatmap display sliders to calibrated ranges"
```

---

### Task 4: Verification

**Files:**
- Verify only unless a test reveals a direct issue.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/core/audio/pitchHeatmap.test.ts src/components/WorkbenchShell.test.tsx src/features/spectrogramViewer/SpectrogramView.test.tsx
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

Open this project in the built or dev app:

```text
D:\WORKSPACE\ZiQi_Projects\Active Planets - 木漏れ日カーテン.ziqiproject\Active Planets - 木漏れ日カーテン.ziqi
```

Expected:

- Reset/default display values are `Gain 0`, `Contrast 1`, `Range 110`, `Floor -40`, `Intensity 1`.
- The default heatmap is not all red and not all blue.
- Pulling `Range` toward `80` increases contrast without immediately making the full heatmap red.
- Pulling `Floor` within `-80..0` changes visibility gradually.

- [ ] **Step 6: Commit only if verification requires a fix**

If verification required no code changes, do not create a commit.

---

## Completion Criteria

- `DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS` uses `gainDb: 0`, `contrast: 1`, `dynamicRangeDb: 110`, `noiseFloorDb: -40`, `colorIntensity: 1`.
- Clamp ranges are `gainDb -48..24`, `contrast 0.6..1.8`, `dynamicRangeDb 80..150`, `noiseFloorDb -80..0`, `colorIntensity 0.5..1.4`.
- Control-zone sliders expose the same min/max values.
- `mapPitchEnergyToDisplayValue` is unchanged.
- No per-song adaptive normalization is introduced.
- Focused tests, full tests, lint, and build pass.
