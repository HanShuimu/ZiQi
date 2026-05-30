import {
  DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
  clampPitchHeatmapDisplaySettings
} from "../audio/pitchHeatmap";
import type { ProjectAnalysisView } from "./types";

export function createDefaultProjectAnalysisView(): ProjectAnalysisView {
  return {
    pitchHeatmapDisplay: DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS
  };
}

export function normalizeProjectAnalysisView(
  analysisView: Partial<ProjectAnalysisView> | null | undefined
): ProjectAnalysisView {
  return {
    pitchHeatmapDisplay: clampPitchHeatmapDisplaySettings(
      analysisView?.pitchHeatmapDisplay
    )
  };
}
