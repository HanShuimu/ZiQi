import type { WaveformOverview } from "../../core/audio/types";
import { timeToViewportPercent, type SpectrogramViewport } from "../../core/spectrogramViewport";

const DEFAULT_MAX_BAR_GRID_LINES = 1_000;
const DEFAULT_MAX_RENDERED_WAVEFORM_POINTS = 800;
type RenderedWaveformPoint = WaveformOverview["points"][number];

export function getRenderedWaveformPoints(
  points: RenderedWaveformPoint[],
  maxPointCount = DEFAULT_MAX_RENDERED_WAVEFORM_POINTS
): RenderedWaveformPoint[] {
  if (points.length <= maxPointCount) {
    return points;
  }

  return Array.from({ length: maxPointCount }, (_, index) => {
    const startIndex = Math.floor((index * points.length) / maxPointCount);
    const endIndex = Math.floor(((index + 1) * points.length) / maxPointCount);
    const group = points.slice(startIndex, Math.max(startIndex + 1, endIndex));

    return {
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      peak: Math.max(...group.map((point) => point.peak))
    };
  });
}

export function createTimeGridLines(viewport: SpectrogramViewport) {
  if (viewport.durationMs <= 0) {
    return [];
  }

  const durationSeconds = viewport.durationMs / 1000;
  const intervalSeconds = chooseGridIntervalSeconds(durationSeconds);
  const firstLineSeconds = Math.ceil(viewport.startMs / 1000 / intervalSeconds) * intervalSeconds;
  const endSeconds = (viewport.startMs + viewport.durationMs) / 1000;
  const positions: number[] = [];

  for (
    let lineSeconds = firstLineSeconds;
    lineSeconds < endSeconds;
    lineSeconds += intervalSeconds
  ) {
    const lineMs = lineSeconds * 1000;
    const position = timeToViewportPercent(lineMs, viewport);
    if (position > 0 && position < 100) {
      positions.push(Math.round(position * 10) / 10);
    }
  }

  return positions;
}

export function createBarGridLines(
  viewport: SpectrogramViewport,
  settings: { beatOffsetMs: number; beatsPerBar: number; bpm: number },
  maxLineCount = DEFAULT_MAX_BAR_GRID_LINES
) {
  const { beatOffsetMs, beatsPerBar, bpm } = settings;

  if (
    !Number.isFinite(viewport.startMs) ||
    !Number.isFinite(viewport.durationMs) ||
    !Number.isFinite(beatOffsetMs) ||
    !Number.isFinite(beatsPerBar) ||
    !Number.isFinite(bpm) ||
    viewport.durationMs <= 0 ||
    beatsPerBar <= 0 ||
    bpm <= 0
  ) {
    return [];
  }

  const barDurationMs = (60_000 / bpm) * beatsPerBar;
  if (!Number.isFinite(barDurationMs) || barDurationMs <= 0) {
    return [];
  }

  const viewportEndMs = viewport.startMs + viewport.durationMs;
  const firstBarIndex = Math.ceil((viewport.startMs - beatOffsetMs) / barDurationMs);
  const lines: Array<{ leftPercent: number; timeMs: number }> = [];

  for (
    let barStartMs = beatOffsetMs + firstBarIndex * barDurationMs;
    barStartMs < viewportEndMs && lines.length < maxLineCount;
    barStartMs += barDurationMs
  ) {
    if (barStartMs >= viewport.startMs) {
      lines.push({
        leftPercent: Math.round(timeToViewportPercent(barStartMs, viewport) * 1_000_000) / 1_000_000,
        timeMs: barStartMs
      });
    }
  }

  return lines;
}

function chooseGridIntervalSeconds(durationSeconds: number) {
  if (durationSeconds <= 30) {
    return 5;
  }

  if (durationSeconds <= 180) {
    return 15;
  }

  return 30;
}
