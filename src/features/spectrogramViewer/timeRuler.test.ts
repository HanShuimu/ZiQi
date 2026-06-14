import { describe, expect, it } from "vitest";
import { createBarBeatTicks, createTimeRulerTicks } from "./timeRuler";

describe("timeRuler", () => {
  it("creates natural time labels from the viewport instead of fixed positions", () => {
    const ticks = createTimeRulerTicks({
      viewport: { startMs: 3_000, durationMs: 5_000 },
      targetMajorTickCount: 5
    });

    expect(ticks.filter((tick) => tick.kind === "major").map((tick) => tick.label)).toEqual([
      "03.0",
      "04.0",
      "05.0",
      "06.0",
      "07.0",
      "08.0"
    ]);
  });

  it("creates bar and beat ticks from bpm, beats per bar, and offset", () => {
    const ticks = createBarBeatTicks({
      viewport: { startMs: 0, durationMs: 8_000 },
      bpm: 120,
      beatsPerBar: 4,
      beatOffsetMs: 0
    });

    expect(ticks.filter((tick) => tick.kind === "bar").map((tick) => tick.label)).toEqual([
      "1:1",
      "2:1",
      "3:1",
      "4:1",
      "5:1"
    ]);
    expect(ticks.filter((tick) => tick.kind === "beat").length).toBeGreaterThan(0);
  });

  it("uses beat offset when creating bar ticks", () => {
    const ticks = createBarBeatTicks({
      viewport: { startMs: 0, durationMs: 4_000 },
      bpm: 60,
      beatsPerBar: 4,
      beatOffsetMs: 500
    });

    expect(ticks.find((tick) => tick.kind === "bar")?.timeMs).toBe(500);
  });
});
