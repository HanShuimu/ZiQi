import { useState } from "react";
import {
  createDefaultSpectrogramViewport,
  type SpectrogramViewport
} from "../../core/spectrogramViewport";

interface UseSpectrogramViewportProps {
  controlledViewport?: SpectrogramViewport;
  durationMs: number;
  onViewportChange: (viewport: SpectrogramViewport) => void;
  resetKey: string;
}

export function useSpectrogramViewport({
  controlledViewport,
  durationMs,
  onViewportChange,
  resetKey
}: UseSpectrogramViewportProps) {
  const [internalViewportState, setInternalViewportState] = useState(() => ({
    resetKey,
    viewport: createDefaultSpectrogramViewport(durationMs)
  }));
  const internalViewport =
    internalViewportState.resetKey === resetKey
      ? internalViewportState.viewport
      : createDefaultSpectrogramViewport(durationMs);
  const activeViewport = controlledViewport ?? internalViewport;

  function updateViewport(nextViewport: SpectrogramViewport) {
    if (!controlledViewport) {
      setInternalViewportState({
        resetKey,
        viewport: nextViewport
      });
    }
    onViewportChange(nextViewport);
  }

  return { activeViewport, updateViewport };
}
