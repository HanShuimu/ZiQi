import { describe, expect, it } from "vitest";
import { toAudioUrl } from "./audioFileUrl";

describe("toAudioUrl", () => {
  it("converts Windows file paths into encoded file URLs", () => {
    expect(toAudioUrl("D:\\Music Library\\demo track.wav")).toBe(
      "file:///D:/Music%20Library/demo%20track.wav"
    );
  });

  it("keeps existing URL strings unchanged", () => {
    expect(toAudioUrl("https://example.com/audio/demo.mp3")).toBe(
      "https://example.com/audio/demo.mp3"
    );
  });

  it("converts non-URL local paths into encoded file URLs", () => {
    expect(toAudioUrl("fixtures/demo track.wav")).toBe("file:///fixtures/demo%20track.wav");
  });
});
