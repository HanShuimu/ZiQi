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

describe("createBrowserWaveformService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "fetch");
    Reflect.deleteProperty(globalThis, "AudioContext");
  });

  it("fetches and decodes an audio URL into a waveform overview", async () => {
    const arrayBuffer = new ArrayBuffer(8);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer)
    });

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetch
    });
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { decodeAudioData };
      })
    });

    const service = createBrowserWaveformService();
    const overview = await service.buildOverview("file:///D:/demo.wav");

    expect(fetch).toHaveBeenCalledWith("file:///D:/demo.wav");
    expect(decodeAudioData).toHaveBeenCalledWith(arrayBuffer);
    expect(overview.pointsPerSecond).toBe(50);
    expect(overview.durationMs).toBe(1000);
    expect(overview.points).toHaveLength(50);
  });

  it("throws a stable error when fetching the audio file fails", async () => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: vi.fn().mockResolvedValue({ ok: false })
    });
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { decodeAudioData: vi.fn() };
      })
    });

    const service = createBrowserWaveformService();

    await expect(service.buildOverview("file:///D:/missing.wav")).rejects.toThrow(
      "Failed to load audio file."
    );
  });

  it("throws a stable error when decoding fails", async () => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
      })
    });
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return {
          decodeAudioData: vi.fn().mockRejectedValue(new Error("bad file"))
        };
      })
    });

    const service = createBrowserWaveformService();

    await expect(service.buildOverview("file:///D:/bad.wav")).rejects.toThrow(
      "Failed to decode audio waveform."
    );
  });
});
