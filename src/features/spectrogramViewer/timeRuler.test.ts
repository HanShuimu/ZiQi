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

  it("returns no time ruler ticks when viewport end is invalid", () => {
    expect(
      createTimeRulerTicks({
        viewport: { startMs: Number.MAX_VALUE, durationMs: Number.MAX_VALUE }
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

  it("returns no natural time ticks when tick density is too high", () => {
    expect(
      createTimeRulerTicks({
        viewport: { startMs: 0, durationMs: 100_000_000 },
        targetMajorTickCount: 10_000
      })
    ).toEqual([]);
  });

  it("formats sub-second major tick labels without duplicates", () => {
    const labels = createTimeRulerTicks({
      viewport: { startMs: 0, durationMs: 200 },
      targetMajorTickCount: 4
    })
      .filter((tick) => tick.kind === "major")
      .map((tick) => tick.label);

    expect(labels).toEqual(["00.000", "00.050", "00.100", "00.150", "00.200"]);
    expect(new Set(labels).size).toBe(labels.length);
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

  it("returns no bar or beat ticks when beat density is too high", () => {
    expect(
      createBarBeatTicks({
        viewport: { startMs: 0, durationMs: 10_000 },
        bpm: 1_000_000,
        beatsPerBar: 4,
        beatOffsetMs: 0
      })
    ).toEqual([]);
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

  it("returns no bar or beat ticks when viewport end cannot progress safely", () => {
    expect(
      createBarBeatTicks({
        viewport: { startMs: Number.MAX_VALUE, durationMs: 1 },
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
