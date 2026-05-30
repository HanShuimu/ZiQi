import { describe, expect, it } from "vitest";
import {
  DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
  MAX_PITCH_MIDI_NUMBER,
  MIN_PITCH_MIDI_NUMBER,
  PITCH_HEATMAP_NOTE_COUNT,
  clampPitchHeatmapDisplaySettings,
  createPitchEnergyFrame,
  getMidiNumberForPitchIndex,
  getPitchIndexForMidiNumber,
  mapPitchEnergyToDisplayValue
} from "./pitchHeatmap";

function energyForNormalizedDisplayValue(value: number) {
  const db =
    DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.noiseFloorDb +
    DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.dynamicRangeDb * value;

  return 10 ** (db / 20);
}

describe("pitch heatmap helpers", () => {
  it("maps A0-C8 to stable 88-key indexes", () => {
    expect(MIN_PITCH_MIDI_NUMBER).toBe(21);
    expect(MAX_PITCH_MIDI_NUMBER).toBe(108);
    expect(PITCH_HEATMAP_NOTE_COUNT).toBe(88);
    expect(getMidiNumberForPitchIndex(0)).toBe(21);
    expect(getMidiNumberForPitchIndex(48)).toBe(69);
    expect(getMidiNumberForPitchIndex(87)).toBe(108);
    expect(getPitchIndexForMidiNumber(21)).toBe(0);
    expect(getPitchIndexForMidiNumber(69)).toBe(48);
    expect(getPitchIndexForMidiNumber(108)).toBe(87);
  });

  it("creates fixed-width pitch energy frames", () => {
    expect(createPitchEnergyFrame({ startMs: 0, endMs: 42 }).energies).toHaveLength(88);
  });

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

  it("clamps display settings loaded from project files", () => {
    expect(
      clampPitchHeatmapDisplaySettings({
        gainDb: 99,
        contrast: -1,
        dynamicRangeDb: 999,
        noiseFloorDb: 0,
        colorIntensity: 99
      })
    ).toEqual({
      gainDb: 24,
      contrast: 0.6,
      dynamicRangeDb: 150,
      noiseFloorDb: 0,
      colorIntensity: 1.4
    });
  });

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

  it("fills missing display settings with defaults", () => {
    expect(clampPitchHeatmapDisplaySettings({ gainDb: 6 })).toEqual({
      ...DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
      gainDb: 6
    });
  });

  it("maps energy through display controls into 0..1", () => {
    const dim = mapPitchEnergyToDisplayValue(0.01, DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS);
    const bright = mapPitchEnergyToDisplayValue(1, DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS);
    expect(dim).toBeGreaterThanOrEqual(0);
    expect(bright).toBeLessThanOrEqual(1);
    expect(bright).toBeGreaterThan(dim);
  });

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

  it("uses noise floor as background cutoff", () => {
    expect(
      mapPitchEnergyToDisplayValue(0, {
        ...DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
        noiseFloorDb: -40
      })
    ).toBe(0);
  });
});
