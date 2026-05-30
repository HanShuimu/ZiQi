import { describe, expect, it } from "vitest";
import type { SpectrogramViewport } from "../../core/spectrogramViewport";
import {
  formatPreciseTimeLabel,
  getPitchHoverStateFromPoint,
  getPitchLaneStyle
} from "./pitchHover";

const viewport: SpectrogramViewport = {
  startMs: 60_000,
  durationMs: 10_000
};

const bounds = {
  left: 100,
  top: 50,
  width: 1_000,
  height: 528
};

describe("pitch hover helpers", () => {
  it("maps pitch indexes to exact 88-lane percentages", () => {
    expect(getPitchLaneStyle(0)).toEqual({
      bottomPercent: 0,
      topPercent: 98.86363636363636,
      heightPercent: 1.1363636363636365
    });
    expect(getPitchLaneStyle(87)).toEqual({
      bottomPercent: 98.86363636363636,
      topPercent: 0,
      heightPercent: 1.1363636363636365
    });
  });

  it("maps the top of the heatmap to C8 and the bottom to A0", () => {
    expect(
      getPitchHoverStateFromPoint({
        clientX: 100,
        clientY: 50,
        bounds,
        viewport
      })
    ).toMatchObject({
      pitchIndex: 87,
      midiNumber: 108,
      noteName: "C8",
      frequencyHz: 4186.009044809578,
      yPercent: 0
    });

    expect(
      getPitchHoverStateFromPoint({
        clientX: 100,
        clientY: 577,
        bounds,
        viewport
      })
    ).toMatchObject({
      pitchIndex: 0,
      midiNumber: 21,
      noteName: "A0",
      frequencyHz: 27.5
    });
  });

  it("maps pointer position to viewport time and heatmap percentages", () => {
    expect(
      getPitchHoverStateFromPoint({
        clientX: 600,
        clientY: 50 + 528 / 2,
        bounds,
        viewport
      })
    ).toMatchObject({
      xPercent: 50,
      yPercent: 50,
      timeMs: 65_000
    });
  });

  it("clamps pointer coordinates to the heatmap bounds", () => {
    expect(
      getPitchHoverStateFromPoint({
        clientX: -10,
        clientY: -10,
        bounds,
        viewport
      })
    ).toMatchObject({
      xPercent: 0,
      yPercent: 0,
      pitchIndex: 87,
      timeMs: 60_000
    });

    expect(
      getPitchHoverStateFromPoint({
        clientX: 2_000,
        clientY: 2_000,
        bounds,
        viewport
      })
    ).toMatchObject({
      xPercent: 100,
      yPercent: 100,
      pitchIndex: 0,
      timeMs: 70_000
    });
  });

  it("returns null when geometry or viewport cannot support hover", () => {
    expect(
      getPitchHoverStateFromPoint({
        clientX: 0,
        clientY: 0,
        bounds: { ...bounds, width: 0 },
        viewport
      })
    ).toBeNull();

    expect(
      getPitchHoverStateFromPoint({
        clientX: 0,
        clientY: 0,
        bounds,
        viewport: { startMs: 0, durationMs: 0 }
      })
    ).toBeNull();
  });

  it("formats precise time labels with milliseconds", () => {
    expect(formatPreciseTimeLabel(0)).toBe("00:00.000");
    expect(formatPreciseTimeLabel(84_320)).toBe("01:24.320");
    expect(formatPreciseTimeLabel(3_661_009)).toBe("61:01.009");
  });
});
