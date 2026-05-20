import { describe, expect, it } from "vitest";
import {
  createDefaultSpectrogramViewport,
  filterItemsForViewport,
  formatTimeLabel,
  formatViewportRange,
  isTimeInsideViewport,
  panSpectrogramViewport,
  timeToTrackPercent,
  timeToViewportPercent,
  zoomSpectrogramViewport
} from "./spectrogramViewport";

describe("spectrogram viewport core helpers", () => {
  it("defaults long audio to a 10 second viewport", () => {
    expect(createDefaultSpectrogramViewport(20_000)).toEqual({
      startMs: 0,
      durationMs: 10_000
    });
  });

  it("defaults short audio to its full duration", () => {
    expect(createDefaultSpectrogramViewport(8_000)).toEqual({
      startMs: 0,
      durationMs: 8_000
    });
  });

  it("returns a non-interactive zero viewport for invalid durations", () => {
    expect(createDefaultSpectrogramViewport(0)).toEqual({
      startMs: 0,
      durationMs: 0
    });
    expect(createDefaultSpectrogramViewport(Number.NaN)).toEqual({
      startMs: 0,
      durationMs: 0
    });
  });

  it("zooms around the mouse anchor and keeps the anchor time stable", () => {
    const zoomed = zoomSpectrogramViewport({
      viewport: { startMs: 0, durationMs: 10_000 },
      totalDurationMs: 20_000,
      anchorRatio: 0.25,
      deltaY: -100
    });

    expect(zoomed.durationMs).toBeLessThan(10_000);
    expect(timeToViewportPercent(2_500, zoomed)).toBeCloseTo(25, 0);
  });

  it("clamps zoom between one second and the full duration", () => {
    const fullyZoomedIn = zoomSpectrogramViewport({
      viewport: { startMs: 5_000, durationMs: 1_100 },
      totalDurationMs: 20_000,
      anchorRatio: 0.5,
      deltaY: -10_000
    });
    const fullyZoomedOut = zoomSpectrogramViewport({
      viewport: { startMs: 5_000, durationMs: 5_000 },
      totalDurationMs: 20_000,
      anchorRatio: 0.5,
      deltaY: 10_000
    });

    expect(fullyZoomedIn.durationMs).toBe(1_000);
    expect(fullyZoomedOut).toEqual({ startMs: 0, durationMs: 20_000 });
  });

  it("pans by a ratio of the current viewport width and clamps to bounds", () => {
    expect(
      panSpectrogramViewport({
        viewport: { startMs: 5_000, durationMs: 10_000 },
        totalDurationMs: 20_000,
        direction: 1
      })
    ).toEqual({ startMs: 6_000, durationMs: 10_000 });

    expect(
      panSpectrogramViewport({
        viewport: { startMs: 15_000, durationMs: 10_000 },
        totalDurationMs: 20_000,
        direction: 1
      })
    ).toEqual({ startMs: 10_000, durationMs: 10_000 });
  });

  it("filters time-ranged items to the viewport", () => {
    const items = [
      { id: "before", startMs: 0, endMs: 500 },
      { id: "left-edge", startMs: 9_500, endMs: 10_000 },
      { id: "visible", startMs: 10_000, endMs: 10_500 },
      { id: "after", startMs: 19_500, endMs: 20_000 }
    ];

    expect(filterItemsForViewport(items, { startMs: 9_900, durationMs: 200 })).toEqual([
      { id: "left-edge", startMs: 9_500, endMs: 10_000 },
      { id: "visible", startMs: 10_000, endMs: 10_500 }
    ]);
  });

  it("maps and formats visible time values", () => {
    const viewport = { startMs: 10_000, durationMs: 10_000 };

    expect(timeToViewportPercent(12_500, viewport)).toBe(25);
    expect(isTimeInsideViewport(20_000, viewport)).toBe(true);
    expect(isTimeInsideViewport(20_001, viewport)).toBe(false);
    expect(formatTimeLabel(65_250)).toBe("1:05");
    expect(formatViewportRange(viewport)).toBe("0:10-0:20");
    expect(timeToTrackPercent(10_000, 20_000)).toBe(50);
    expect(timeToTrackPercent(0, 0)).toBe(0);
    expect(timeToTrackPercent(0, Number.NaN)).toBe(0);
  });
});
