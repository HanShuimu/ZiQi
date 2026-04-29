import { describe, expect, it, vi } from "vitest";
import { BrowserPlaybackService } from "./browserPlaybackService";

class FakeMediaElement {
  currentTime = 0;
  playbackRate = 1;
  preservesPitch = true;
  loop = false;
  paused = true;
  private listeners = new Map<string, Set<() => void>>();

  async play() {
    this.paused = false;
  }

  pause() {
    this.paused = true;
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }
}

describe("BrowserPlaybackService", () => {
  it("plays from an explicit millisecond position and exposes the current state", async () => {
    const media = new FakeMediaElement();
    const service = new BrowserPlaybackService(media);

    await service.play(12_500);

    expect(media.currentTime).toBe(12.5);
    expect(media.paused).toBe(false);
    expect(service.getState()).toMatchObject({
      isPlaying: true,
      currentTimeMs: 12_500,
      playbackRate: 1
    });
  });

  it("seeks, pauses, changes rate with pitch preservation, and manages loop range", async () => {
    const media = new FakeMediaElement();
    const service = new BrowserPlaybackService(media);

    await service.seek(42_120);
    await service.setPlaybackRate(0.75);
    await service.setLoopRange(5_000, 7_500);
    await service.play();
    await service.pause();

    expect(media.currentTime).toBe(42.12);
    expect(media.playbackRate).toBe(0.75);
    expect(media.preservesPitch).toBe(true);
    expect(media.paused).toBe(true);
    expect(service.getState()).toEqual({
      isPlaying: false,
      currentTimeMs: 42_120,
      playbackRate: 0.75,
      loopRange: { startMs: 5_000, endMs: 7_500 }
    });

    await service.clearLoopRange();

    expect(service.getState().loopRange).toBeUndefined();
  });

  it("advances time while playing and wraps to the loop start when the loop end is reached", async () => {
    vi.useFakeTimers();
    const media = new FakeMediaElement();
    const service = new BrowserPlaybackService(media);

    await service.setLoopRange(1_000, 2_000);
    await service.play(1_500);
    vi.advanceTimersByTime(500);

    expect(media.currentTime).toBe(1);
    expect(service.getState().currentTimeMs).toBe(1_000);

    vi.useRealTimers();
  });
});
