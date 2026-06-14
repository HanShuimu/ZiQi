import type { PitchEnergyOverview, SpectrogramOverview } from "../../core/audio/types";
import { PITCH_HEATMAP_NOTE_COUNT } from "../../core/audio/pitchHeatmap";

export function convertSpectrogramToPitchEnergy(
  spectrogramOverview: SpectrogramOverview | null | undefined
): PitchEnergyOverview | null {
  if (!spectrogramOverview) {
    return null;
  }

  return {
    durationMs: spectrogramOverview.durationMs,
    framesPerSecond: spectrogramOverview.framesPerSecond,
    minMidiNumber: 21,
    maxMidiNumber: 108,
    notesPerFrame: PITCH_HEATMAP_NOTE_COUNT,
    frames: spectrogramOverview.frames.map((frame) => ({
      startMs: frame.startMs,
      endMs: frame.endMs,
      energies: Array.from({ length: PITCH_HEATMAP_NOTE_COUNT }, (_, index) => {
        const sourceIndex = Math.floor((index * frame.magnitudes.length) / PITCH_HEATMAP_NOTE_COUNT);
        return frame.magnitudes[sourceIndex] ?? 0;
      })
    }))
  };
}
