import { describe, expect, it } from "vitest";
import {
  MAX_PIANO_FREQUENCY_HZ,
  MIN_PIANO_FREQUENCY_HZ,
  PIANO_KEYS,
  createSpectrogramOverviewFromBuffer,
  frequencyToLogPosition,
  magnitudeToSpectrogramColor
} from "./spectrogram";

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

describe("spectrogram domain", () => {
  it("defines a stable 88-key A0-C8 piano range", () => {
    expect(PIANO_KEYS).toHaveLength(88);
    expect(PIANO_KEYS[0]).toMatchObject({
      midiNumber: 21,
      name: "A0",
      isBlackKey: false
    });
    expect(PIANO_KEYS[87]).toMatchObject({
      midiNumber: 108,
      name: "C8",
      isBlackKey: false
    });
    expect(MIN_PIANO_FREQUENCY_HZ).toBeCloseTo(27.5, 1);
    expect(MAX_PIANO_FREQUENCY_HZ).toBeCloseTo(4186, 0);
  });

  it("maps frequencies onto a monotonic log-frequency display axis", () => {
    const low = frequencyToLogPosition(MIN_PIANO_FREQUENCY_HZ);
    const middle = frequencyToLogPosition(440);
    const high = frequencyToLogPosition(MAX_PIANO_FREQUENCY_HZ);

    expect(low).toBe(0);
    expect(middle).toBeGreaterThan(low);
    expect(middle).toBeLessThan(high);
    expect(high).toBe(1);
  });

  it("maps normalized magnitudes to the wavetone-style color ramp", () => {
    expect(magnitudeToSpectrogramColor(0)).toBe("rgb(0, 0, 24)");
    expect(magnitudeToSpectrogramColor(0.25)).toBe("rgb(0, 0, 255)");
    expect(magnitudeToSpectrogramColor(0.5)).toBe("rgb(0, 255, 0)");
    expect(magnitudeToSpectrogramColor(0.75)).toBe("rgb(255, 255, 0)");
    expect(magnitudeToSpectrogramColor(1)).toBe("rgb(255, 0, 0)");
  });

  it("creates fixed-rate log-frequency spectrogram frames with normalized magnitudes", () => {
    const samples = new Float32Array(4096);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin((2 * Math.PI * 440 * index) / 4096);
    }
    const buffer = new FakeAudioBuffer([samples], 4096);

    const overview = createSpectrogramOverviewFromBuffer(buffer, {
      binsPerFrame: 24,
      framesPerSecond: 8,
      fftSize: 512
    });

    expect(overview.durationMs).toBe(1000);
    expect(overview.framesPerSecond).toBe(8);
    expect(overview.binsPerFrame).toBe(24);
    expect(overview.minFrequencyHz).toBe(MIN_PIANO_FREQUENCY_HZ);
    expect(overview.maxFrequencyHz).toBe(MAX_PIANO_FREQUENCY_HZ);
    expect(overview.frames).toHaveLength(8);
    for (const frame of overview.frames) {
      expect(frame.magnitudes).toHaveLength(24);
      expect(Math.min(...frame.magnitudes)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...frame.magnitudes)).toBeLessThanOrEqual(1);
    }
  });

  it("places a known sine frequency near its log-frequency bin", () => {
    const sampleRate = 8192;
    const frequencyHz = 440;
    const binsPerFrame = 48;
    const samples = new Float32Array(sampleRate);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate);
    }
    const buffer = new FakeAudioBuffer([samples], sampleRate);

    const overview = createSpectrogramOverviewFromBuffer(buffer, {
      binsPerFrame,
      framesPerSecond: 1,
      fftSize: 2048
    });
    const magnitudes = overview.frames[0].magnitudes;
    const strongestBinIndex = magnitudes.indexOf(Math.max(...magnitudes));
    const expectedBinIndex = Math.floor(frequencyToLogPosition(frequencyHz) * binsPerFrame);

    expect(strongestBinIndex).toBeGreaterThanOrEqual(expectedBinIndex - 1);
    expect(strongestBinIndex).toBeLessThanOrEqual(expectedBinIndex + 1);
  });

  it("normalizes long multi-frame overviews without exceeding argument limits", () => {
    const samples = new Float32Array(256);
    samples[0] = 1;
    const buffer = new FakeAudioBuffer([samples], 1);

    expect(() =>
      createSpectrogramOverviewFromBuffer(buffer, {
        binsPerFrame: 1,
        framesPerSecond: 512,
        fftSize: 8
      })
    ).not.toThrow();
  });

  it("mixes multiple channels into mono before analysis", () => {
    const left = new Float32Array([1, 1, 1, 1, 1, 1, 1, 1]);
    const right = new Float32Array([-1, -1, -1, -1, -1, -1, -1, -1]);
    const buffer = new FakeAudioBuffer([left, right], 8);

    const overview = createSpectrogramOverviewFromBuffer(buffer, {
      binsPerFrame: 8,
      framesPerSecond: 2,
      fftSize: 8
    });

    expect(overview.frames.flatMap((frame) => frame.magnitudes)).toEqual(
      expect.arrayContaining([0])
    );
    expect(Math.max(...overview.frames.flatMap((frame) => frame.magnitudes))).toBe(0);
  });

  it("returns empty frames for empty audio", () => {
    const buffer = new FakeAudioBuffer([new Float32Array()], 44_100);

    const overview = createSpectrogramOverviewFromBuffer(buffer);

    expect(overview.durationMs).toBe(0);
    expect(overview.frames).toEqual([]);
  });
});
