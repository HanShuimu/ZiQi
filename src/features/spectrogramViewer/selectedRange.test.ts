import { describe, expect, it } from "vitest";
import {
  getRangeFromDrag,
  getTimeFromClientX,
  isSelectionDragDistance
} from "./selectedRange";

describe("selectedRange helpers", () => {
  const bounds = {
    left: 100,
    width: 1000
  };

  it("maps client x into the active viewport time", () => {
    expect(getTimeFromClientX({
      clientX: 600,
      bounds,
      viewport: { startMs: 2_000, durationMs: 10_000 },
      durationMs: 20_000
    })).toBe(7_000);
  });

  it("clamps mapped time to the audio duration", () => {
    expect(getTimeFromClientX({
      clientX: 1_400,
      bounds,
      viewport: { startMs: 15_000, durationMs: 10_000 },
      durationMs: 20_000
    })).toBe(20_000);
  });

  it("normalizes forward and reverse drag ranges", () => {
    expect(getRangeFromDrag({
      anchorTimeMs: 3_000,
      currentTimeMs: 8_000,
      durationMs: 12_000
    })).toEqual({
      startMs: 3_000,
      endMs: 8_000
    });

    expect(getRangeFromDrag({
      anchorTimeMs: 8_000,
      currentTimeMs: 3_000,
      durationMs: 12_000
    })).toEqual({
      startMs: 3_000,
      endMs: 8_000
    });
  });

  it("discards ranges that collapse after rounding", () => {
    expect(getRangeFromDrag({
      anchorTimeMs: 0.5,
      currentTimeMs: 1.4,
      durationMs: 10
    })).toBeUndefined();
  });

  it("ignores tiny drags", () => {
    expect(isSelectionDragDistance({
      startClientX: 100,
      currentClientX: 104,
      thresholdPx: 6
    })).toBe(false);
    expect(isSelectionDragDistance({
      startClientX: 100,
      currentClientX: 106,
      thresholdPx: 6
    })).toBe(false);
    expect(isSelectionDragDistance({
      startClientX: 100,
      currentClientX: 107,
      thresholdPx: 6
    })).toBe(true);
  });
});
