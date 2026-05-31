import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { PIANO_KEYS, magnitudeToSpectrogramColor } from "../../services/audio/spectrogram";
import type {
  PitchEnergyOverview,
  PitchHeatmapDisplaySettings,
  SpectrogramOverview,
  WaveformOverview
} from "../../core/audio/types";
import {
  DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
  PITCH_HEATMAP_MIN_HEIGHT_PX,
  PITCH_HEATMAP_MIN_LANE_HEIGHT_PX,
  PITCH_HEATMAP_NOTE_COUNT,
  mapPitchEnergyToDisplayValue
} from "../../core/audio/pitchHeatmap";
import {
  createDefaultSpectrogramViewport,
  isTimeInsideViewport,
  panSpectrogramViewport,
  timeToViewportPercent,
  zoomSpectrogramViewport
} from "../../core/spectrogramViewport";
import type { SpectrogramViewport } from "../../core/spectrogramViewport";
import {
  filterPitchEnergyFramesForViewport,
  filterWaveformPointsForViewport
} from "./spectrogramViewport";
import { SpectrogramTimelineNavigator } from "../../capabilities/timelineViewport";
import {
  formatPreciseTimeWithMilliseconds,
  getPitchHoverStateFromPoint,
  getPitchLaneCssProperties
} from "./pitchHover";
import type { HeatmapPointerState } from "./pitchHover";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = PITCH_HEATMAP_MIN_HEIGHT_PX;
const MAX_RENDERED_WAVEFORM_POINTS = 800;
const SPECTROGRAM_VIEW_STYLE = {
  "--spectrogram-display-height": `${CANVAS_HEIGHT}px`
} as CSSProperties;

function getViewportResetKey(durationMs: number, pitchEnergyOverview: PitchEnergyOverview | null | undefined) {
  return `${durationMs}:${pitchEnergyOverview?.durationMs ?? "none"}`;
}

interface SpectrogramViewProps {
  currentTimeMs: number;
  durationMs: number;
  loopRange: { startMs: number; endMs: number } | undefined;
  pitchEnergyOverview?: PitchEnergyOverview | null | undefined;
  pitchHeatmapDisplay?: PitchHeatmapDisplaySettings;
  spectrogramOverview?: SpectrogramOverview | null | undefined;
  viewport?: SpectrogramViewport;
  waveformOverview: WaveformOverview | null | undefined;
  onSeek: (timeMs: number) => Promise<void> | void;
  onViewportChange: (viewport: SpectrogramViewport) => void;
}

export function SpectrogramView({
  currentTimeMs,
  durationMs,
  loopRange,
  pitchEnergyOverview,
  pitchHeatmapDisplay = DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
  spectrogramOverview,
  viewport: controlledViewport,
  waveformOverview,
  onSeek,
  onViewportChange
}: SpectrogramViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePitchEnergyOverview = pitchEnergyOverview ?? convertSpectrogramToPitchEnergy(spectrogramOverview);
  const viewportResetKey = getViewportResetKey(durationMs, activePitchEnergyOverview);
  const [internalViewportState, setInternalViewportState] = useState(() => ({
    resetKey: viewportResetKey,
    viewport: createDefaultSpectrogramViewport(durationMs)
  }));
  const internalViewport =
    internalViewportState.resetKey === viewportResetKey
      ? internalViewportState.viewport
      : createDefaultSpectrogramViewport(durationMs);
  const activeViewport = controlledViewport ?? internalViewport;
  const [pointerState, setPointerState] = useState<HeatmapPointerState | null>(null);

  function updateViewport(nextViewport: SpectrogramViewport) {
    if (!controlledViewport) {
      setInternalViewportState({
        resetKey: viewportResetKey,
        viewport: nextViewport
      });
    }
    onViewportChange(nextViewport);
  }

  const visibleWaveformPoints = useMemo(
    () => filterWaveformPointsForViewport(waveformOverview, activeViewport),
    [activeViewport, waveformOverview]
  );
  const renderedWaveformPoints = useMemo(
    () => getRenderedWaveformPoints(visibleWaveformPoints),
    [visibleWaveformPoints]
  );
  const isPlaybackVisible = isTimeInsideViewport(currentTimeMs, activeViewport);
  const progressPercent = isPlaybackVisible ? timeToViewportPercent(currentTimeMs, activeViewport) : 0;
  const timeGridLines = useMemo(() => createTimeGridLines(activeViewport), [activeViewport]);
  const hasPitchFrames =
    activePitchEnergyOverview !== null &&
    activePitchEnergyOverview !== undefined &&
    activePitchEnergyOverview.frames.length > 0;

  const visibleFrames = useMemo(
    () =>
      hasPitchFrames
        ? filterPitchEnergyFramesForViewport(activePitchEnergyOverview, activeViewport)
        : [],
    [hasPitchFrames, activePitchEnergyOverview, activeViewport]
  );

  useEffect(() => {
    setPointerState(null);
  }, [hasPitchFrames, activeViewport.startMs, activeViewport.durationMs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !hasPitchFrames) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgb(0, 0, 0)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const renderedColumnCount = Math.min(canvas.width, visibleFrames.length);
    if (renderedColumnCount <= 0) {
      return;
    }

    const frameWidth = canvas.width / renderedColumnCount;
    const laneHeight = PITCH_HEATMAP_MIN_LANE_HEIGHT_PX;

    for (let columnIndex = 0; columnIndex < renderedColumnCount; columnIndex += 1) {
      const startFrameIndex = Math.floor(
        (columnIndex * visibleFrames.length) / renderedColumnCount
      );
      const endFrameIndex = Math.max(
        startFrameIndex + 1,
        Math.floor(((columnIndex + 1) * visibleFrames.length) / renderedColumnCount)
      );

      for (let pitchIndex = 0; pitchIndex < PITCH_HEATMAP_NOTE_COUNT; pitchIndex += 1) {
        const energy = getMaxEnergyForColumn(
          visibleFrames,
          startFrameIndex,
          endFrameIndex,
          pitchIndex
        );
        const displayValue = mapPitchEnergyToDisplayValue(energy, pitchHeatmapDisplay);
        context.fillStyle = magnitudeToSpectrogramColor(displayValue);
        context.fillRect(
          columnIndex * frameWidth,
          canvas.height - (pitchIndex + 1) * laneHeight,
          Math.ceil(frameWidth),
          laneHeight
        );
      }
    }
  }, [hasPitchFrames, pitchHeatmapDisplay, visibleFrames]);

  function handleSpectrogramWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (durationMs <= 0) {
      return;
    }

    if (event.ctrlKey) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      const anchorRatio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0.5;

      updateViewport(
        zoomSpectrogramViewport({
          viewport: activeViewport,
          totalDurationMs: durationMs,
          anchorRatio,
          deltaY: event.deltaY
        })
      );
      return;
    }

    if (event.deltaX !== 0) {
      event.preventDefault();
      updateViewport(
        panSpectrogramViewport({
          viewport: activeViewport,
          totalDurationMs: durationMs,
          direction: Math.sign(event.deltaX)
        })
      );
    }
  }

  function handleSpectrogramPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!hasPitchFrames) {
      return;
    }

    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    const bounds =
      canvasBounds && canvasBounds.width > 0 && canvasBounds.height > 0
        ? canvasBounds
        : event.currentTarget.getBoundingClientRect();

    setPointerState(
      getPitchHoverStateFromPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        bounds,
        viewport: activeViewport
      })
    );
  }

  function handleSpectrogramPointerLeave() {
    setPointerState(null);
  }

  return (
    <div className="spectrogram-view" style={SPECTROGRAM_VIEW_STYLE}>
      <div className="pitch-hover-status" data-testid="pitch-hover-status">
        {pointerState ? (
          <>
            <span className="pitch-hover-status-label">{pointerState.noteName}</span>
            <span>{pointerState.frequencyHz.toFixed(2)} Hz</span>
            <span>MIDI {pointerState.midiNumber}</span>
            <span className="pitch-hover-status-time">
              {formatPreciseTimeWithMilliseconds(pointerState.timeMs)}
            </span>
          </>
        ) : (
          <>
            <span className="pitch-hover-status-label">Pointer</span>
            <span>Hover over the heatmap</span>
          </>
        )}
      </div>
      <div className="spectrogram-time-grid">
        <div className="spectrogram-axis-spacer" />
        <div className="waveform-overview spectrogram-waveform-row" aria-label="Audio waveform overview" role="img">
          <div className="waveform-grid waveform-grid-compact">
            {renderedWaveformPoints.map((point) => (
              <div
                key={`${point.startMs}-${point.endMs}`}
                className="waveform-point"
                data-testid="waveform-point"
                style={{ height: `${Math.max(2, point.peak * 100)}%` }}
              />
            ))}
          </div>
          {isPlaybackVisible ? (
            <div
              className="cursor-line cursor-line-vertical waveform-cursor"
              style={{ left: `${progressPercent}%` }}
            />
          ) : null}
        </div>

        <div className="spectrogram-body">
          <div className="piano-axis" aria-label="Piano pitch axis">
            {PIANO_KEYS.map((key, index) => {
              const laneStyle = getPitchLaneCssProperties(index);
              const bottomPercent = Number.parseFloat(laneStyle.bottom);
              const isActiveKey = pointerState?.midiNumber === key.midiNumber;

              return (
                <div
                  key={key.midiNumber}
                  className={
                    `${key.isBlackKey ? "piano-key piano-key-black" : "piano-key piano-key-white"}${isActiveKey ? " piano-key-active" : ""}`
                  }
                  data-bottom-percent={bottomPercent}
                  data-log-position={index / (PIANO_KEYS.length - 1)}
                  data-testid="piano-key"
                  style={laneStyle}
                  title={key.name}
                />
              );
            })}
          </div>

          <div
            className="spectrogram-canvas-frame"
            onPointerLeave={handleSpectrogramPointerLeave}
            onPointerMove={handleSpectrogramPointerMove}
            onWheel={handleSpectrogramWheel}
          >
            <canvas
              aria-label="Pitch heatmap"
              className="spectrogram-canvas"
              height={CANVAS_HEIGHT}
              ref={canvasRef}
              role="img"
              width={CANVAS_WIDTH}
            />
            {!hasPitchFrames ? (
              <div className="spectrogram-empty">Generating pitch heatmap...</div>
            ) : null}
            {pointerState ? (
              <>
                <div
                  className="spectrogram-hover-row"
                  data-testid="pitch-hover-row"
                  style={getPitchLaneCssProperties(pointerState.pitchIndex)}
                />
                <div
                  className="spectrogram-hover-time-line"
                  data-testid="pitch-hover-time-line"
                  style={{ left: `${pointerState.xPercent}%` }}
                />
              </>
            ) : null}
            {timeGridLines.map((position) => (
              <div
                key={position}
                className="spectrogram-time-grid-line"
                data-testid="spectrogram-time-grid-line"
                style={{ left: `${position}%` }}
              />
            ))}
            {isPlaybackVisible ? (
              <div
                className="cursor-line cursor-line-vertical spectrogram-cursor"
                data-testid="spectrogram-cursor"
                style={{ left: `${progressPercent}%` }}
              />
            ) : null}
          </div>
        </div>

        <div className="spectrogram-axis-spacer" />
        <div className="spectrogram-navigator-row">
          <SpectrogramTimelineNavigator
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            hoverTimeMs={pointerState?.timeMs}
            loopRange={loopRange}
            onSeek={onSeek}
            onViewportChange={updateViewport}
            viewport={activeViewport}
          />
        </div>
      </div>
    </div>
  );
}

type RenderedWaveformPoint = WaveformOverview["points"][number];

function getRenderedWaveformPoints(points: RenderedWaveformPoint[]): RenderedWaveformPoint[] {
  if (points.length <= MAX_RENDERED_WAVEFORM_POINTS) {
    return points;
  }

  return Array.from({ length: MAX_RENDERED_WAVEFORM_POINTS }, (_, index) => {
    const startIndex = Math.floor((index * points.length) / MAX_RENDERED_WAVEFORM_POINTS);
    const endIndex = Math.floor(((index + 1) * points.length) / MAX_RENDERED_WAVEFORM_POINTS);
    const group = points.slice(startIndex, Math.max(startIndex + 1, endIndex));

    return {
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      peak: Math.max(...group.map((point) => point.peak))
    };
  });
}

function createTimeGridLines(viewport: SpectrogramViewport) {
  if (viewport.durationMs <= 0) {
    return [];
  }

  const durationSeconds = viewport.durationMs / 1000;
  const intervalSeconds = chooseGridIntervalSeconds(durationSeconds);
  const firstLineSeconds = Math.ceil(viewport.startMs / 1000 / intervalSeconds) * intervalSeconds;
  const endSeconds = (viewport.startMs + viewport.durationMs) / 1000;
  const positions: number[] = [];

  for (
    let lineSeconds = firstLineSeconds;
    lineSeconds < endSeconds;
    lineSeconds += intervalSeconds
  ) {
    const lineMs = lineSeconds * 1000;
    const position = timeToViewportPercent(lineMs, viewport);
    if (position > 0 && position < 100) {
      positions.push(Math.round(position * 10) / 10);
    }
  }

  return positions;
}

function getMaxEnergyForColumn(
  frames: PitchEnergyOverview["frames"],
  startFrameIndex: number,
  endFrameIndex: number,
  pitchIndex: number
) {
  let maxEnergy = 0;

  for (let frameIndex = startFrameIndex; frameIndex < endFrameIndex; frameIndex += 1) {
    maxEnergy = Math.max(maxEnergy, frames[frameIndex]?.energies[pitchIndex] ?? 0);
  }

  return maxEnergy;
}

function convertSpectrogramToPitchEnergy(
  spectrogramOverview: SpectrogramOverview | null | undefined
): PitchEnergyOverview | null {
  if (!spectrogramOverview) {
    return null;
  }

  return {
    durationMs: spectrogramOverview.durationMs,
    framesPerSecond: spectrogramOverview.framesPerSecond,
    minMidiNumber: 21,
    maxMidiNumber: 108,
    notesPerFrame: PITCH_HEATMAP_NOTE_COUNT,
    frames: spectrogramOverview.frames.map((frame) => ({
      startMs: frame.startMs,
      endMs: frame.endMs,
      energies: Array.from({ length: PITCH_HEATMAP_NOTE_COUNT }, (_, index) => {
        const sourceIndex = Math.floor((index * frame.magnitudes.length) / PITCH_HEATMAP_NOTE_COUNT);
        return frame.magnitudes[sourceIndex] ?? 0;
      })
    }))
  };
}

function chooseGridIntervalSeconds(durationSeconds: number) {
  if (durationSeconds <= 30) {
    return 5;
  }

  if (durationSeconds <= 180) {
    return 15;
  }

  return 30;
}
