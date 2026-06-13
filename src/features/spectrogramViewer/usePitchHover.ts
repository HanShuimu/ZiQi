import { useState } from "react";
import type { PointerEvent } from "react";
import type { SpectrogramViewport } from "../../core/spectrogramViewport";
import {
  getPitchHoverStateFromPoint,
  type HeatmapPointerState
} from "./pitchHover";

interface UsePitchHoverProps {
  activeViewport: SpectrogramViewport;
  canvasRef: { current: HTMLCanvasElement | null };
  hasPitchFrames: boolean;
}

export function usePitchHover({
  activeViewport,
  canvasRef,
  hasPitchFrames
}: UsePitchHoverProps) {
  const resetKey = `${hasPitchFrames}:${activeViewport.startMs}:${activeViewport.durationMs}`;
  const [pointerStateState, setPointerStateState] = useState<{
    resetKey: string;
    pointerState: HeatmapPointerState | null;
  }>(() => ({
    resetKey,
    pointerState: null
  }));
  const pointerState =
    pointerStateState.resetKey === resetKey ? pointerStateState.pointerState : null;

  function handleSpectrogramPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!hasPitchFrames) {
      return;
    }

    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    const bounds =
      canvasBounds && canvasBounds.width > 0 && canvasBounds.height > 0
        ? canvasBounds
        : event.currentTarget.getBoundingClientRect();

    setPointerStateState({
      resetKey,
      pointerState: getPitchHoverStateFromPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        bounds,
        viewport: activeViewport
      })
    });
  }

  function handleSpectrogramPointerLeave() {
    setPointerStateState({
      resetKey,
      pointerState: null
    });
  }

  return { handleSpectrogramPointerLeave, handleSpectrogramPointerMove, pointerState };
}
