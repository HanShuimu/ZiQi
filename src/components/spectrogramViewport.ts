import type { SpectrogramOverview, WaveformOverview } from "../domain/audio/types";

export interface SpectrogramViewport {
  startMs: number;
  durationMs: number;
}

export const DEFAULT_SPECTROGRAM_VIEWPORT_DURATION_MS = 10_000;
export const MIN_SPECTROGRAM_VIEWPORT_DURATION_MS = 1_000;
const WHEEL_ZOOM_STEP = 1.2;
const PAN_STEP_RATIO = 0.1;

export function createDefaultSpectrogramViewport(totalDurationMs: number): SpectrogramViewport {
  if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
    return { startMs: 0, durationMs: 0 };
  }

  return {
    startMs: 0,
    durationMs: Math.min(DEFAULT_SPECTROGRAM_VIEWPORT_DURATION_MS, totalDurationMs)
  };
}

export function clampSpectrogramViewport(
  viewport: SpectrogramViewport,
  totalDurationMs: number
): SpectrogramViewport {
  if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
    return { startMs: 0, durationMs: 0 };
  }

  const minDurationMs = Math.min(MIN_SPECTROGRAM_VIEWPORT_DURATION_MS, totalDurationMs);
  const durationMs = Math.min(
    totalDurationMs,
    Math.max(minDurationMs, Math.round(viewport.durationMs))
  );
  const maxStartMs = Math.max(0, totalDurationMs - durationMs);
  const startMs = Math.min(maxStartMs, Math.max(0, Math.round(viewport.startMs)));

  return { startMs, durationMs };
}

export function zoomSpectrogramViewport({
  viewport,
  totalDurationMs,
  anchorRatio,
  deltaY
}: {
  viewport: SpectrogramViewport;
  totalDurationMs: number;
  anchorRatio: number;
  deltaY: number;
}) {
  if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0 || viewport.durationMs <= 0) {
    return { startMs: 0, durationMs: 0 };
  }

  const boundedAnchorRatio = Math.min(1, Math.max(0, anchorRatio));
  const zoomLevel = Math.abs(deltaY) / 100;
  const zoomFactor = deltaY < 0
    ? 1 / Math.pow(WHEEL_ZOOM_STEP, zoomLevel)
    : Math.pow(WHEEL_ZOOM_STEP, zoomLevel);
  const nextDurationMs = viewport.durationMs * zoomFactor;
  const anchorTimeMs = viewport.startMs + viewport.durationMs * boundedAnchorRatio;
  const nextStartMs = anchorTimeMs - nextDurationMs * boundedAnchorRatio;

  return clampSpectrogramViewport(
    {
      startMs: nextStartMs,
      durationMs: nextDurationMs
    },
    totalDurationMs
  );
}

export function panSpectrogramViewport({
  viewport,
  totalDurationMs,
  direction
}: {
  viewport: SpectrogramViewport;
  totalDurationMs: number;
  direction: number;
}) {
  return clampSpectrogramViewport(
    {
      ...viewport,
      startMs: viewport.startMs + viewport.durationMs * PAN_STEP_RATIO * direction
    },
    totalDurationMs
  );
}

export function filterSpectrogramFramesForViewport(
  spectrogramOverview: SpectrogramOverview,
  viewport: SpectrogramViewport
) {
  const endMs = viewport.startMs + viewport.durationMs;

  return spectrogramOverview.frames.filter(
    (frame) => frame.endMs > viewport.startMs && frame.startMs < endMs
  );
}

export function filterWaveformPointsForViewport(
  waveformOverview: WaveformOverview | null | undefined,
  viewport: SpectrogramViewport
) {
  const points = waveformOverview?.points ?? [];
  const endMs = viewport.startMs + viewport.durationMs;

  return points.filter((point) => point.endMs > viewport.startMs && point.startMs < endMs);
}

export function timeToViewportPercent(timeMs: number, viewport: SpectrogramViewport) {
  if (viewport.durationMs <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, ((timeMs - viewport.startMs) / viewport.durationMs) * 100));
}

export function timeToTrackPercent(timeMs: number, totalDurationMs: number) {
  if (!Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (timeMs / totalDurationMs) * 100));
}

export function isTimeInsideViewport(timeMs: number, viewport: SpectrogramViewport) {
  return timeMs >= viewport.startMs && timeMs <= viewport.startMs + viewport.durationMs;
}

export function formatTimeLabel(timeMs: number) {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatViewportRange(viewport: SpectrogramViewport) {
  return `${formatTimeLabel(viewport.startMs)}-${formatTimeLabel(
    viewport.startMs + viewport.durationMs
  )}`;
}
