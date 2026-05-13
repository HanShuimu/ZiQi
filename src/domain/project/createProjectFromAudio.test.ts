import { describe, expect, it } from "vitest";
import { createProjectFromAudio } from "./createProjectFromAudio";

describe("createProjectFromAudio", () => {
  it("creates an empty project around the selected source audio", () => {
    const project = createProjectFromAudio({
      filePath: "D:\\Music Library\\demo track.wav",
      metadata: {
        durationMs: 123_000,
        sampleRate: 48_000,
        channelCount: 2
      },
      now: new Date("2026-05-06T12:00:00.000Z")
    });

    expect(project).toMatchObject({
      id: "project-2026-05-06T12:00:00.000Z",
      name: "demo track",
      sourceAudio: {
        id: "source-2026-05-06T12:00:00.000Z",
        name: "demo track.wav",
        durationMs: 123_000,
        sampleRate: 48_000,
        channelCount: 2,
        filePath: "D:\\Music Library\\demo track.wav"
      },
      assets: [],
      analysisRuns: [],
      annotations: [],
      workspace: {
        preset: "pure-spectrum",
        activeDock: "analysis",
        gridEnabled: true,
        bpm: 120,
        beatOffsetMs: 0,
        playbackRate: 1
      }
    });
  });
});
