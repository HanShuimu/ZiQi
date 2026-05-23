import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserPitchEnergyService,
  type PitchEnergyEngine
} from "./browserPitchEnergyService";

class FakeAudioBuffer {
  readonly duration = 1;
  readonly numberOfChannels = 1;
  readonly sampleRate = 44_100;

  getChannelData() {
    return new Float32Array(44_100).fill(0.5);
  }
}

describe("createBrowserPitchEnergyService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "AudioContext");
  });

  it("decodes audio data and builds 88-key pitch frames", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());
    const analyzeFrame = vi.fn<PitchEnergyEngine["analyzeFrame"]>(() =>
      Array.from({ length: 88 }, (_, index) => index)
    );

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService({
      loadEngine: async () => ({ analyzeFrame })
    });
    const overview = await service.buildOverviewFromAudioData(new ArrayBuffer(8), {
      framesPerSecond: 4
    });

    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(overview.minMidiNumber).toBe(21);
    expect(overview.maxMidiNumber).toBe(108);
    expect(overview.notesPerFrame).toBe(88);
    expect(overview.frames).toHaveLength(4);
    expect(overview.frames[0].energies).toHaveLength(88);
    expect(analyzeFrame).toHaveBeenCalledWith(expect.any(Float32Array), 44_100);
  });

  it("throws a stable error when decoding fails", async () => {
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return {
          close: vi.fn().mockResolvedValue(undefined),
          decodeAudioData: vi.fn().mockRejectedValue(new Error("bad file"))
        };
      })
    });

    const service = createBrowserPitchEnergyService({
      loadEngine: async () => ({
        analyzeFrame: () => new Array(88).fill(0)
      })
    });

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "Failed to generate pitch heatmap."
    );
  });

  it("throws a stable error when the engine cannot load", async () => {
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
      loadEngine: async () => {
        throw new Error("wasm missing");
      }
    });

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "Failed to load pitch analysis engine."
    );
  });
});
