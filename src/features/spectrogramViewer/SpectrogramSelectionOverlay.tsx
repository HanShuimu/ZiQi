import type { CSSProperties } from "react";
import type { SelectedTimeRange } from "../../core/project/types";
import { timeToViewportPercent, type SpectrogramViewport } from "../../core/spectrogramViewport";

interface SpectrogramSelectionOverlayProps {
  selectedTimeRange?: SelectedTimeRange;
  viewport: SpectrogramViewport;
}

export function SpectrogramSelectionOverlay({
  selectedTimeRange,
  viewport
}: SpectrogramSelectionOverlayProps) {
  if (!selectedTimeRange) {
    return null;
  }

  const viewportEndMs = viewport.startMs + viewport.durationMs;
  const visibleStartMs = Math.max(viewport.startMs, selectedTimeRange.startMs);
  const visibleEndMs = Math.min(viewportEndMs, selectedTimeRange.endMs);

  if (visibleEndMs <= visibleStartMs) {
    return null;
  }

  const leftPercent = timeToViewportPercent(visibleStartMs, viewport);
  const widthPercent = timeToViewportPercent(visibleEndMs, viewport) - leftPercent;
  const overlayStyle = {
    left: `${leftPercent}%`,
    width: `${widthPercent}%`
  } satisfies CSSProperties;

  return (
    <div
      className="spectrogram-selection-overlay"
      data-testid="spectrogram-selection-overlay"
      style={overlayStyle}
    />
  );
}
