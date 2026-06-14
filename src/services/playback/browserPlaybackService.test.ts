import { describe, expect, it, vi } from "vitest";
import { BrowserPlaybackService } from "./browserPlaybackService";

class FakeMediaElement {
  private simulatedCurrentTime = 0;
  currentTimeWrites = 0;
  playbackRate = 1;
  preservesPitch = true;
  loop = false;
  paused = true;
  private listeners = new Map<string, Set<() => void>>();

  get currentTime() {
    return this.simulatedCurrentTime;
  }

  set currentTime(time: number) {
    this.currentTimeWrites += 1;
    this.simulatedCurrentTime = time;
  }

  simulateBrowserCurrentTime(time: number) {
    this.simulatedCurrentTime = time;
  }

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

  it("syncs browser-driven time while playing and only seeks when the loop end is reached", async () => {
    vi.useFakeTimers();
    const media = new FakeMediaElement();
    const service = new BrowserPlaybackService(media);

    await service.setLoopRange(1_000, 2_000);
    await service.play(1_500);
    const writesAfterPlay = media.currentTimeWrites;

    vi.advanceTimersByTime(50);

    expect(media.currentTime).toBe(1.5);
    expect(media.currentTimeWrites).toBe(writesAfterPlay);

    media.simulateBrowserCurrentTime(1.75);
    vi.advanceTimersByTime(50);

    expect(media.currentTimeWrites).toBe(writesAfterPlay);
    expect(service.getState().currentTimeMs).toBe(1_750);

    media.simulateBrowserCurrentTime(2.1);
    vi.advanceTimersByTime(50);

    expect(media.currentTime).toBe(1);
    expect(service.getState().currentTimeMs).toBe(1_000);

    vi.useRealTimers();
  });

  it("does not jump back when playback starts after the loop range", async () => {
    vi.useFakeTimers();
    const media = new FakeMediaElement();
    const service = new BrowserPlaybackService(media);

    await service.setLoopRange(1_000, 2_000);
    await service.play(2_500);
    const writesAfterPlay = media.currentTimeWrites;

    vi.advanceTimersByTime(50);

    expect(media.currentTime).toBe(2.5);
    expect(media.currentTimeWrites).toBe(writesAfterPlay);
    expect(service.getState().currentTimeMs).toBe(2_500);

    media.simulateBrowserCurrentTime(2.75);
    vi.advanceTimersByTime(50);

    expect(media.currentTime).toBe(2.75);
    expect(media.currentTimeWrites).toBe(writesAfterPlay);
    expect(service.getState().currentTimeMs).toBe(2_750);

    vi.useRealTimers();
  });
});
