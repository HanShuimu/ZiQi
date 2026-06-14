import { afterEach, describe, expect, it, vi } from "vitest";
import type { SelectedTimeRange } from "../../core/project/types";

describe("useSpectrogramSelection", () => {
  afterEach(() => {
    vi.doUnmock("react");
    vi.resetModules();
  });

  it("does not read pointer event currentTarget inside deferred state updaters", async () => {
    let dragState: {
      pointerId: number;
      startClientX: number;
      anchorTimeMs: number;
      previewRange?: SelectedTimeRange;
    } | null = {
      pointerId: 1,
      startClientX: 100,
      anchorTimeMs: 1_000
    };
    const beforeStateUpdaterRef: { current?: () => void } = {};

    vi.doMock("react", () => ({
      useCallback: <TCallback extends (...args: never[]) => unknown>(callback: TCallback) =>
        callback,
      useMemo: <TValue>(factory: () => TValue) => factory(),
      useState: () => [
        dragState,
        (
          next:
            | typeof dragState
            | ((currentDragState: typeof dragState) => typeof dragState)
        ) => {
          if (typeof next === "function") {
            beforeStateUpdaterRef.current?.();
            dragState = next(dragState);
            return;
          }

          dragState = next;
        }
      ]
    }));

    const { useSpectrogramSelection } = await import("./useSpectrogramSelection");
    const { selectionPointerHandlers } = useSpectrogramSelection({
      durationMs: 10_000,
      viewport: { startMs: 0, durationMs: 10_000 },
      onSeek: vi.fn(),
      onSelectedTimeRangeChange: vi.fn()
    });
    const event = {
      clientX: 700,
      currentTarget: {
        getBoundingClientRect: () => ({
          left: 0,
          width: 1_000
        })
      },
      pointerId: 1
    };
    beforeStateUpdaterRef.current = () => {
      event.currentTarget = null as unknown as typeof event.currentTarget;
    };

    expect(() => {
      selectionPointerHandlers.onPointerMove(event as never);
    }).not.toThrow();
    expect(dragState?.previewRange).toEqual({
      startMs: 1_000,
      endMs: 7_000
    });
  });
});
