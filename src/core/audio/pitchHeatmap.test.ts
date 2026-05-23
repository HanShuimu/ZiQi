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
      gainDb: 36,
      contrast: 0.5,
      dynamicRangeDb: 120,
      noiseFloorDb: -40,
      colorIntensity: 2
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

  it("uses noise floor as background cutoff", () => {
    expect(
      mapPitchEnergyToDisplayValue(0, {
        ...DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
        noiseFloorDb: -40
      })
    ).toBe(0);
  });
});
