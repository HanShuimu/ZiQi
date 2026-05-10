import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpectrogramOverview, WaveformOverview } from "../domain/audio/types";
import { SpectrogramView } from "./SpectrogramView";

const drawCalls: Array<{
  fillStyle: string;
  x: number;
  y: number;
  width: number;
  height: number;
}> = [];

function createWaveformOverview(): WaveformOverview {
  return {
    pointsPerSecond: 50,
    durationMs: 12_000,
    points: [
      { startMs: 0, endMs: 20, peak: 0.2 },
      { startMs: 20, endMs: 40, peak: 0.8 },
      { startMs: 40, endMs: 60, peak: 0.4 }
    ]
  };
}

function createSpectrogramOverview(): SpectrogramOverview {
  return {
    durationMs: 12_000,
    framesPerSecond: 24,
    minFrequencyHz: 27.5,
    maxFrequencyHz: 4186,
    binsPerFrame: 4,
    frames: [
      { startMs: 0, endMs: 42, magnitudes: [0, 0.25, 0.5, 1] },
      { startMs: 42, endMs: 84, magnitudes: [1, 0.5, 0.25, 0] }
    ]
  };
}

describe("SpectrogramView", () => {
  beforeEach(() => {
    drawCalls.length = 0;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        clearRect: vi.fn(),
        fillRect: vi.fn(function (
          this: { fillStyle: string },
          x: number,
          y: number,
          width: number,
          height: number
        ) {
          drawCalls.push({ fillStyle: this.fillStyle, x, y, width, height });
        }),
        fillStyle: ""
      }))
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders waveform strip, piano rail, time grid, and spectrogram canvas", () => {
    render(
      <SpectrogramView
        currentTimeMs={3_000}
        durationMs={12_000}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={createWaveformOverview()}
      />
    );

    expect(screen.getByRole("img", { name: "Audio waveform overview" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Audio spectrogram" })).toBeTruthy();
    expect(screen.getByLabelText("Piano pitch axis")).toBeTruthy();
    expect(screen.getAllByTestId("piano-key")).toHaveLength(88);
    expect(screen.getAllByTestId("spectrogram-time-grid-line").length).toBeGreaterThan(1);
    expect(screen.getByTestId("spectrogram-cursor").style.left).toBe("25%");
    expect(drawCalls.some((call) => call.fillStyle === "rgb(255, 0, 0)")).toBe(true);
  });

  it("shows an empty spectrogram state without drawing bins", () => {
    render(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        spectrogramOverview={null}
        waveformOverview={createWaveformOverview()}
      />
    );

    expect(screen.getByText("Generating spectrogram...")).toBeTruthy();
    expect(drawCalls).toEqual([]);
  });

  it("treats an overview with no frames as an empty spectrogram", () => {
    render(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        spectrogramOverview={{ ...createSpectrogramOverview(), frames: [] }}
        waveformOverview={createWaveformOverview()}
      />
    );

    expect(screen.getByText("Generating spectrogram...")).toBeTruthy();
    expect(drawCalls).toEqual([]);
  });
});
