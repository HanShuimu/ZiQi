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

  it("returns no time ruler ticks for invalid viewport bounds", () => {
    expect(
      createTimeRulerTicks({
        viewport: { startMs: 0, durationMs: Number.POSITIVE_INFINITY }
      })
    ).toEqual([]);
    expect(
      createTimeRulerTicks({
        viewport: { startMs: Number.POSITIVE_INFINITY, durationMs: 1_000 }
      })
    ).toEqual([]);
  });

  it("returns no time ruler ticks for invalid target tick counts", () => {
    expect(
      createTimeRulerTicks({
        viewport: { startMs: 0, durationMs: 1_000 },
        targetMajorTickCount: 0
      })
    ).toEqual([]);
    expect(
      createTimeRulerTicks({
        viewport: { startMs: 0, durationMs: 1_000 },
        targetMajorTickCount: Number.POSITIVE_INFINITY
      })
    ).toEqual([]);
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

  it("limits extreme beat density", () => {
    const ticks = createBarBeatTicks({
      viewport: { startMs: 0, durationMs: 10_000 },
      bpm: 1_000_000,
      beatsPerBar: 4,
      beatOffsetMs: 0
    });

    expect(ticks.length).toBeLessThanOrEqual(1_000);
  });

  it("returns no bar or beat ticks for invalid viewport duration", () => {
    expect(
      createBarBeatTicks({
        viewport: { startMs: 0, durationMs: Number.POSITIVE_INFINITY },
        bpm: 120,
        beatsPerBar: 4,
        beatOffsetMs: 0
      })
    ).toEqual([]);
  });

  it("returns no bar or beat ticks for invalid viewport start", () => {
    expect(
      createBarBeatTicks({
        viewport: { startMs: Number.POSITIVE_INFINITY, durationMs: 4_000 },
        bpm: 120,
        beatsPerBar: 4,
        beatOffsetMs: 0
      })
    ).toEqual([]);
  });

  it("returns no bar or beat ticks for non-integer beats per bar", () => {
    expect(
      createBarBeatTicks({
        viewport: { startMs: 0, durationMs: 4_000 },
        bpm: 120,
        beatsPerBar: 2.5,
        beatOffsetMs: 0
      })
    ).toEqual([]);
  });
});
