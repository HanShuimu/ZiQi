import type { PitchEnergyFrame, PitchHeatmapDisplaySettings } from "./types";

export const MIN_PITCH_MIDI_NUMBER = 21;
export const MAX_PITCH_MIDI_NUMBER = 108;
export const PITCH_HEATMAP_NOTE_COUNT = 88;
export const MIN_PITCH_FREQUENCY_HZ = 27.5;
export const PITCH_HEATMAP_MIN_LANE_HEIGHT_PX = 6;
export const PITCH_HEATMAP_MIN_HEIGHT_PX =
  PITCH_HEATMAP_NOTE_COUNT * PITCH_HEATMAP_MIN_LANE_HEIGHT_PX;

export const DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS: PitchHeatmapDisplaySettings = {
  gainDb: 0,
  contrast: 1,
  dynamicRangeDb: 80,
  noiseFloorDb: -90,
  colorIntensity: 1
};

const SETTING_RANGES = {
  gainDb: { min: -24, max: 36 },
  contrast: { min: 0.5, max: 3 },
  dynamicRangeDb: { min: 40, max: 120 },
  noiseFloorDb: { min: -120, max: -40 },
  colorIntensity: { min: 0.5, max: 2 }
} as const;

export function getMidiNumberForPitchIndex(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= PITCH_HEATMAP_NOTE_COUNT) {
    throw new Error("Pitch index is outside A0-C8.");
  }

  return MIN_PITCH_MIDI_NUMBER + index;
}

export function getPitchIndexForMidiNumber(midiNumber: number) {
  if (
    !Number.isInteger(midiNumber) ||
    midiNumber < MIN_PITCH_MIDI_NUMBER ||
    midiNumber > MAX_PITCH_MIDI_NUMBER
  ) {
    throw new Error("MIDI number is outside A0-C8.");
  }

  return midiNumber - MIN_PITCH_MIDI_NUMBER;
}

export function createPitchEnergyFrame({
  startMs,
  endMs,
  energies = new Array(PITCH_HEATMAP_NOTE_COUNT).fill(0)
}: {
  startMs: number;
  endMs: number;
  energies?: number[];
}): PitchEnergyFrame {
  return {
    startMs,
    endMs,
    energies: normalizeEnergyArray(energies)
  };
}

export function clampPitchHeatmapDisplaySettings(
  settings: Partial<PitchHeatmapDisplaySettings> | null | undefined
): PitchHeatmapDisplaySettings {
  const source = settings ?? {};

  return {
    gainDb: clampNumber(
      source.gainDb,
      SETTING_RANGES.gainDb,
      DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.gainDb
    ),
    contrast: clampNumber(
      source.contrast,
      SETTING_RANGES.contrast,
      DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.contrast
    ),
    dynamicRangeDb: clampNumber(
      source.dynamicRangeDb,
      SETTING_RANGES.dynamicRangeDb,
      DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.dynamicRangeDb
    ),
    noiseFloorDb: clampNumber(
      source.noiseFloorDb,
      SETTING_RANGES.noiseFloorDb,
      DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.noiseFloorDb
    ),
    colorIntensity: clampNumber(
      source.colorIntensity,
      SETTING_RANGES.colorIntensity,
      DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS.colorIntensity
    )
  };
}

export function mapPitchEnergyToDisplayValue(
  energy: number,
  settings: PitchHeatmapDisplaySettings
) {
  const safeEnergy = Math.max(0, Number.isFinite(energy) ? energy : 0);
  const db = 20 * Math.log10(Math.max(safeEnergy, 1e-12)) + settings.gainDb;

  if (db <= settings.noiseFloorDb) {
    return 0;
  }

  const rangeTopDb = settings.noiseFloorDb + settings.dynamicRangeDb;
  const normalized =
    (db - settings.noiseFloorDb) / Math.max(1, rangeTopDb - settings.noiseFloorDb);
  const contrasted = normalized ** (1 / settings.contrast);

  return clamp01(contrasted * settings.colorIntensity);
}

function normalizeEnergyArray(energies: number[]) {
  return Array.from({ length: PITCH_HEATMAP_NOTE_COUNT }, (_, index) => {
    const value = energies[index] ?? 0;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });
}

function clampNumber(
  value: number | undefined,
  range: { min: number; max: number },
  fallback: number
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(range.max, Math.max(range.min, value));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
