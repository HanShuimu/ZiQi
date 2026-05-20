import { describe, expect, it } from "vitest";
import {
  SUPPORTED_PLAYBACK_RATES,
  createDefaultWorkspaceState,
  normalizeWorkspaceState
} from "./workspaceState";

describe("workspaceState", () => {
  it("creates focused M1 defaults for imported audio", () => {
    expect(createDefaultWorkspaceState(12_000)).toEqual({
      preset: "pure-spectrum",
      activeDock: "analysis",
      gridEnabled: true,
      bpm: 120,
      beatOffsetMs: 0,
      playbackRate: 1,
      spectrogramViewport: {
        startMs: 0,
        durationMs: 10_000
      }
    });
  });

  it("supports only the focused M1 playback rates", () => {
    expect(SUPPORTED_PLAYBACK_RATES).toEqual([0.5, 0.75, 1, 1.25, 1.5]);
  });

  it("normalizes a valid saved focused workspace", () => {
    const workspace = normalizeWorkspaceState(
      {
        preset: "spectrum-analysis",
        activeDock: "notes",
        gridEnabled: false,
        bpm: 96,
        beatOffsetMs: 42,
        playbackRate: 0.75,
        loopRange: {
          startMs: 1_000,
          endMs: 4_000
        },
        spectrogramViewport: {
          startMs: 2_000,
          durationMs: 5_000
        }
      },
      12_000
    );

    expect(workspace).toEqual({
      preset: "spectrum-analysis",
      activeDock: "notes",
      gridEnabled: false,
      bpm: 96,
      beatOffsetMs: 42,
      playbackRate: 0.75,
      loopRange: {
        startMs: 1_000,
        endMs: 4_000
      },
      spectrogramViewport: {
        startMs: 2_000,
        durationMs: 5_000
      }
    });
  });

  it("falls back from legacy or invalid focused fields", () => {
    const workspace = normalizeWorkspaceState(
      {
        preset: "pure-spectrum",
        activeDock: "analysis",
        gridEnabled: true,
        bpm: 120,
        beatOffsetMs: 0,
        playbackRate: 1.1,
        loopRange: {
          startMs: 5_000,
          endMs: 2_000
        },
        spectrogramViewport: {
          startMs: 100_000,
          durationMs: Number.NaN
        }
      },
      12_000
    );

    expect(workspace).toEqual({
      preset: "pure-spectrum",
      activeDock: "analysis",
      gridEnabled: true,
      bpm: 120,
      beatOffsetMs: 0,
      playbackRate: 1,
      spectrogramViewport: {
        startMs: 0,
        durationMs: 10_000
      }
    });
  });

  it("clamps saved viewport and loop ranges to the audio duration", () => {
    const workspace = normalizeWorkspaceState(
      {
        preset: "pure-spectrum",
        activeDock: "analysis",
        gridEnabled: true,
        bpm: 120,
        beatOffsetMs: 0,
        playbackRate: 1.25,
        loopRange: {
          startMs: 10_000,
          endMs: 20_000
        },
        spectrogramViewport: {
          startMs: 11_000,
          durationMs: 5_000
        }
      },
      12_000
    );

    expect(workspace.loopRange).toEqual({
      startMs: 10_000,
      endMs: 12_000
    });
    expect(workspace.spectrogramViewport).toEqual({
      startMs: 7_000,
      durationMs: 5_000
    });
  });
});
