import {
  PITCH_HEATMAP_NOTE_COUNT,
  getMidiNumberForPitchIndex
} from "../../core/audio/pitchHeatmap";
import type { SpectrogramViewport } from "../../core/spectrogramViewport";
import { PIANO_KEYS } from "../../services/audio/spectrogram";

export interface HeatmapPointerBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HeatmapPointerState {
  xPercent: number;
  yPercent: number;
  timeMs: number;
  pitchIndex: number;
  midiNumber: number;
  noteName: string;
  frequencyHz: number;
}

export function getPitchLaneStyle(pitchIndex: number) {
  const heightPercent = 100 / PITCH_HEATMAP_NOTE_COUNT;
  const bottomPercent = (pitchIndex * 100) / PITCH_HEATMAP_NOTE_COUNT;

  return {
    bottomPercent,
    topPercent: ((PITCH_HEATMAP_NOTE_COUNT - pitchIndex - 1) * 100) / PITCH_HEATMAP_NOTE_COUNT,
    heightPercent
  };
}

export function getPitchLaneCssProperties(pitchIndex: number): { bottom: string; height: string } {
  const { bottomPercent, heightPercent } = getPitchLaneStyle(pitchIndex);

  return {
    bottom: `${bottomPercent}%`,
    height: `${heightPercent}%`
  };
}

export function getPitchHoverStateFromPoint({
  clientX,
  clientY,
  bounds,
  viewport
}: {
  clientX: number;
  clientY: number;
  bounds: HeatmapPointerBounds;
  viewport: SpectrogramViewport;
}): HeatmapPointerState | null {
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    !Number.isFinite(viewport.startMs) ||
    !Number.isFinite(viewport.durationMs) ||
    viewport.durationMs <= 0
  ) {
    return null;
  }

  const xOffset = clamp(clientX - bounds.left, 0, bounds.width);
  const yOffset = clamp(clientY - bounds.top, 0, bounds.height);
  const xRatio = xOffset / bounds.width;
  const yRatio = yOffset / bounds.height;
  const topLaneIndex = Math.min(
    PITCH_HEATMAP_NOTE_COUNT - 1,
    Math.floor(yRatio * PITCH_HEATMAP_NOTE_COUNT)
  );
  const pitchIndex = PITCH_HEATMAP_NOTE_COUNT - 1 - topLaneIndex;
  const midiNumber = getMidiNumberForPitchIndex(pitchIndex);
  const pianoKey = PIANO_KEYS.find((key) => key.midiNumber === midiNumber);

  return {
    xPercent: xRatio * 100,
    yPercent: yRatio * 100,
    timeMs: viewport.startMs + viewport.durationMs * xRatio,
    pitchIndex,
    midiNumber,
    noteName: pianoKey?.name ?? midiNumber.toString(),
    frequencyHz: pianoKey?.frequencyHz ?? 0
  };
}

export function formatPreciseTimeLabel(timeMs: number) {
  const safeTimeMs = Math.max(0, Math.floor(timeMs));
  const totalSeconds = Math.floor(safeTimeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = safeTimeMs % 1000;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
