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
});
