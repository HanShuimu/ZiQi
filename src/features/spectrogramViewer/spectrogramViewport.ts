import type { PitchEnergyOverview, SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import {
  filterItemsForViewport,
  type SpectrogramViewport
} from "../../core/spectrogramViewport";

export function filterSpectrogramFramesForViewport(
  spectrogramOverview: SpectrogramOverview,
  viewport: SpectrogramViewport
) {
  return filterItemsForViewport(spectrogramOverview.frames, viewport);
}

export function filterPitchEnergyFramesForViewport(
  pitchEnergyOverview: PitchEnergyOverview | null | undefined,
  viewport: SpectrogramViewport
) {
  return filterItemsForViewport(pitchEnergyOverview?.frames ?? [], viewport);
}

export function filterWaveformPointsForViewport(
  waveformOverview: WaveformOverview | null | undefined,
  viewport: SpectrogramViewport
) {
  return filterItemsForViewport(waveformOverview?.points ?? [], viewport);
}
