import { describe, expect, it } from "vitest";
import { createBrowserProjectAudioFacade } from "./browserProjectAudioFacade";
import type { BrowserPlaybackMedia } from "./browserPlaybackService";

class FakeMediaElement implements BrowserPlaybackMedia {
  currentTime = 0;
  duration = 123;
  playbackRate = 1;
  preservesPitch = false;
  src = "";

  async play() {}

  pause() {}

  load() {}
}

class FakeMetadataLoadingMediaElement extends FakeMediaElement {
  override duration = Number.NaN;
  private listeners = new Map<string, Set<() => void>>();

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

describe("createBrowserProjectAudioFacade", () => {
  it("uses browser playback and loads local file paths into the backing media element", async () => {
    const media = new FakeMediaElement();
    const facade = createBrowserProjectAudioFacade(media);

    const metadata = await facade.source.load("D:\\Music Library\\demo track.wav");
    await facade.playback.play(2_500);

    expect(media.src).toBe("file:///D:/Music%20Library/demo%20track.wav");
    expect(media.currentTime).toBe(2.5);
    expect(media.preservesPitch).toBe(true);
    expect(metadata).toEqual({
      durationMs: 123_000,
      sampleRate: 0,
      channelCount: 2
    });
  });

  it("waits for browser metadata before returning duration", async () => {
    const media = new FakeMetadataLoadingMediaElement();
    const facade = createBrowserProjectAudioFacade(media);

    const metadataPromise = facade.source.load("D:\\Music Library\\demo track.wav");
    media.duration = 242;
    media.emit("loadedmetadata");

    await expect(metadataPromise).resolves.toEqual({
      durationMs: 242_000,
      sampleRate: 0,
      channelCount: 2
    });
  });

  it("rejects and restores the previous source when browser metadata loading errors", async () => {
    const media = new FakeMetadataLoadingMediaElement();
    media.src = "file:///D:/Music%20Library/current.wav";
    const facade = createBrowserProjectAudioFacade(media);

    const metadataPromise = facade.source.load("D:\\Music Library\\broken.wav");
    media.emit("error");

    await expect(metadataPromise).rejects.toThrow("Failed to load audio file.");
    expect(media.src).toBe("file:///D:/Music%20Library/current.wav");
  });
});
