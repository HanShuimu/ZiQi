import { describe, expect, it } from "vitest";
import type { SpectrogramOverview } from "../../core/audio/types";
import { convertSpectrogramToPitchEnergy } from "./pitchEnergyAdapter";

describe("pitchEnergyAdapter", () => {
  it("returns null without a spectrogram overview", () => {
    expect(convertSpectrogramToPitchEnergy(null)).toBeNull();
  });

  it("maps spectrogram bins into pitch energy frames", () => {
    const spectrogramOverview: SpectrogramOverview = {
      durationMs: 1_000,
      framesPerSecond: 10,
      minFrequencyHz: 20,
      maxFrequencyHz: 2_000,
      binsPerFrame: 2,
      frames: [
        {
          startMs: 0,
          endMs: 100,
          magnitudes: [0.25, 0.75]
        }
      ]
    };

    const pitchEnergy = convertSpectrogramToPitchEnergy(spectrogramOverview);

    expect(pitchEnergy?.notesPerFrame).toBe(88);
    expect(pitchEnergy?.frames[0].energies).toHaveLength(88);
    expect(pitchEnergy?.frames[0].energies[0]).toBe(0.25);
    expect(pitchEnergy?.frames[0].energies[87]).toBe(0.75);
  });
});
