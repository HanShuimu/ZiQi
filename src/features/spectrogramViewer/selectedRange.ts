import type { SelectedTimeRange } from "../../core/project/types";
import type { SpectrogramViewport } from "../../core/spectrogramViewport";

interface BoundsLike {
  left: number;
  width: number;
}

export function getTimeFromClientX({
  clientX,
  bounds,
  viewport,
  durationMs
}: {
  clientX: number;
  bounds: BoundsLike;
  viewport: SpectrogramViewport;
  durationMs: number;
}) {
  const ratio = bounds.width > 0 ? (clientX - bounds.left) / bounds.width : 0;
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const timeMs = viewport.startMs + clampedRatio * viewport.durationMs;
  return Math.round(Math.min(durationMs, Math.max(0, timeMs)));
}

export function getRangeFromDrag({
  anchorTimeMs,
  currentTimeMs,
  durationMs
}: {
  anchorTimeMs: number;
  currentTimeMs: number;
  durationMs: number;
}): SelectedTimeRange | undefined {
  const startMs = Math.max(0, Math.min(durationMs, Math.min(anchorTimeMs, currentTimeMs)));
  const endMs = Math.max(0, Math.min(durationMs, Math.max(anchorTimeMs, currentTimeMs)));
  const roundedStartMs = Math.round(startMs);
  const roundedEndMs = Math.round(endMs);

  if (roundedEndMs <= roundedStartMs) {
    return undefined;
  }

  return {
    startMs: roundedStartMs,
    endMs: roundedEndMs
  };
}

export function isSelectionDragDistance({
  startClientX,
  currentClientX,
  thresholdPx
}: {
  startClientX: number;
  currentClientX: number;
  thresholdPx: number;
}) {
  return Math.abs(currentClientX - startClientX) > thresholdPx;
}
