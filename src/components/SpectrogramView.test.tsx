import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpectrogramOverview, WaveformOverview } from "../core/audio/types";
import { SpectrogramView } from "./SpectrogramView";
import { getSkinDefinition } from "../skins/registry";
import { UiProvider } from "../ui";

const drawCalls: Array<{
  fillStyle: string;
  x: number;
  y: number;
  width: number;
  height: number;
}> = [];

function renderSpectrogramView(ui: React.ReactElement) {
  const skin = getSkinDefinition("default");
  return render(
    <UiProvider skinId={skin.id} adapter={skin.adapter}>
      {ui}
    </UiProvider>
  );
}

function createWaveformOverview(): WaveformOverview {
  return {
    pointsPerSecond: 1,
    durationMs: 12_000,
    points: [
      { startMs: 0, endMs: 1_000, peak: 0.2 },
      { startMs: 9_000, endMs: 10_000, peak: 0.8 },
      { startMs: 10_000, endMs: 11_000, peak: 0.4 }
    ]
  };
}

function createSpectrogramOverview(): SpectrogramOverview {
  return {
    durationMs: 12_000,
    framesPerSecond: 1,
    minFrequencyHz: 27.5,
    maxFrequencyHz: 4186,
    binsPerFrame: 4,
    frames: [
      { startMs: 0, endMs: 1_000, magnitudes: [0, 0.25, 0.5, 1] },
      { startMs: 9_000, endMs: 10_000, magnitudes: [1, 0.5, 0.25, 0] },
      { startMs: 10_000, endMs: 11_000, magnitudes: [0.25, 0.25, 0.25, 0.25] }
    ]
  };
}

function createLongSpectrogramOverview(
  frameCount: number,
  binsPerFrame: number
): SpectrogramOverview {
  return {
    durationMs: 60_000,
    framesPerSecond: 24,
    minFrequencyHz: 27.5,
    maxFrequencyHz: 4186,
    binsPerFrame,
    frames: Array.from({ length: frameCount }, (_, frameIndex) => ({
      startMs: frameIndex * 42,
      endMs: (frameIndex + 1) * 42,
      magnitudes: Array.from({ length: binsPerFrame }, (_, binIndex) =>
        (frameIndex + binIndex) % 2 === 0 ? 0.4 : 0.8
      )
    }))
  };
}

function stubCanvasFrameRect(element: Element) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 1_000,
    height: 420,
    top: 0,
    right: 1_000,
    bottom: 420,
    left: 0,
    toJSON: () => ({})
  });
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
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={3_000}
        durationMs={12_000}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.getByRole("img", { name: "Audio waveform overview" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Audio spectrogram" })).toBeTruthy();
    expect(screen.getByLabelText("Piano pitch axis")).toBeTruthy();
    expect(screen.getAllByTestId("piano-key")).toHaveLength(88);
    expect(screen.getAllByTestId("spectrogram-time-grid-line").length).toBe(1);
    expect(screen.getByTestId("spectrogram-cursor").style.left).toBe("30%");
    expect(screen.getByLabelText("Spectrogram time navigator")).toBeTruthy();
    expect(drawCalls.some((call) => call.fillStyle === "rgb(255, 0, 0)")).toBe(true);
  });

  it("limits long spectrogram bin drawing to the canvas pixel columns", () => {
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={60_000}
        spectrogramOverview={createLongSpectrogramOverview(1_200, 4)}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const canvas = screen.getByRole("img", { name: "Audio spectrogram" }) as HTMLCanvasElement;
    const binDrawCalls = drawCalls.filter(
      (call) =>
        !(
          call.x === 0 &&
          call.y === 0 &&
          call.width === canvas.width &&
          call.height === canvas.height
        )
    );

    expect(binDrawCalls.length).toBeLessThanOrEqual(canvas.width * 4);
  });

  it("uses a stable shared spectrogram display height", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const canvas = screen.getByRole("img", { name: "Audio spectrogram" }) as HTMLCanvasElement;
    const spectrogramView = container.querySelector(".spectrogram-view") as HTMLElement;

    expect(canvas.height).toBe(420);
    expect(spectrogramView.style.getPropertyValue("--spectrogram-display-height")).toBe("420px");
  });

  it("keeps the lowest and highest piano keys inside the pitch axis", () => {
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const lowestKey = screen.getByTitle("A0");
    const highestKey = screen.getByTitle("C8");
    const lowestKeyBottom = Number.parseFloat(lowestKey.dataset.bottomPercent ?? "");
    const highestKeyBottom = Number.parseFloat(highestKey.dataset.bottomPercent ?? "");

    expect(lowestKey.dataset.logPosition).toBe("0");
    expect(highestKey.dataset.logPosition).toBe("1");
    expect(lowestKeyBottom).toBeGreaterThanOrEqual(0);
    expect(lowestKeyBottom).toBeLessThanOrEqual(100);
    expect(highestKeyBottom).toBeGreaterThanOrEqual(0);
    expect(highestKeyBottom).toBeLessThan(100);
    expect(lowestKey.style.bottom).toBe(`${lowestKeyBottom}%`);
    expect(highestKey.style.bottom).toBe(`${highestKeyBottom}%`);
  });

  it("shows an empty spectrogram state without drawing bins", () => {
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        spectrogramOverview={null}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.getByText("Generating spectrogram...")).toBeTruthy();
    expect(drawCalls).toEqual([]);
  });

  it("treats an overview with no frames as an empty spectrogram", () => {
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        spectrogramOverview={{ ...createSpectrogramOverview(), frames: [] }}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.getByText("Generating spectrogram...")).toBeTruthy();
    expect(drawCalls).toEqual([]);
  });

  it("defaults long audio to a 10 second viewport for drawing and waveform points", () => {
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={3_000}
        durationMs={12_000}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const waveform = screen.getByRole("img", { name: "Audio waveform overview" });
    expect(within(waveform).getAllByTestId("waveform-point")).toHaveLength(2);

    const canvas = screen.getByRole("img", { name: "Audio spectrogram" }) as HTMLCanvasElement;
    const binDrawCalls = drawCalls.filter(
      (call) =>
        !(
          call.x === 0 &&
          call.y === 0 &&
          call.width === canvas.width &&
          call.height === canvas.height
        )
    );

    expect(binDrawCalls).toHaveLength(8);
  });

  it("hides the main spectrogram cursor when playback is outside the viewport", () => {
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={11_000}
        durationMs={12_000}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId("spectrogram-cursor")).toBeNull();
  });

  it("zooms horizontally with ctrl wheel around the mouse position", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={2_500}
        durationMs={12_000}
        spectrogramOverview={createLongSpectrogramOverview(12, 4)}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.wheel(frame, { ctrlKey: true, deltaY: -100, clientX: 250 });

    expect(Number.parseFloat(
      screen.getByTestId("spectrogram-cursor").style.left
    )).toBeCloseTo(25, 0);
  });

  it("pans horizontally with horizontal wheel movement", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={6_000}
        durationMs={12_000}
        spectrogramOverview={createLongSpectrogramOverview(12, 4)}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.wheel(frame, { deltaX: 100, deltaY: 0, clientX: 500 });

    expect(screen.getByTestId("spectrogram-cursor").style.left).toBe("50%");
  });

  it("renders playback rate choices and reports selected rate", async () => {
    const user = userEvent.setup();
    const onPlaybackRateChange = vi.fn();

    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={3_000}
        durationMs={12_000}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={onPlaybackRateChange}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "0.75x" }));

    expect(onPlaybackRateChange).toHaveBeenCalledWith(0.75);
  });

  it("sets and clears a loop range from the current playback time", async () => {
    const user = userEvent.setup();
    const onLoopStartSet = vi.fn();
    const onLoopEndSet = vi.fn();
    const onLoopClear = vi.fn();

    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={3_000}
        durationMs={12_000}
        spectrogramOverview={createSpectrogramOverview()}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        loopRange={{ startMs: 1_000, endMs: 4_000 }}
        onLoopClear={onLoopClear}
        onLoopEndSet={onLoopEndSet}
        onLoopStartSet={onLoopStartSet}
        onPlaybackRateChange={vi.fn()}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Set Loop Start" }));
    await user.click(screen.getByRole("button", { name: "Set Loop End" }));
    await user.click(screen.getByRole("button", { name: "Clear Loop" }));

    expect(onLoopStartSet).toHaveBeenCalledWith(3_000);
    expect(onLoopEndSet).toHaveBeenCalledWith(3_000);
    expect(onLoopClear).toHaveBeenCalledOnce();
    expect(screen.getByText("Loop 0:01-0:04")).toBeTruthy();
    expect(screen.getByTestId("spectrogram-navigator-loop-range")).toBeTruthy();
  });

  it("reports viewport changes from wheel zoom", () => {
    const onViewportChange = vi.fn();
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={2_500}
        durationMs={12_000}
        spectrogramOverview={createLongSpectrogramOverview(12, 4)}
        waveformOverview={createWaveformOverview()}
        isPlaying={false}
        playbackRate={1}
        loopRange={undefined}
        onLoopClear={vi.fn()}
        onLoopEndSet={vi.fn()}
        onLoopStartSet={vi.fn()}
        onPlaybackRateChange={vi.fn()}
        onPlaybackToggle={vi.fn()}
        onSeek={vi.fn()}
        onViewportChange={onViewportChange}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.wheel(frame, { ctrlKey: true, deltaY: -100, clientX: 250 });

    expect(onViewportChange).toHaveBeenCalledWith(expect.objectContaining({
      startMs: expect.any(Number),
      durationMs: expect.any(Number)
    }));
  });
});
