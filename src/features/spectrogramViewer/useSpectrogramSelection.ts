import { useCallback, useMemo, useState } from "react";
import type { PointerEventHandler } from "react";
import type { SelectedTimeRange } from "../../core/project/types";
import type { SpectrogramViewport } from "../../core/spectrogramViewport";
import {
  getRangeFromDrag,
  getTimeFromClientX,
  isSelectionDragDistance
} from "./selectedRange";

export const SELECTION_DRAG_THRESHOLD_PX = 6;

interface UseSpectrogramSelectionParams {
  durationMs: number;
  viewport: SpectrogramViewport;
  onSeek: (timeMs: number) => Promise<void> | void;
  onSelectedTimeRangeChange: (range: SelectedTimeRange | undefined) => void;
}

interface SelectionDragState {
  pointerId: number;
  startClientX: number;
  anchorTimeMs: number;
  previewRange?: SelectedTimeRange;
}

export function useSpectrogramSelection({
  durationMs,
  viewport,
  onSeek,
  onSelectedTimeRangeChange
}: UseSpectrogramSelectionParams) {
  const [dragState, setDragState] = useState<SelectionDragState | null>(null);

  const handlePointerDown = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (event.button !== 0) {
        return;
      }

      const bounds = event.currentTarget.getBoundingClientRect();
      const timeMs = getTimeFromClientX({
        clientX: event.clientX,
        bounds,
        viewport,
        durationMs
      });

      if (!event.ctrlKey) {
        void onSeek(timeMs);
        return;
      }

      event.preventDefault();
      capturePointer(event.currentTarget, event.pointerId);
      setDragState({
        pointerId: event.pointerId,
        startClientX: event.clientX,
        anchorTimeMs: timeMs
      });
    },
    [durationMs, onSeek, viewport]
  );

  const handlePointerMove = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      setDragState((currentDragState) => {
        if (!currentDragState || currentDragState.pointerId !== event.pointerId) {
          return currentDragState;
        }

        const hasSelectionDistance = isSelectionDragDistance({
          startClientX: currentDragState.startClientX,
          currentClientX: event.clientX,
          thresholdPx: SELECTION_DRAG_THRESHOLD_PX
        });

        if (!hasSelectionDistance) {
          return {
            pointerId: currentDragState.pointerId,
            startClientX: currentDragState.startClientX,
            anchorTimeMs: currentDragState.anchorTimeMs
          };
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        const currentTimeMs = getTimeFromClientX({
          clientX: event.clientX,
          bounds,
          viewport,
          durationMs
        });
        const previewRange = getRangeFromDrag({
          anchorTimeMs: currentDragState.anchorTimeMs,
          currentTimeMs,
          durationMs
        });

        if (!previewRange) {
          return {
            pointerId: currentDragState.pointerId,
            startClientX: currentDragState.startClientX,
            anchorTimeMs: currentDragState.anchorTimeMs
          };
        }

        return {
          ...currentDragState,
          previewRange
        };
      });
    },
    [durationMs, viewport]
  );

  const handlePointerUp = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      releasePointer(event.currentTarget, event.pointerId);

      if (dragState.previewRange) {
        onSelectedTimeRangeChange(dragState.previewRange);
      }

      setDragState(null);
    },
    [dragState, onSelectedTimeRangeChange]
  );

  const handlePointerCancel = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      releasePointer(event.currentTarget, event.pointerId);
      setDragState(null);
    },
    [dragState]
  );

  const selectionPointerHandlers = useMemo(
    () => ({
      onPointerCancel: handlePointerCancel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp
    }),
    [handlePointerCancel, handlePointerDown, handlePointerMove, handlePointerUp]
  );

  return {
    previewRange: dragState?.previewRange,
    selectionPointerHandlers
  };
}

function capturePointer(element: HTMLElement, pointerId: number) {
  if (typeof element.setPointerCapture === "function") {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Pointer capture is best-effort; selection still works while the pointer stays in frame.
    }
  }
}

function releasePointer(element: HTMLElement, pointerId: number) {
  if (typeof element.releasePointerCapture === "function") {
    try {
      element.releasePointerCapture(pointerId);
    } catch {
      // Browsers may have already released capture by pointerup/cancel.
    }
  }
}
