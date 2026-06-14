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
    expect(description.text).toContain("Spectrogram peak area");
    expect(description.text).toContain("350 Hz");
    expect(description.json.pitchSummary.peakMoments).toEqual([]);
    expect(description.json.spectrogramSummary).toMatchObject({
      frequencyRangeHz: {
        minHz: 100,
        maxHz: 500,
        binCount: 4
      },
      strongestFrequencyHz: 350,
      strongestFrequencyBand: "mid",
      averageMagnitudeByFrequencyBand: {
        low: 0.15,
        mid: 0.45,
        high: 0.55
      }
    });
    expect(description.json.spectrogramSummary.peakMoments).toEqual([
      {
        startMs: 2_500,
        endMs: 3_000,
        timeMs: 2_750,
        frequencyHz: 450,
        frequencyBand: "high",
        magnitude: 0.9
      },
      {
        startMs: 2_000,
        endMs: 2_500,
        timeMs: 2_250,
        frequencyHz: 350,
        frequencyBand: "mid",
        magnitude: 0.8
      }
    ]);
    expect(description.json.source.analysisKind).toBe("spectrogram");
  });

  it("describes overlapping silent pitch frames as having no significant pitch peak", () => {
    const description = describeSelectedRangeForLlm({
      projectName: "Silent Pitch",
      audioName: "near-silence.wav",
      selectedTimeRange: { startMs: 2_000, endMs: 3_500 },
      beatSettings: { bpm: 120, beatsPerBar: 4, beatOffsetMs: 0 },
      pitchEnergyOverview: createPitchEnergyOverview([
        createPitchFrame(2_000, 2_500, [
          [60, 0],
          [61, Number.NaN]
        ]),
        createPitchFrame(2_500, 3_000, [
          [64, Number.POSITIVE_INFINITY]
        ])
      ]),
      spectrogramOverview: null
    });

    expect(description.text).not.toContain("No pitch-energy frames are available");
    expect(description.text).toContain("no significant pitch");
    expect(description.json.pitchSummary.peakMoments).toEqual([]);
    expect(description.json.source.analysisKind).toBe("pitch-energy");
  });

  it("does not report peak moments beyond the declared pitch count", () => {
    const description = describeSelectedRangeForLlm({
      projectName: "Short Pitch Map",
      audioName: "short.wav",
      selectedTimeRange: { startMs: 2_000, endMs: 3_500 },
      beatSettings: { bpm: 120, beatsPerBar: 4, beatOffsetMs: 0 },
      pitchEnergyOverview: {
        ...createPitchEnergyOverview([
          {
            startMs: 2_000,
            endMs: 2_500,
            energies: [0.2, 0.4, 0.99]
          }
        ]),
        notesPerFrame: 2 as 88
      },
      spectrogramOverview: null
    });

    expect(description.json.pitchSummary.peakMoments).toEqual([
      {
        startMs: 2_000,
        endMs: 2_500,
        timeMs: 2_250,
        midiNumber: 22,
        noteName: "A#0",
        energy: 0.4
      }
    ]);
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
    minFrequencyHz: 100,
    maxFrequencyHz: 500,
    binsPerFrame: 4,
    frames: [
      {
        startMs: 2_000,
        endMs: 2_500,
        magnitudes: [0.1, 0.5, 0.8, 0.2]
      },
      {
        startMs: 2_500,
        endMs: 3_000,
        magnitudes: [0.2, 0.1, 0.4, 0.9]
      }
    ]
  };
}
