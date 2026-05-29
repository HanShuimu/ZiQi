import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserPitchEnergyService,
  loadEssentiaPitchEnergyEngine,
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
    expect(analyzeFrame.mock.calls[0][0]).toHaveLength(32_768);
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

  it("loads the packaged Essentia engine", async () => {
    const engine = await loadEssentiaPitchEnergyEngine();
    const frame = new Float32Array(32_768);
    for (let index = 0; index < frame.length; index += 1) {
      frame[index] = Math.sin((2 * Math.PI * 440 * index) / 44_100);
    }

    expect(engine.analyzeFrame(frame, 44_100)).toHaveLength(88);
  });
});
