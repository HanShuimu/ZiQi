import { describe, expect, it } from "vitest";
import {
  createBarGridLines,
  createTimeGridLines,
  getRenderedWaveformPoints
} from "./spectrogramModel";

describe("spectrogramModel", () => {
  it("creates a midpoint time grid line for a ten second viewport", () => {
    expect(createTimeGridLines({ startMs: 0, durationMs: 10_000 })).toEqual([50]);
  });

  it("creates bar grid lines from beat timing", () => {
    const lines = createBarGridLines(
      { startMs: 0, durationMs: 10_000 },
      { beatOffsetMs: 500, beatsPerBar: 4, bpm: 120 }
    );

    expect(lines).toHaveLength(5);
    expect(lines.map((line) => line.leftPercent)).toEqual([5, 25, 45, 65, 85]);
    expect(lines.map((line) => line.timeMs)).toEqual([500, 2_500, 4_500, 6_500, 8_500]);
  });

  it("aggregates rendered waveform points to the requested maximum", () => {
    const points = [
      { startMs: 0, endMs: 10, peak: 0 },
      { startMs: 10, endMs: 20, peak: 0.25 },
      { startMs: 20, endMs: 30, peak: 0.5 },
      { startMs: 30, endMs: 40, peak: 0.75 }
    ];

    expect(getRenderedWaveformPoints(points, 2)).toEqual([
      { startMs: 0, endMs: 20, peak: 0.25 },
      { startMs: 20, endMs: 40, peak: 0.75 }
    ]);
  });
});
