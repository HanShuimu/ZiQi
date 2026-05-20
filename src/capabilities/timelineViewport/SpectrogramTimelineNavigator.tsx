import { useRef } from "react";
import {
  clampSpectrogramViewport,
  formatTimeLabel,
  formatViewportRange,
  timeToTrackPercent
} from "../../core/spectrogramViewport";
import type { SpectrogramViewport } from "../../core/spectrogramViewport";

interface SpectrogramTimelineNavigatorProps {
  currentTimeMs: number;
  durationMs: number;
  loopRange?: { startMs: number; endMs: number };
  viewport: SpectrogramViewport;
  onSeek?: (timeMs: number) => void;
  onViewportChange(viewport: SpectrogramViewport): void;
}

export function SpectrogramTimelineNavigator({
  currentTimeMs,
  durationMs,
  loopRange,
  viewport,
  onSeek,
  onViewportChange
}: SpectrogramTimelineNavigatorProps) {
  if (durationMs <= 0 || viewport.durationMs <= 0) {
    return null;
  }

  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  const viewportLeftPercent = timeToTrackPercent(viewport.startMs, durationMs);
  const viewportWidthPercent = Math.min(100, (viewport.durationMs / durationMs) * 100);
  const playheadPercent = timeToTrackPercent(currentTimeMs, durationMs);
  const loopLeftPercent = loopRange ? timeToTrackPercent(loopRange.startMs, durationMs) : 0;
  const loopRightPercent = loopRange ? timeToTrackPercent(loopRange.endMs, durationMs) : 0;

  function timeForClientX(clientX: number, track: HTMLElement) {
    const bounds = track.getBoundingClientRect();
    const ratio = bounds.width > 0 ? (clientX - bounds.left) / bounds.width : 0;
    return Math.min(1, Math.max(0, ratio)) * durationMs;
  }

  function viewportForClientX(clientX: number, track: HTMLElement) {
    const bounds = track.getBoundingClientRect();
    const ratio = bounds.width > 0 ? (clientX - bounds.left) / bounds.width : 0;
    const centerMs = Math.min(1, Math.max(0, ratio)) * durationMs;

    return clampSpectrogramViewport(
      {
        startMs: centerMs - viewport.durationMs / 2,
        durationMs: viewport.durationMs
      },
      durationMs
    );
  }

  function handleTrackPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (onSeek) {
      onSeek(timeForClientX(event.clientX, event.currentTarget));
      return;
    }

    onViewportChange(viewportForClientX(event.clientX, event.currentTarget));
  }

  function handleThumbPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const thumb = event.currentTarget;
    const track = thumb.parentElement;
    if (!(track instanceof HTMLElement)) {
      return;
    }

    const startClientX = event.clientX;
    const startViewport = viewport;
    if (typeof thumb.setPointerCapture === "function") {
      thumb.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(pointerEvent: PointerEvent) {
      const bounds = track.getBoundingClientRect();
      const deltaRatio = bounds.width > 0 ? (pointerEvent.clientX - startClientX) / bounds.width : 0;
      onViewportChangeRef.current(
        clampSpectrogramViewport(
          {
            ...startViewport,
            startMs: startViewport.startMs + deltaRatio * durationMs
          },
          durationMs
        )
      );
    }

    function handlePointerUp(event: PointerEvent) {
      thumb.releasePointerCapture(event.pointerId);
      thumb.removeEventListener("pointermove", handlePointerMove);
      thumb.removeEventListener("pointerup", handlePointerUp);
      thumb.removeEventListener("pointercancel", handlePointerUp);
    }

    thumb.addEventListener("pointermove", handlePointerMove);
    thumb.addEventListener("pointerup", handlePointerUp);
    thumb.addEventListener("pointercancel", handlePointerUp);
  }

  return (
    <div className="spectrogram-navigator" aria-label="Spectrogram time navigator">
      <div className="spectrogram-navigator-labels">
        <span>{formatTimeLabel(0)}</span>
        <span>{formatViewportRange(viewport)}</span>
        <span>{formatTimeLabel(durationMs)}</span>
      </div>
      <div
        className="spectrogram-navigator-track"
        data-testid="spectrogram-navigator-track"
        onPointerDown={handleTrackPointerDown}
      >
        {loopRange ? (
          <div
            className="spectrogram-navigator-loop-range"
            data-testid="spectrogram-navigator-loop-range"
            style={{
              left: `${loopLeftPercent}%`,
              width: `${Math.max(0, loopRightPercent - loopLeftPercent)}%`
            }}
          />
        ) : null}
        <div
          className="spectrogram-navigator-thumb"
          data-testid="spectrogram-navigator-thumb"
          onPointerDown={handleThumbPointerDown}
          style={{
            left: `${viewportLeftPercent}%`,
            width: `${viewportWidthPercent}%`
          }}
        />
        <div
          className="spectrogram-navigator-playhead"
          data-testid="spectrogram-navigator-playhead"
          style={{ left: `${playheadPercent}%` }}
        />
      </div>
    </div>
  );
}
