import type { SpectrogramOverview, WaveformOverview } from "../core/audio/types";
import {
  filterItemsForViewport,
  type SpectrogramViewport
} from "../core/spectrogramViewport";

export type { SpectrogramViewport } from "../core/spectrogramViewport";
export {
  DEFAULT_SPECTROGRAM_VIEWPORT_DURATION_MS,
  MIN_SPECTROGRAM_VIEWPORT_DURATION_MS,
  clampSpectrogramViewport,
  createDefaultSpectrogramViewport,
  filterItemsForViewport,
  formatTimeLabel,
  formatViewportRange,
  isTimeInsideViewport,
  panSpectrogramViewport,
  timeToTrackPercent,
  timeToViewportPercent,
  zoomSpectrogramViewport
} from "../core/spectrogramViewport";

export function filterSpectrogramFramesForViewport(
  spectrogramOverview: SpectrogramOverview,
  viewport: SpectrogramViewport
) {
  return filterItemsForViewport(spectrogramOverview.frames, viewport);
}

export function filterWaveformPointsForViewport(
  waveformOverview: WaveformOverview | null | undefined,
  viewport: SpectrogramViewport
) {
  return filterItemsForViewport(waveformOverview?.points ?? [], viewport);
}
