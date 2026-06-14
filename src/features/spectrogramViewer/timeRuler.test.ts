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

  it("returns no time ruler ticks when viewport end cannot progress", () => {
    expect(
      createTimeRulerTicks({
        viewport: { startMs: 1e20, durationMs: 1 }
      })
    ).toEqual([]);
  });

  it("returns no time ruler ticks for negative viewport start", () => {
    expect(
      createTimeRulerTicks({
        viewport: { startMs: -1, durationMs: 1_000 }
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

  it("keeps natural major ticks sparse for long viewports", () => {
    const ticks = createTimeRulerTicks({
      viewport: { startMs: 0, durationMs: 7_200_000 },
      targetMajorTickCount: 6
    });

    expect(ticks.filter((tick) => tick.kind === "major").length).toBeLessThanOrEqual(7);
    expect(ticks.length).toBeGreaterThan(0);
  });

  it("creates subdivision ticks near a non-aligned viewport start", () => {
    const ticks = createTimeRulerTicks({
      viewport: { startMs: 250, durationMs: 1_000 },
      targetMajorTickCount: 1
    });

    expect(ticks.some((tick) => tick.kind === "medium" && tick.timeMs === 500)).toBe(true);
    expect(ticks.some((tick) => tick.kind === "minor" && tick.timeMs === 250)).toBe(true);
    expect(ticks.every((tick) => tick.timeMs >= 250 && tick.timeMs <= 1_250)).toBe(true);
  });

  it("returns natural time ticks in ascending time order", () => {
    const ticks = createTimeRulerTicks({
      viewport: { startMs: 0, durationMs: 2_000 },
      targetMajorTickCount: 2
    });

    expect(ticks.map((tick) => tick.timeMs)).toEqual(
      [...ticks].map((tick) => tick.timeMs).sort((left, right) => left - right)
    );
  });

  it("uses human friendly minute intervals for long viewports", () => {
    const majorTimes = createTimeRulerTicks({
      viewport: { startMs: 0, durationMs: 7_200_000 },
      targetMajorTickCount: 6
    })
      .filter((tick) => tick.kind === "major")
      .map((tick) => tick.timeMs);

    expect(majorTimes).toEqual([
      0,
      1_200_000,
      2_400_000,
      3_600_000,
      4_800_000,
      6_000_000,
      7_200_000
    ]);
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

  it("does not include bar or beat ticks after the viewport end", () => {
    const ticks = createBarBeatTicks({
      viewport: { startMs: 0, durationMs: 60_000 },
      bpm: 11,
      beatsPerBar: 4,
      beatOffsetMs: 0
    });

    expect(ticks.every((tick) => tick.timeMs <= 60_000)).toBe(true);
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

  it("returns no bar or beat ticks when viewport end is not finite", () => {
    expect(
      createBarBeatTicks({
        viewport: { startMs: Number.MAX_VALUE, durationMs: Number.MAX_VALUE },
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

  it("returns no bar or beat ticks for negative viewport start", () => {
    expect(
      createBarBeatTicks({
        viewport: { startMs: -1, durationMs: 4_000 },
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

  it("returns no bar or beat ticks when first beat index is unsafe", () => {
    expect(
      createBarBeatTicks({
        viewport: { startMs: Number.MAX_SAFE_INTEGER + 1_000, durationMs: 10 },
        bpm: 60_000,
        beatsPerBar: 4,
        beatOffsetMs: 0
      })
    ).toEqual([]);
  });

  it("returns no bar or beat ticks when beat times are unsafe", () => {
    expect(
      createBarBeatTicks({
        viewport: { startMs: Number.MAX_SAFE_INTEGER + 1_000, durationMs: 400 },
        bpm: 1_000,
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
