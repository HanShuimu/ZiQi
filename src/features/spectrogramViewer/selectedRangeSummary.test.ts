import { describe, expect, it } from "vitest";
import type { PitchEnergyOverview, SpectrogramOverview } from "../../core/audio/types";
import { describeSelectedRangeForLlm } from "./selectedRangeSummary";

describe("describeSelectedRangeForLlm", () => {
  it("describes the selected range with project, beat, pitch, and source context", () => {
    const description = describeSelectedRangeForLlm({
      projectName: "Selection Lab",
      audioName: "take-03.wav",
      selectedTimeRange: { startMs: 2_000, endMs: 3_500 },
      beatSettings: { bpm: 120, beatsPerBar: 4, beatOffsetMs: 0 },
      pitchEnergyOverview: createPitchEnergyOverview([
        createPitchFrame(1_000, 1_900, [
          [60, 0.95]
        ]),
        createPitchFrame(1_900, 2_400, [
          [60, 0.25],
          [64, 0.7]
        ]),
        createPitchFrame(2_400, 3_000, [
          [64, 0.4],
          [67, 0.95]
        ]),
        createPitchFrame(3_000, 3_600, [
          [72, 0.8]
        ]),
        createPitchFrame(3_600, 4_000, [
          [72, 0.99]
        ])
      ]),
      spectrogramOverview: null
    });

    expect(description.text).toContain("Selection Lab");
    expect(description.text).toContain("2.000s to 3.500s");
    expect(description.json.range).toEqual({
      startMs: 2_000,
      endMs: 3_500,
      durationMs: 1_500
    });
    expect(description.json.beatContext).toMatchObject({
      bpm: 120,
      beatsPerBar: 4,
      beatOffsetMs: 0,
      startBarBeat: "2:1"
    });
    expect(description.json.source).toEqual({
      projectName: "Selection Lab",
      audioName: "take-03.wav",
      analysisKind: "pitch-energy"
    });
    expect(description.json.pitchSummary.peakMoments).toHaveLength(3);
  });

  it("returns an empty pitch summary and readable fallback text when pitch frames are unavailable", () => {
    const description = describeSelectedRangeForLlm({
      projectName: "Empty Pitch",
      audioName: "silence.wav",
      selectedTimeRange: { startMs: 500, endMs: 1_000 },
      beatSettings: { bpm: 90, beatsPerBar: 3, beatOffsetMs: 0 },
      pitchEnergyOverview: createPitchEnergyOverview([]),
      spectrogramOverview: null
    });

    expect(description.text).toContain("No pitch-energy frames are available");
    expect(description.json.pitchSummary.peakMoments).toEqual([]);
    expect(description.json.pitchSummary.averageEnergyByPitchBand).toEqual({
      low: 0,
      mid: 0,
      high: 0
    });
    expect(description.json.source.analysisKind).toBe("pitch-energy");
  });

  it("uses spectrogram as the source kind when only spectrogram frames overlap the selection", () => {
    const description = describeSelectedRangeForLlm({
      projectName: "Spectrogram Only",
      audioName: "mixed.wav",
      selectedTimeRange: { startMs: 2_000, endMs: 3_500 },
      beatSettings: { bpm: 120, beatsPerBar: 4, beatOffsetMs: 0 },
      pitchEnergyOverview: null,
      spectrogramOverview: createSpectrogramOverview()
    });

    expect(description.text).toContain("No pitch-energy frames are available");
    expect(description.json.pitchSummary.peakMoments).toEqual([]);
    expect(description.json.source.analysisKind).toBe("spectrogram");
  });
});

function createPitchEnergyOverview(frames: PitchEnergyOverview["frames"]): PitchEnergyOverview {
  return {
    durationMs: 6_000,
    framesPerSecond: 2,
    minMidiNumber: 21,
    maxMidiNumber: 108,
    notesPerFrame: 88,
    frames
  };
}

function createPitchFrame(
  startMs: number,
  endMs: number,
  midiEnergies: Array<[midiNumber: number, energy: number]>
): PitchEnergyOverview["frames"][number] {
  const energies = Array.from({ length: 88 }, () => 0);

  for (const [midiNumber, energy] of midiEnergies) {
    energies[midiNumber - 21] = energy;
  }

  return { startMs, endMs, energies };
}

function createSpectrogramOverview(): SpectrogramOverview {
  return {
    durationMs: 6_000,
    framesPerSecond: 2,
    minFrequencyHz: 27.5,
    maxFrequencyHz: 4_186,
    binsPerFrame: 4,
    frames: [
      {
        startMs: 2_000,
        endMs: 2_500,
        magnitudes: [0.1, 0.5, 0.8, 0.2]
      }
    ]
  };
}
