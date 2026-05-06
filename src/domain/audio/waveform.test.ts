import { describe, expect, it } from "vitest";
import { createWaveformOverviewFromBuffer } from "./waveform";

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

describe("createWaveformOverviewFromBuffer", () => {
  it("creates points at a fixed time-based rate", () => {
    const buffer = new FakeAudioBuffer([new Float32Array([0, 0.5, -1, 0.25])], 4);

    const overview = createWaveformOverviewFromBuffer(buffer, { pointsPerSecond: 2 });

    expect(overview).toEqual({
      pointsPerSecond: 2,
      durationMs: 1000,
      points: [
        { startMs: 0, endMs: 500, peak: 0.5 },
        { startMs: 500, endMs: 1000, peak: 1 }
      ]
    });
  });

  it("mixes multiple channels into mono before calculating peak", () => {
    const left = new Float32Array([0.2, 0.2, 0.2, 0.2]);
    const right = new Float32Array([1, 1, 0, 0]);
    const buffer = new FakeAudioBuffer([left, right], 4);

    const overview = createWaveformOverviewFromBuffer(buffer, { pointsPerSecond: 2 });

    expect(overview.points).toEqual([
      { startMs: 0, endMs: 500, peak: 0.6 },
      { startMs: 500, endMs: 1000, peak: 0.1 }
    ]);
  });

  it("clamps peaks into the 0..1 range", () => {
    const buffer = new FakeAudioBuffer([new Float32Array([0, 2, -3, 0])], 4);

    const overview = createWaveformOverviewFromBuffer(buffer, { pointsPerSecond: 2 });

    expect(overview.points.map((point) => point.peak)).toEqual([1, 1]);
  });

  it("returns an empty overview for empty audio", () => {
    const buffer = new FakeAudioBuffer([new Float32Array()], 44_100);

    const overview = createWaveformOverviewFromBuffer(buffer, { pointsPerSecond: 50 });

    expect(overview).toEqual({
      pointsPerSecond: 50,
      durationMs: 0,
      points: []
    });
  });
});
