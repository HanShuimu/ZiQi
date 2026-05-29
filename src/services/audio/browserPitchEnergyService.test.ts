import { afterEach, describe, expect, it, vi } from "vitest";
import type { PitchEnergyOverview } from "../../core/audio/types";
import { createBrowserPitchEnergyService } from "./browserPitchEnergyService";

type DecodedAudioBuffer = {
  duration: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
};

type BuildOverviewOptions = {
  framesPerSecond: number;
  onProgress?: (progress: { frameIndex: number; frameCount: number }) => void;
};

class FakeAudioBuffer {
  readonly duration = 1;
  readonly numberOfChannels = 1;
  readonly sampleRate = 44_100;

  getChannelData() {
    return new Float32Array(44_100).fill(0.5);
  }
}

function createOverview(framesPerSecond: number): PitchEnergyOverview {
  return {
    durationMs: 1000,
    framesPerSecond,
    minMidiNumber: 21,
    maxMidiNumber: 108,
    notesPerFrame: 88,
    frames: []
  };
}

describe("createBrowserPitchEnergyService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "AudioContext");
  });

  it("builds pitch heatmaps at 100 frames per second by default", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodedAudio = new FakeAudioBuffer();
    const decodeAudioData = vi.fn().mockResolvedValue(decodedAudio);
    const buildOverviewFromBuffer = vi.fn(
      (_buffer: DecodedAudioBuffer, options: BuildOverviewOptions) =>
        createOverview(options.framesPerSecond)
    );

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService({ buildOverviewFromBuffer });
    const overview = await service.buildOverviewFromAudioData(new ArrayBuffer(8));

    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(buildOverviewFromBuffer).toHaveBeenCalledWith(
      decodedAudio,
      expect.objectContaining({ framesPerSecond: 100 })
    );
    expect(overview.framesPerSecond).toBe(100);
  });

  it("uses an explicit frames-per-second override", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodedAudio = new FakeAudioBuffer();
    const decodeAudioData = vi.fn().mockResolvedValue(decodedAudio);
    const buildOverviewFromBuffer = vi.fn(
      (_buffer: DecodedAudioBuffer, options: BuildOverviewOptions) =>
        createOverview(options.framesPerSecond)
    );

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService({ buildOverviewFromBuffer });
    const overview = await service.buildOverviewFromAudioData(new ArrayBuffer(8), {
      framesPerSecond: 30
    });

    expect(buildOverviewFromBuffer).toHaveBeenCalledWith(
      decodedAudio,
      expect.objectContaining({ framesPerSecond: 30 })
    );
    expect(overview.framesPerSecond).toBe(30);
  });

  it("logs pitch heatmap progress while analyzing frames", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodedAudio = new FakeAudioBuffer();
    const decodeAudioData = vi.fn().mockResolvedValue(decodedAudio);
    const buildOverviewFromBuffer = vi.fn(
      (_buffer: DecodedAudioBuffer, options: BuildOverviewOptions) => {
        options.onProgress?.({ frameIndex: 1, frameCount: 4 });
        options.onProgress?.({ frameIndex: 4, frameCount: 4 });
        return createOverview(options.framesPerSecond);
      }
    );
    const logger = { trace: vi.fn() };

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService({
      buildOverviewFromBuffer,
      logger
    });

    await service.buildOverviewFromAudioData(new ArrayBuffer(8), {
      framesPerSecond: 4
    });

    expect(logger.trace).toHaveBeenCalledWith(
      "pitchHeatmap.overview.start",
      "Building pitch heatmap overview",
      expect.objectContaining({ analysisEngine: "multiresolution-stft" })
    );
    expect(logger.trace).toHaveBeenCalledWith(
      "pitchHeatmap.progress",
      "Analyzed pitch heatmap frame",
      expect.objectContaining({ frameIndex: 1, frameCount: 4 })
    );
    expect(logger.trace).toHaveBeenCalledWith(
      "pitchHeatmap.progress",
      "Analyzed pitch heatmap frame",
      expect.objectContaining({ frameIndex: 4, frameCount: 4 })
    );
  });

  it("continues analysis and closes the audio context when logging fails", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodedAudio = new FakeAudioBuffer();
    const decodeAudioData = vi.fn().mockResolvedValue(decodedAudio);
    const buildOverviewFromBuffer = vi.fn(
      (_buffer: DecodedAudioBuffer, options: BuildOverviewOptions) =>
        createOverview(options.framesPerSecond)
    );
    const logger = {
      trace: vi.fn(() => {
        throw new Error("logger failed");
      })
    };

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService({
      buildOverviewFromBuffer,
      logger
    });

    const overview = await service.buildOverviewFromAudioData(new ArrayBuffer(8), {
      framesPerSecond: 4
    });

    expect(overview.framesPerSecond).toBe(4);
    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("throws a stable error when decoding fails", async () => {
    const buildOverviewFromBuffer = vi.fn(() => createOverview(100));

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return {
          close: vi.fn().mockResolvedValue(undefined),
          decodeAudioData: vi.fn().mockRejectedValue(new Error("bad file"))
        };
      })
    });

    const service = createBrowserPitchEnergyService({ buildOverviewFromBuffer });

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "Failed to generate pitch heatmap."
    );
    expect(buildOverviewFromBuffer).not.toHaveBeenCalled();
  });

  it("throws a stable error when STFT analysis fails", async () => {
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return {
          close: vi.fn().mockResolvedValue(undefined),
          decodeAudioData: vi.fn().mockResolvedValue(new FakeAudioBuffer())
        };
      })
    });

    const service = createBrowserPitchEnergyService({
      buildOverviewFromBuffer: () => {
        throw new Error("stft failed");
      }
    });

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "Failed to generate pitch heatmap."
    );
  });
});
