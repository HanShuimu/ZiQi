import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserSpectrogramService } from "./browserSpectrogramService";

class FakeAudioBuffer {
  readonly duration = 1;
  readonly numberOfChannels = 1;
  readonly sampleRate = 4096;

  getChannelData() {
    const samples = new Float32Array(4096);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin((2 * Math.PI * 440 * index) / 4096);
    }
    return samples;
  }
}

class ThrowingAudioBuffer extends FakeAudioBuffer {
  getChannelData() {
    throw new Error("spectrogram failed");
  }
}

describe("createBrowserSpectrogramService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "fetch");
    Reflect.deleteProperty(globalThis, "AudioContext");
  });

  it("decodes audio data into a spectrogram overview", async () => {
    const arrayBuffer = new ArrayBuffer(8);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());
    const close = vi.fn().mockRejectedValue(new Error("close failed"));

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserSpectrogramService();
    const overview = await service.buildOverviewFromAudioData(arrayBuffer, {
      binsPerFrame: 24,
      framesPerSecond: 8,
      fftSize: 512
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(decodeAudioData).toHaveBeenCalledWith(arrayBuffer);
    expect(overview.framesPerSecond).toBe(8);
    expect(overview.binsPerFrame).toBe(24);
    expect(overview.frames).toHaveLength(8);
    expect(close).toHaveBeenCalledOnce();
  });

  it("throws a stable error when decoding fails", async () => {
    const close = vi.fn().mockRejectedValue(new Error("close failed"));

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return {
          close,
          decodeAudioData: vi.fn().mockRejectedValue(new Error("bad file"))
        };
      })
    });

    const service = createBrowserSpectrogramService();

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "Failed to generate spectrogram."
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not remap spectrogram generation errors", async () => {
    const close = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return {
          close,
          decodeAudioData: vi.fn().mockResolvedValue(new ThrowingAudioBuffer())
        };
      })
    });

    const service = createBrowserSpectrogramService();

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "spectrogram failed"
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
