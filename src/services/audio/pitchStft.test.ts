import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND,
  createMultiresolutionPitchEnergyOverviewFromBuffer,
  createPitchResolutionPlans,
  selectPitchResolutionPlan
} from "./pitchStft";

class FakeAudioBuffer {
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly sampleRate: number;

  constructor(private readonly channels: Float32Array[], sampleRate: number) {
    this.numberOfChannels = channels.length;
    this.sampleRate = sampleRate;
    this.duration = channels.length === 0 ? 0 : channels[0].length / sampleRate;
  }

  getChannelData(channel: number) {
    return this.channels[channel] ?? new Float32Array();
  }
}

function createSineSamples({
  durationSeconds,
  frequencyHz,
  sampleRate
}: {
  durationSeconds: number;
  frequencyHz: number;
  sampleRate: number;
}) {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate);
  }

  return samples;
}

function findStrongestPitchIndex(energies: number[]) {
  let strongestIndex = 0;
  let strongestEnergy = -Infinity;

  for (let index = 0; index < energies.length; index += 1) {
    if (energies[index] > strongestEnergy) {
      strongestEnergy = energies[index];
      strongestIndex = index;
    }
  }

  return strongestIndex;
}

describe("multiresolution pitch STFT", () => {
  it("uses 100 frames per second by default", () => {
    expect(DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND).toBe(100);

    const samples = new Float32Array(4_800);
    const buffer = new FakeAudioBuffer([samples], 48_000);
    const overview = createMultiresolutionPitchEnergyOverviewFromBuffer(buffer);

    expect(overview.framesPerSecond).toBe(100);
    expect(overview.frames).toHaveLength(10);
  });

  it("creates A0-C8 pitch frames with 88 energies per frame", () => {
    const samples = createSineSamples({
      durationSeconds: 0.2,
      frequencyHz: 440,
      sampleRate: 48_000
    });
    const buffer = new FakeAudioBuffer([samples], 48_000);

    const overview = createMultiresolutionPitchEnergyOverviewFromBuffer(buffer, {
      framesPerSecond: 20
    });

    expect(overview.minMidiNumber).toBe(21);
    expect(overview.maxMidiNumber).toBe(108);
    expect(overview.notesPerFrame).toBe(88);
    expect(overview.frames).toHaveLength(4);
    expect(overview.frames[0].energies).toHaveLength(88);
  });

  it("selects longer effective windows for lower notes and shorter windows for higher notes", () => {
    const plans = createPitchResolutionPlans(48_000);
    const a0Plan = selectPitchResolutionPlan({ midiNumber: 21, sampleRate: 48_000, plans });
    const a4Plan = selectPitchResolutionPlan({ midiNumber: 69, sampleRate: 48_000, plans });
    const c8Plan = selectPitchResolutionPlan({ midiNumber: 108, sampleRate: 48_000, plans });

    expect(a0Plan.effectiveWindowSamples).toBeGreaterThan(a4Plan.effectiveWindowSamples);
    expect(a4Plan.effectiveWindowSamples).toBeGreaterThan(c8Plan.effectiveWindowSamples);
    expect(a0Plan.frequencyBinWidthHz).toBeLessThan(1);
    expect(c8Plan.downsampleFactor).toBe(1);
  });

  it("separates adjacent A4 and A#4 synthetic semitones into different bins", () => {
    const sampleRate = 48_000;
    const durationSeconds = 0.75;
    const a4 = new FakeAudioBuffer(
      [createSineSamples({ durationSeconds, frequencyHz: 440, sampleRate })],
      sampleRate
    );
    const aSharp4 = new FakeAudioBuffer(
      [createSineSamples({ durationSeconds, frequencyHz: 466.1637615, sampleRate })],
      sampleRate
    );

    const a4Overview = createMultiresolutionPitchEnergyOverviewFromBuffer(a4, {
      framesPerSecond: 4
    });
    const aSharpOverview = createMultiresolutionPitchEnergyOverviewFromBuffer(aSharp4, {
      framesPerSecond: 4
    });

    const a4Index = findStrongestPitchIndex(a4Overview.frames[1].energies);
    const aSharpIndex = findStrongestPitchIndex(aSharpOverview.frames[1].energies);

    expect(a4Index).toBe(48);
    expect(aSharpIndex).toBe(49);
  });

  it("reports progress after each analyzed frame", () => {
    const samples = createSineSamples({
      durationSeconds: 0.25,
      frequencyHz: 440,
      sampleRate: 48_000
    });
    const buffer = new FakeAudioBuffer([samples], 48_000);
    const onProgress = vi.fn();

    createMultiresolutionPitchEnergyOverviewFromBuffer(buffer, {
      framesPerSecond: 8,
      onProgress
    });

    expect(onProgress).toHaveBeenCalledWith({ frameIndex: 1, frameCount: 2 });
    expect(onProgress).toHaveBeenCalledWith({ frameIndex: 2, frameCount: 2 });
  });

  it("returns empty frames for empty audio", () => {
    const buffer = new FakeAudioBuffer([new Float32Array()], 48_000);

    const overview = createMultiresolutionPitchEnergyOverviewFromBuffer(buffer);

    expect(overview.durationMs).toBe(0);
    expect(overview.frames).toEqual([]);
  });

  it("keeps silent audio near zero across all pitch bins", () => {
    const buffer = new FakeAudioBuffer([new Float32Array(4_800)], 48_000);

    const overview = createMultiresolutionPitchEnergyOverviewFromBuffer(buffer);

    expect(Math.max(...overview.frames.flatMap((frame) => frame.energies))).toBe(0);
  });
});
