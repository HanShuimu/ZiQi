import type { PlaybackService } from "./interfaces";
import type { PlaybackState } from "./types";

export interface BrowserPlaybackMedia {
  currentTime: number;
  playbackRate: number;
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
  play(): Promise<void>;
  pause(): void;
  addEventListener?(type: string, listener: () => void): void;
  removeEventListener?(type: string, listener: () => void): void;
}

const TICK_MS = 50;

export class BrowserPlaybackService implements PlaybackService {
  private state: PlaybackState = {
    isPlaying: false,
    currentTimeMs: 0,
    playbackRate: 1
  };

  private timerId: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly media: BrowserPlaybackMedia) {
    this.state.currentTimeMs = this.media.currentTime * 1000;
    this.state.playbackRate = this.media.playbackRate;
    this.keepPitchWhenRateChanges();
  }

  getState(): PlaybackState {
    return {
      ...this.state,
      loopRange: this.state.loopRange ? { ...this.state.loopRange } : undefined
    };
  }

  async play(fromMs?: number): Promise<void> {
    if (typeof fromMs === "number") {
      await this.seek(fromMs);
    }

    await this.media.play();
    this.state.isPlaying = true;
    this.startClock();
  }

  async pause(): Promise<void> {
    this.media.pause();
    this.state.isPlaying = false;
    this.stopClock();
    this.syncFromMedia();
  }

  async seek(timeMs: number): Promise<void> {
    const nextTimeMs = Math.max(0, timeMs);
    this.media.currentTime = nextTimeMs / 1000;
    this.state.currentTimeMs = nextTimeMs;
  }

  async setPlaybackRate(rate: number): Promise<void> {
    this.media.playbackRate = rate;
    this.state.playbackRate = rate;
    this.keepPitchWhenRateChanges();
  }

  async setLoopRange(startMs: number, endMs: number): Promise<void> {
    this.state.loopRange = {
      startMs: Math.max(0, startMs),
      endMs: Math.max(0, endMs)
    };
  }

  async clearLoopRange(): Promise<void> {
    delete this.state.loopRange;
  }

  private startClock() {
    if (this.timerId) {
      return;
    }

    this.timerId = setInterval(() => {
      this.syncFromMedia();
      this.applyLoopRange();
    }, TICK_MS);
  }

  private stopClock() {
    if (!this.timerId) {
      return;
    }

    clearInterval(this.timerId);
    this.timerId = undefined;
  }

  private syncFromMedia() {
    this.state.currentTimeMs = Math.round(this.media.currentTime * 1000);
    this.state.playbackRate = this.media.playbackRate;
  }

  private applyLoopRange() {
    const loopRange = this.state.loopRange;
    if (!loopRange || this.state.currentTimeMs < loopRange.endMs) {
      return;
    }

    this.media.currentTime = loopRange.startMs / 1000;
    this.state.currentTimeMs = loopRange.startMs;
  }

  private keepPitchWhenRateChanges() {
    if ("preservesPitch" in this.media) {
      this.media.preservesPitch = true;
    }

    if ("mozPreservesPitch" in this.media) {
      this.media.mozPreservesPitch = true;
    }

    if ("webkitPreservesPitch" in this.media) {
      this.media.webkitPreservesPitch = true;
    }
  }
}
