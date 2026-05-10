import { useEffect, useMemo, useRef } from "react";
import {
  PIANO_KEYS,
  frequencyToLogPosition,
  magnitudeToSpectrogramColor
} from "../domain/audio/spectrogram";
import type { SpectrogramOverview, WaveformOverview } from "../domain/audio/types";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 420;
const MAX_RENDERED_WAVEFORM_POINTS = 800;

interface SpectrogramViewProps {
  currentTimeMs: number;
  durationMs: number;
  spectrogramOverview: SpectrogramOverview | null | undefined;
  waveformOverview: WaveformOverview | null | undefined;
}

export function SpectrogramView({
  currentTimeMs,
  durationMs,
  spectrogramOverview,
  waveformOverview
}: SpectrogramViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderedWaveformPoints = useMemo(
    () => getRenderedWaveformPoints(waveformOverview),
    [waveformOverview]
  );
  const progressPercent =
    durationMs > 0 ? Math.min(100, Math.max(0, (currentTimeMs / durationMs) * 100)) : 0;
  const timeGridLines = useMemo(() => createTimeGridLines(durationMs), [durationMs]);
  const hasSpectrogramFrames =
    spectrogramOverview !== null &&
    spectrogramOverview !== undefined &&
    spectrogramOverview.frames.length > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !hasSpectrogramFrames) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgb(0, 0, 0)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const frameWidth = canvas.width / Math.max(1, spectrogramOverview.frames.length);
    const binHeight = canvas.height / Math.max(1, spectrogramOverview.binsPerFrame);

    spectrogramOverview.frames.forEach((frame, frameIndex) => {
      frame.magnitudes.forEach((magnitude, binIndex) => {
        context.fillStyle = magnitudeToSpectrogramColor(magnitude);
        context.fillRect(
          frameIndex * frameWidth,
          canvas.height - (binIndex + 1) * binHeight,
          Math.ceil(frameWidth),
          Math.ceil(binHeight)
        );
      });
    });
  }, [hasSpectrogramFrames, spectrogramOverview]);

  return (
    <div className="spectrogram-view">
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
        <div className="cursor-line cursor-line-vertical" style={{ left: `${progressPercent}%` }} />
      </div>

      <div className="spectrogram-body">
        <div className="piano-axis" aria-label="Piano pitch axis">
          {PIANO_KEYS.map((key) => (
            <div
              key={key.midiNumber}
              className={key.isBlackKey ? "piano-key piano-key-black" : "piano-key piano-key-white"}
              data-testid="piano-key"
              style={{
                bottom: `${frequencyToLogPosition(key.frequencyHz) * 100}%`
              }}
              title={key.name}
            />
          ))}
        </div>

        <div className="spectrogram-canvas-frame">
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
          <div
            className="cursor-line cursor-line-vertical"
            data-testid="spectrogram-cursor"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

type RenderedWaveformPoint = WaveformOverview["points"][number];

function getRenderedWaveformPoints(
  waveformOverview: WaveformOverview | null | undefined
): RenderedWaveformPoint[] {
  const points = waveformOverview?.points ?? [];
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

function createTimeGridLines(durationMs: number) {
  if (durationMs <= 0) {
    return [];
  }

  const durationSeconds = durationMs / 1000;
  const intervalSeconds = chooseGridIntervalSeconds(durationSeconds);
  const lineCount = Math.floor(durationSeconds / intervalSeconds);

  return Array.from({ length: lineCount }, (_, index) =>
    Math.round((((index + 1) * intervalSeconds) / durationSeconds) * 1000) / 10
  ).filter((position) => position > 0 && position < 100);
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
