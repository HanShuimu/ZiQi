import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserWaveformService } from "./browserWaveformService";

class FakeAudioBuffer {
  readonly duration = 1;
  readonly numberOfChannels = 1;
  readonly sampleRate = 4;

  getChannelData() {
    return new Float32Array([0, 0.25, -1, 0.5]);
  }
}

class ThrowingAudioBuffer extends FakeAudioBuffer {
  getChannelData(): ReturnType<FakeAudioBuffer["getChannelData"]> {
    throw new Error("overview failed");
  }
}

describe("createBrowserWaveformService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "fetch");
    Reflect.deleteProperty(globalThis, "AudioContext");
  });

  it("decodes audio data into a waveform overview", async () => {
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

    const service = createBrowserWaveformService();
    const overview = await service.buildOverviewFromAudioData(arrayBuffer);

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(decodeAudioData).toHaveBeenCalledWith(arrayBuffer);
    expect(overview.pointsPerSecond).toBe(50);
    expect(overview.durationMs).toBe(1000);
    expect(overview.points).toHaveLength(50);
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

    const service = createBrowserWaveformService();

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "Failed to decode audio waveform."
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not remap waveform generation errors", async () => {
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

    const service = createBrowserWaveformService();

    await expect(service.buildOverviewFromAudioData(new ArrayBuffer(8))).rejects.toThrow(
      "overview failed"
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
