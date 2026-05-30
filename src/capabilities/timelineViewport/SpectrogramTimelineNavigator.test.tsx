import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpectrogramTimelineNavigator } from "./SpectrogramTimelineNavigator";

function stubTrackRect(element: Element) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 1_000,
    height: 32,
    top: 0,
    right: 1_000,
    bottom: 32,
    left: 0,
    toJSON: () => ({})
  });
}

describe("SpectrogramTimelineNavigator", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders labels, a playback track, a viewport track, playhead, and viewport thumb", () => {
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={6_000}
        durationMs={12_000}
        onViewportChange={vi.fn()}
        viewport={{ startMs: 0, durationMs: 10_000 }}
      />
    );

    expect(screen.getByText("0:00")).toBeTruthy();
    expect(screen.getByText("0:12")).toBeTruthy();
    expect(screen.getByText("0:00-0:10")).toBeTruthy();
    expect(screen.getByTestId("spectrogram-navigator-playback-track")).toBeTruthy();
    expect(screen.getByTestId("spectrogram-navigator-viewport-track")).toBeTruthy();
    expect(screen.getByTestId("spectrogram-navigator-playhead").style.left).toBe("50%");
    expect(screen.getByTestId("spectrogram-navigator-thumb").style.left).toBe("0%");
    expect(screen.getByTestId("spectrogram-navigator-thumb").style.width).toBe("83.33333333333334%");
  });

  it("moves the viewport center when clicking the track without seek support", () => {
    const onViewportChange = vi.fn();
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={0}
        durationMs={20_000}
        onViewportChange={onViewportChange}
        viewport={{ startMs: 0, durationMs: 10_000 }}
      />
    );

    const track = screen.getByTestId("spectrogram-navigator-viewport-track");
    stubTrackRect(track);

    fireEvent.pointerDown(track, { clientX: 750 });

    expect(onViewportChange).toHaveBeenCalledWith({ startMs: 10_000, durationMs: 10_000 });
  });

  it("seeks when clicking the track outside the viewport thumb", () => {
    const onSeek = vi.fn();
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={0}
        durationMs={20_000}
        onSeek={onSeek}
        onViewportChange={vi.fn()}
        viewport={{ startMs: 0, durationMs: 10_000 }}
      />
    );

    const track = screen.getByTestId("spectrogram-navigator-playback-track");
    stubTrackRect(track);

    fireEvent.pointerDown(track, { clientX: 750 });

    expect(onSeek).toHaveBeenCalledWith(15_000);
  });

  it("keeps viewport dragging on the thumb separate from seek", () => {
    const onSeek = vi.fn();
    const onViewportChange = vi.fn();
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={0}
        durationMs={20_000}
        onSeek={onSeek}
        onViewportChange={onViewportChange}
        viewport={{ startMs: 0, durationMs: 10_000 }}
      />
    );

    const track = screen.getByTestId("spectrogram-navigator-viewport-track");
    const thumb = screen.getByTestId("spectrogram-navigator-thumb");
    stubTrackRect(track);

    fireEvent.pointerDown(thumb, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 600, pointerId: 1 });

    expect(onSeek).not.toHaveBeenCalled();
    expect(onViewportChange).toHaveBeenLastCalledWith({
      startMs: 10_000,
      durationMs: 10_000
    });
  });

  it("drags the viewport thumb without changing zoom", () => {
    const onViewportChange = vi.fn();
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={0}
        durationMs={20_000}
        onViewportChange={onViewportChange}
        viewport={{ startMs: 0, durationMs: 10_000 }}
      />
    );

    const track = screen.getByTestId("spectrogram-navigator-viewport-track");
    const thumb = screen.getByTestId("spectrogram-navigator-thumb");
    stubTrackRect(track);

    fireEvent.pointerDown(thumb, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 600, pointerId: 1 });

    expect(onViewportChange).toHaveBeenLastCalledWith({
      startMs: 10_000,
      durationMs: 10_000
    });
  });

  it("keeps the thumb draggable when the viewport is very small", () => {
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={0}
        durationMs={120_000}
        onViewportChange={vi.fn()}
        viewport={{ startMs: 60_000, durationMs: 1_000 }}
      />
    );

    expect(screen.getByTestId("spectrogram-navigator-thumb").className).toContain(
      "spectrogram-navigator-thumb"
    );
  });

  it("renders an active loop range on the full timeline", () => {
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={3_000}
        durationMs={12_000}
        loopRange={{ startMs: 3_000, endMs: 9_000 }}
        onViewportChange={vi.fn()}
        viewport={{ startMs: 0, durationMs: 10_000 }}
      />
    );

    const loopRange = screen.getByTestId("spectrogram-navigator-loop-range");

    expect(loopRange.style.left).toBe("25%");
    expect(loopRange.style.width).toBe("50%");
  });

  it("renders a hover time marker on the full timeline when hover time is inside the viewport", () => {
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={0}
        durationMs={20_000}
        hoverTimeMs={15_000}
        onViewportChange={vi.fn()}
        viewport={{ startMs: 10_000, durationMs: 10_000 }}
      />
    );

    const hoverTime = screen.getByTestId("spectrogram-navigator-hover-time");

    expect(hoverTime.style.left).toBe("75%");
    expect(hoverTime.textContent).toBe("00:15.000");
  });

  it("does not render a hover time marker when hover time is outside the viewport", () => {
    render(
      <SpectrogramTimelineNavigator
        currentTimeMs={0}
        durationMs={20_000}
        hoverTimeMs={5_000}
        onViewportChange={vi.fn()}
        viewport={{ startMs: 10_000, durationMs: 10_000 }}
      />
    );

    expect(screen.queryByTestId("spectrogram-navigator-hover-time")).toBeNull();
  });
});
