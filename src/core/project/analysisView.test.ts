import { describe, expect, it } from "vitest";
import { DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS } from "../audio/pitchHeatmap";
import { normalizeProjectAnalysisView } from "./analysisView";

describe("normalizeProjectAnalysisView", () => {
  it("supplies default pitch heatmap settings for old projects", () => {
    expect(normalizeProjectAnalysisView(undefined)).toEqual({
      pitchHeatmapDisplay: DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS
    });
  });

  it("clamps saved pitch heatmap settings", () => {
    expect(
      normalizeProjectAnalysisView({
        pitchHeatmapDisplay: {
          gainDb: 90,
          contrast: 10,
          dynamicRangeDb: 1,
          noiseFloorDb: 0,
          colorIntensity: -1
        }
      })
    ).toEqual({
      pitchHeatmapDisplay: {
        gainDb: 36,
        contrast: 3,
        dynamicRangeDb: 40,
        noiseFloorDb: -40,
        colorIntensity: 0.5
      }
    });
  });
});
