import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  PIANO_KEYS,
  frequencyToLogPosition,
  magnitudeToSpectrogramColor
} from "../domain/audio/spectrogram";
import type { SpectrogramOverview, WaveformOverview } from "../domain/audio/types";
import {
  createDefaultSpectrogramViewport,
  filterSpectrogramFramesForViewport,
  filterWaveformPointsForViewport,
  isTimeInsideViewport,
  panSpectrogramViewport,
  timeToViewportPercent,
  zoomSpectrogramViewport
} from "./spectrogramViewport";
import type { SpectrogramViewport } from "./spectrogramViewport";
import { SpectrogramTimelineNavigator } from "./SpectrogramTimelineNavigator";
import { Button } from "../ui";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 420;
const MAX_RENDERED_WAVEFORM_POINTS = 800;
const PIANO_KEY_HEIGHT_PERCENT = 1.4;
const SPECTROGRAM_VIEW_STYLE = {
  "--spectrogram-display-height": `${CANVAS_HEIGHT}px`
} as CSSProperties;

const PLAYBACK_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;

interface SpectrogramViewProps {
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;
  loopRange: { startMs: number; endMs: number } | undefined;
  spectrogramOverview: SpectrogramOverview | null | undefined;
  viewport?: SpectrogramViewport;
  waveformOverview: WaveformOverview | null | undefined;
  onLoopClear: () => Promise<void> | void;
  onLoopEndSet: (timeMs: number) => Promise<void> | void;
  onLoopStartSet: (timeMs: number) => Promise<void> | void;
  onPlaybackRateChange: (rate: number) => Promise<void> | void;
  onPlaybackToggle: () => Promise<void> | void;
  onSeek: (timeMs: number) => Promise<void> | void;
  onViewportChange: (viewport: SpectrogramViewport) => void;
}

export function SpectrogramView({
  currentTimeMs,
  durationMs,
  isPlaying,
  playbackRate,
  loopRange,
  spectrogramOverview,
  viewport: controlledViewport,
  waveformOverview,
  onLoopClear,
  onLoopEndSet,
  onLoopStartSet,
  onPlaybackRateChange,
  onPlaybackToggle,
  onSeek,
  onViewportChange
}: SpectrogramViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [internalViewport, setInternalViewport] = useState(() =>
    controlledViewport ?? createDefaultSpectrogramViewport(durationMs)
  );
  const activeViewport = controlledViewport ?? internalViewport;

  function updateViewport(nextViewport: SpectrogramViewport) {
    if (!controlledViewport) {
      setInternalViewport(nextViewport);
    }
    onViewportChange(nextViewport);
  }

  useEffect(() => {
    if (controlledViewport) {
      return;
    }
    setInternalViewport((prev) => {
      const next = createDefaultSpectrogramViewport(durationMs);
      if (prev.startMs === next.startMs && prev.durationMs === next.durationMs) {
        return prev;
      }
      return next;
    });
  }, [durationMs, spectrogramOverview, controlledViewport]);
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
  const hasSpectrogramFrames =
    spectrogramOverview !== null &&
    spectrogramOverview !== undefined &&
    spectrogramOverview.frames.length > 0;

  const visibleFrames = useMemo(
    () => (hasSpectrogramFrames ? filterSpectrogramFramesForViewport(spectrogramOverview, activeViewport) : []),
    [hasSpectrogramFrames, spectrogramOverview, activeViewport]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !hasSpectrogramFrames) {
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
    const binHeight = canvas.height / Math.max(1, spectrogramOverview.binsPerFrame);

    for (let columnIndex = 0; columnIndex < renderedColumnCount; columnIndex += 1) {
      const startFrameIndex = Math.floor(
        (columnIndex * visibleFrames.length) / renderedColumnCount
      );
      const endFrameIndex = Math.max(
        startFrameIndex + 1,
        Math.floor(((columnIndex + 1) * visibleFrames.length) / renderedColumnCount)
      );

      for (let binIndex = 0; binIndex < spectrogramOverview.binsPerFrame; binIndex += 1) {
        const magnitude = getMaxMagnitudeForColumn(
          visibleFrames,
          startFrameIndex,
          endFrameIndex,
          binIndex
        );
        context.fillStyle = magnitudeToSpectrogramColor(magnitude);
        context.fillRect(
          columnIndex * frameWidth,
          canvas.height - (binIndex + 1) * binHeight,
          Math.ceil(frameWidth),
          Math.ceil(binHeight)
        );
      }
    }
  }, [visibleFrames]);

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

  function formatTime(ms: number) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  return (
    <div className="spectrogram-view" style={SPECTROGRAM_VIEW_STYLE}>
      <div className="waveform-overview" aria-label="Audio waveform overview" role="img">
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
          <div className="cursor-line cursor-line-vertical" style={{ left: `${progressPercent}%` }} />
        ) : null}
      </div>

      <div className="spectrogram-body">
        <div className="piano-axis" aria-label="Piano pitch axis">
          {PIANO_KEYS.map((key) => {
            const logPosition = frequencyToLogPosition(key.frequencyHz);
            const bottomPercent = getPianoKeyBottomPercent(logPosition);

            return (
              <div
                key={key.midiNumber}
                className={
                  key.isBlackKey ? "piano-key piano-key-black" : "piano-key piano-key-white"
                }
                data-bottom-percent={bottomPercent}
                data-log-position={logPosition}
                data-testid="piano-key"
                style={{
                  bottom: `${bottomPercent}%`
                }}
                title={key.name}
              />
            );
          })}
        </div>

        <div className="spectrogram-canvas-frame" onWheel={handleSpectrogramWheel}>
          <canvas
            aria-label="Audio spectrogram"
            className="spectrogram-canvas"
            height={CANVAS_HEIGHT}
            ref={canvasRef}
            role="img"
            width={CANVAS_WIDTH}
          />
          {!hasSpectrogramFrames ? (
            <div className="spectrogram-empty">Generating spectrogram...</div>
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
              className="cursor-line cursor-line-vertical"
              data-testid="spectrogram-cursor"
              style={{ left: `${progressPercent}%` }}
            />
          ) : null}
        </div>
      </div>

      <div className="playback-timeline-control" aria-label="Playback timeline controls">
        <Button className="playback-toggle" activating={isPlaying} onClick={onPlaybackToggle}>
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <div className="playback-time">
          <span>{formatTime(currentTimeMs)}</span>
          <span>/</span>
          <span>{formatTime(durationMs)}</span>
        </div>
        <div className="playback-rate-controls" aria-label="Playback speed">
          {PLAYBACK_RATE_OPTIONS.map((rate) => (
            <button
              aria-pressed={playbackRate === rate}
              className="playback-rate-button"
              key={rate}
              onClick={() => onPlaybackRateChange(rate)}
            >
              {rate}x
            </button>
          ))}
        </div>
        <div className="loop-controls" aria-label="Loop controls">
          <button onClick={() => onLoopStartSet(currentTimeMs)}>Set Loop Start</button>
          <button onClick={() => onLoopEndSet(currentTimeMs)}>Set Loop End</button>
          {loopRange ? <button onClick={onLoopClear}>Clear Loop</button> : null}
          {loopRange ? (
            <span className="loop-summary">
              Loop {formatTime(loopRange.startMs)}-{formatTime(loopRange.endMs)}
            </span>
          ) : null}
        </div>
      </div>

      <SpectrogramTimelineNavigator
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        loopRange={loopRange}
        onSeek={onSeek}
        onViewportChange={updateViewport}
        viewport={activeViewport}
      />
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

function getPianoKeyBottomPercent(logPosition: number) {
  const boundedPosition = Math.min(1, Math.max(0, logPosition));
  return Math.round(boundedPosition * (100 - PIANO_KEY_HEIGHT_PERCENT) * 1000) / 1000;
}

function getMaxMagnitudeForColumn(
  frames: SpectrogramOverview["frames"],
  startFrameIndex: number,
  endFrameIndex: number,
  binIndex: number
) {
  let maxMagnitude = 0;

  for (let frameIndex = startFrameIndex; frameIndex < endFrameIndex; frameIndex += 1) {
    maxMagnitude = Math.max(maxMagnitude, frames[frameIndex]?.magnitudes[binIndex] ?? 0);
  }

  return maxMagnitude;
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
