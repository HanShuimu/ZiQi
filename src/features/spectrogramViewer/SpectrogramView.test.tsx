import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import { SpectrogramView } from "./SpectrogramView";
import { getSkinDefinition } from "../../skins/registry";
import { UiProvider } from "../../ui";

const drawCalls: Array<{
  fillStyle: string;
  x: number;
  y: number;
  width: number;
  height: number;
}> = [];
const appStyles = readFileSync("src/styles.css", "utf8");

function getCssRuleBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = appStyles.match(new RegExp(`${escapedSelector}\\s*{([^}]*)}`, "s"));
  return match?.[1] ?? "";
}

function renderSpectrogramView(ui: React.ReactElement) {
  return render(wrapWithUiProvider(ui));
}

function wrapWithUiProvider(ui: React.ReactElement) {
  const skin = getSkinDefinition("default");
  return (
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

function stubCanvasRect(element: Element, rect: Partial<DOMRect> = {}) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: rect.x ?? 0,
    y: rect.y ?? 0,
    width: rect.width ?? 1_000,
    height: rect.height ?? 420,
    top: rect.top ?? rect.y ?? 0,
    right: rect.right ?? (rect.x ?? 0) + (rect.width ?? 1_000),
    bottom: rect.bottom ?? (rect.y ?? 0) + (rect.height ?? 420),
    left: rect.left ?? rect.x ?? 0,
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
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.getByRole("img", { name: "Audio waveform overview" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Pitch heatmap" })).toBeTruthy();
    expect(screen.getByLabelText("Piano pitch axis")).toBeTruthy();
    expect(screen.getAllByTestId("piano-key")).toHaveLength(88);
    expect(screen.getAllByTestId("spectrogram-time-grid-line").length).toBe(1);
    expect(screen.getByTestId("spectrogram-cursor").style.left).toBe("30%");
    expect(screen.getByLabelText("Spectrogram time navigator")).toBeTruthy();
    expect(drawCalls.some((call) => call.fillStyle !== "rgb(0, 0, 0)")).toBe(true);
  });

  it("renders a two-row ruler above the spectrogram canvas", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        beatOffsetMs={0}
        beatsPerBar={4}
        bpm={120}
        currentTimeMs={5_000}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 3_000, durationMs: 5_000 }}
        waveformOverview={createWaveformOverview()}
        onSeek={vi.fn()}
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const ruler = screen.getByLabelText("Spectrogram time ruler");
    const canvasFrame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;

    expect(screen.getByText("TIME")).toBeTruthy();
    expect(screen.getByText("BEAT")).toBeTruthy();
    expect(ruler.compareDocumentPosition(canvasFrame) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders selected range on the ruler and neutral boundaries on the spectrogram", () => {
    renderSpectrogramView(
      <SpectrogramView
        beatOffsetMs={0}
        beatsPerBar={4}
        bpm={120}
        currentTimeMs={5_000}
        durationMs={12_000}
        selectedTimeRange={{ startMs: 4_000, endMs: 6_000 }}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 3_000, durationMs: 5_000 }}
        waveformOverview={createWaveformOverview()}
        onSeek={vi.fn()}
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.getByTestId("spectrogram-ruler-selection").style.left).toBe("20%");
    expect(screen.getByTestId("spectrogram-ruler-selection").style.width).toBe("40%");
    expect(screen.getByTestId("spectrogram-selection-overlay").style.left).toBe("20%");
    expect(screen.getByTestId("spectrogram-selection-overlay").style.width).toBe("40%");
    expect(document.querySelector(".spectrogram-selection-label")).toBeNull();
  });

  it("renders visible bar grid lines from beats, bpm, and offset", () => {
    renderSpectrogramView(
      <SpectrogramView
        beatOffsetMs={500}
        beatsPerBar={4}
        bpm={120}
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 0, durationMs: 10_000 }}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.getAllByTestId("spectrogram-bar-grid-line").map((line) => line.style.left)).toEqual([
      "5%",
      "25%",
      "45%",
      "65%",
      "85%"
    ]);
  });

  it("keeps negative-offset bar grid lines aligned to the viewport", () => {
    renderSpectrogramView(
      <SpectrogramView
        beatOffsetMs={-500}
        beatsPerBar={4}
        bpm={120}
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 0, durationMs: 10_000 }}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.getAllByTestId("spectrogram-bar-grid-line").map((line) => line.style.left)).toEqual([
      "15%",
      "35%",
      "55%",
      "75%",
      "95%"
    ]);
  });

  it("limits rendered bar grid lines for extreme bpm settings", () => {
    renderSpectrogramView(
      <SpectrogramView
        beatOffsetMs={0}
        beatsPerBar={1}
        bpm={1_000_000}
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 0, durationMs: 10_000 }}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.getAllByTestId("spectrogram-bar-grid-line")).toHaveLength(1_000);
  });

  it("limits long spectrogram bin drawing to the canvas pixel columns", () => {
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={60_000}
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const canvas = screen.getByRole("img", { name: "Pitch heatmap" }) as HTMLCanvasElement;
    const binDrawCalls = drawCalls.filter(
      (call) =>
        !(
          call.x === 0 &&
          call.y === 0 &&
          call.width === canvas.width &&
          call.height === canvas.height
        )
    );

    expect(binDrawCalls.length).toBeLessThanOrEqual(canvas.width * 88);
  });

  it("uses a stable shared spectrogram display height", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const canvas = screen.getByRole("img", { name: "Pitch heatmap" }) as HTMLCanvasElement;
    const spectrogramView = container.querySelector(".spectrogram-view") as HTMLElement;

    expect(canvas.height).toBe(528);
    expect(spectrogramView.style.getPropertyValue("--spectrogram-display-height")).toBe("528px");
    expect(getCssRuleBlock(".piano-axis")).toMatch(
      /(^|\n)\s*height:\s*var\(--spectrogram-display-height\)/
    );
    expect(getCssRuleBlock(".spectrogram-canvas-frame")).toMatch(
      /(^|\n)\s*height:\s*var\(--spectrogram-display-height\)/
    );
    expect(getCssRuleBlock(".spectrogram-canvas")).toMatch(/(^|\n)\s*height:\s*100%/);
  });

  it("idle pitch hover status strip appears above spectrogram rows", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const spectrogramView = container.querySelector(".spectrogram-view") as HTMLElement;
    const status = screen.getByTestId("pitch-hover-status");

    expect(status.textContent).toContain("Pointer");
    expect(status.textContent).toContain("Hover over the heatmap");
    expect(spectrogramView.firstElementChild).toBe(status);
    expect(status.nextElementSibling?.classList.contains("spectrogram-time-grid")).toBe(true);
  });

  it("pointer move updates status, active piano key, hover row, hover time line", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.pointerMove(frame, { clientX: 500, clientY: 160 });

    const status = screen.getByTestId("pitch-hover-status");
    const hoverRow = screen.getByTestId("pitch-hover-row");
    const hoverTimeLine = screen.getByTestId("pitch-hover-time-line");
    const activeKey = screen.getByTitle("D#5");

    expect(status.textContent).toContain("D#5");
    expect(status.textContent).toContain("00:06.000 (6000 ms)");
    expect(hoverRow.style.bottom).toBe("61.36363636363637%");
    expect(hoverRow.style.height).toBe("1.1363636363636365%");
    expect(hoverTimeLine.style.left).toBe("50%");
    expect(activeKey.classList.contains("piano-key-active")).toBe(true);
    expect(activeKey.style.bottom).toBe(hoverRow.style.bottom);
  });

  it("maps hover pitch from the rendered canvas bounds instead of the outer frame", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    const canvas = container.querySelector(".spectrogram-canvas") as HTMLCanvasElement;
    stubCanvasFrameRect(frame);
    stubCanvasRect(canvas, { top: 100, bottom: 520, height: 420 });

    fireEvent.pointerMove(frame, { clientX: 500, clientY: 260 });

    const hoverRow = screen.getByTestId("pitch-hover-row");
    const activeKey = screen.getByTitle("D#5");

    expect(hoverRow.style.bottom).toBe("61.36363636363637%");
    expect(activeKey.classList.contains("piano-key-active")).toBe(true);
    expect(activeKey.style.bottom).toBe(hoverRow.style.bottom);
  });

  it("shows the hovered time in the timeline navigator", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.pointerMove(frame, { clientX: 500, clientY: 160 });

    const hoverTime = screen.getByTestId("spectrogram-navigator-hover-time");

    expect(hoverTime.style.left).toBe("50%");
    expect(hoverTime.textContent).toBe("00:06.000");
  });

  it("pointer leave clears state", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.pointerMove(frame, { clientX: 500, clientY: 160 });
    fireEvent.pointerLeave(frame);

    const status = screen.getByTestId("pitch-hover-status");

    expect(status.textContent).toContain("Pointer");
    expect(status.textContent).toContain("Hover over the heatmap");
    expect(screen.queryByTestId("pitch-hover-row")).toBeNull();
    expect(screen.queryByTestId("pitch-hover-time-line")).toBeNull();
    expect(screen.getByTitle("D#5").classList.contains("piano-key-active")).toBe(false);
  });

  it("clears pitch hover state when pitch frames become unavailable", () => {
    const { container, rerender } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.pointerMove(frame, { clientX: 500, clientY: 160 });
    expect(screen.getByTestId("pitch-hover-status").textContent).toContain("D#5");

    rerender(wrapWithUiProvider(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={null}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    ));

    expect(screen.getByTestId("pitch-hover-status").textContent).toContain("Pointer");
    expect(screen.queryByTestId("pitch-hover-row")).toBeNull();
    expect(screen.queryByTestId("pitch-hover-time-line")).toBeNull();
    expect(screen.getByTitle("D#5").classList.contains("piano-key-active")).toBe(false);
  });

  it("clears pitch hover state when the controlled viewport changes", () => {
    const { container, rerender } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.pointerMove(frame, { clientX: 500, clientY: 160 });
    expect(screen.getByTestId("pitch-hover-status").textContent).toContain("D#5");

    rerender(wrapWithUiProvider(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 2_000, durationMs: 8_000 }}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    ));

    expect(screen.getByTestId("pitch-hover-status").textContent).toContain("Pointer");
    expect(screen.queryByTestId("pitch-hover-row")).toBeNull();
    expect(screen.queryByTestId("pitch-hover-time-line")).toBeNull();
    expect(screen.getByTitle("D#5").classList.contains("piano-key-active")).toBe(false);
  });

  it("keeps the lowest and highest piano keys inside the pitch axis", () => {
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
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
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.getByText("Generating pitch heatmap...")).toBeTruthy();
    expect(drawCalls).toEqual([]);
  });

  it("treats an overview with no frames as an empty spectrogram", () => {
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.getByText("Generating pitch heatmap...")).toBeTruthy();
    expect(drawCalls).toEqual([]);
  });

  it("defaults long audio to a 10 second viewport for drawing and waveform points", () => {
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={3_000}
        durationMs={12_000}
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const waveform = screen.getByRole("img", { name: "Audio waveform overview" });
    expect(within(waveform).getAllByTestId("waveform-point")).toHaveLength(2);

    const canvas = screen.getByRole("img", { name: "Pitch heatmap" }) as HTMLCanvasElement;
    const binDrawCalls = drawCalls.filter(
      (call) =>
        !(
          call.x === 0 &&
          call.y === 0 &&
          call.width === canvas.width &&
          call.height === canvas.height
        )
    );

    expect(binDrawCalls).toHaveLength(176);
  });

  it("hides the main spectrogram cursor when playback is outside the viewport", () => {
    renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={11_000}
        durationMs={12_000}
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId("spectrogram-cursor")).toBeNull();
    expect(screen.queryByTestId("spectrogram-ruler-playhead")).toBeNull();
  });

  it("seeks on plain spectrogram click without clearing selection", () => {
    const onSeek = vi.fn();
    const onSelectedTimeRangeChange = vi.fn();
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        loopRange={undefined}
        selectedTimeRange={{ startMs: 2_000, endMs: 4_000 }}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
        waveformOverview={createWaveformOverview()}
        onSeek={onSeek}
        onSelectedTimeRangeChange={onSelectedTimeRangeChange}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.pointerDown(frame, { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerUp(frame, { button: 0, clientX: 500, pointerId: 1 });

    expect(onSeek).toHaveBeenCalledWith(6_000);
    expect(onSelectedTimeRangeChange).not.toHaveBeenCalled();
  });

  it("creates a selected range with ctrl drag", () => {
    const onSelectedTimeRangeChange = vi.fn();
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        loopRange={undefined}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
        waveformOverview={createWaveformOverview()}
        onSeek={vi.fn()}
        onSelectedTimeRangeChange={onSelectedTimeRangeChange}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.pointerDown(frame, { button: 0, ctrlKey: true, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(frame, { ctrlKey: true, clientX: 700, pointerId: 1 });
    fireEvent.pointerUp(frame, { ctrlKey: true, clientX: 700, pointerId: 1 });

    expect(onSelectedTimeRangeChange).toHaveBeenCalledWith({
      startMs: 4_000,
      endMs: 8_000
    });
  });

  it("ignores tiny ctrl drags", () => {
    const onSelectedTimeRangeChange = vi.fn();
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        loopRange={undefined}
        selectedTimeRange={undefined}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
        waveformOverview={createWaveformOverview()}
        onSeek={vi.fn()}
        onSelectedTimeRangeChange={onSelectedTimeRangeChange}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.pointerDown(frame, { button: 0, ctrlKey: true, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(frame, { ctrlKey: true, clientX: 304, pointerId: 1 });
    fireEvent.pointerUp(frame, { ctrlKey: true, clientX: 304, pointerId: 1 });

    expect(onSelectedTimeRangeChange).not.toHaveBeenCalled();
  });

  it("does not crash when a ctrl click releases an already inactive pointer capture", () => {
    const onSelectedTimeRangeChange = vi.fn();
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        loopRange={undefined}
        selectedTimeRange={{ startMs: 2_000, endMs: 4_000 }}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
        waveformOverview={createWaveformOverview()}
        onSeek={vi.fn()}
        onSelectedTimeRangeChange={onSelectedTimeRangeChange}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);
    frame.setPointerCapture = vi.fn();
    frame.releasePointerCapture = vi.fn(() => {
      throw new DOMException("No active pointer capture.", "NotFoundError");
    });

    fireEvent.pointerDown(frame, { button: 0, ctrlKey: true, clientX: 300, pointerId: 1 });

    expect(() => {
      fireEvent.pointerUp(frame, { ctrlKey: true, clientX: 300, pointerId: 1 });
    }).not.toThrow();
    expect(onSelectedTimeRangeChange).not.toHaveBeenCalled();
  });

  it("does not crash when pointer capture is unavailable during ctrl selection", () => {
    const onSelectedTimeRangeChange = vi.fn();
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={0}
        durationMs={12_000}
        loopRange={undefined}
        selectedTimeRange={{ startMs: 2_000, endMs: 4_000 }}
        spectrogramOverview={createSpectrogramOverview()}
        viewport={{ startMs: 1_000, durationMs: 10_000 }}
        waveformOverview={createWaveformOverview()}
        onSeek={vi.fn()}
        onSelectedTimeRangeChange={onSelectedTimeRangeChange}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);
    frame.setPointerCapture = vi.fn(() => {
      throw new DOMException("No active pointer.", "NotFoundError");
    });
    frame.releasePointerCapture = vi.fn();

    expect(() => {
      fireEvent.pointerDown(frame, { button: 0, ctrlKey: true, clientX: 300, pointerId: 1 });
    }).not.toThrow();
    fireEvent.pointerUp(frame, { ctrlKey: true, clientX: 300, pointerId: 1 });

    expect(onSelectedTimeRangeChange).not.toHaveBeenCalled();
  });

  it("zooms horizontally with ctrl wheel around the mouse position", () => {
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={2_500}
        durationMs={12_000}
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
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
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
        onViewportChange={vi.fn()}
      />
    );

    const frame = container.querySelector(".spectrogram-canvas-frame") as HTMLElement;
    stubCanvasFrameRect(frame);

    fireEvent.wheel(frame, { deltaX: 100, deltaY: 0, clientX: 500 });

    expect(screen.getByTestId("spectrogram-cursor").style.left).toBe("50%");
  });

  it("reports viewport changes from wheel zoom", () => {
    const onViewportChange = vi.fn();
    const { container } = renderSpectrogramView(
      <SpectrogramView
        currentTimeMs={2_500}
        durationMs={12_000}
        selectedTimeRange={undefined}
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
        onSelectedTimeRangeChange={vi.fn()}
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
