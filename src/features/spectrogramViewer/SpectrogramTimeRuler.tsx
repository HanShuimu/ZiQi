import type { CSSProperties } from "react";
import type { SelectedTimeRange } from "../../core/project/types";
import { timeToViewportPercent, type SpectrogramViewport } from "../../core/spectrogramViewport";
import { createBarBeatTicks, createTimeRulerTicks } from "./timeRuler";

interface SpectrogramTimeRulerProps {
  beatOffsetMs: number;
  beatsPerBar: number;
  bpm: number;
  currentTimeMs: number;
  selectedTimeRange?: SelectedTimeRange;
  viewport: SpectrogramViewport;
}

export function SpectrogramTimeRuler({
  beatOffsetMs,
  beatsPerBar,
  bpm,
  currentTimeMs,
  selectedTimeRange,
  viewport
}: SpectrogramTimeRulerProps) {
  const timeTicks = createTimeRulerTicks({ viewport });
  const beatTicks = createBarBeatTicks({ viewport, bpm, beatsPerBar, beatOffsetMs });
  const rulerSelectionStyle = getVisibleSelectionStyle(selectedTimeRange, viewport);

  return (
    <div className="spectrogram-time-ruler" aria-label="Spectrogram time ruler">
      {rulerSelectionStyle ? (
        <div
          className="spectrogram-ruler-selection"
          data-testid="spectrogram-ruler-selection"
          style={rulerSelectionStyle}
        />
      ) : null}
      <div
        className="spectrogram-ruler-playhead"
        data-testid="spectrogram-ruler-playhead"
        style={{ left: `${timeToViewportPercent(currentTimeMs, viewport)}%` }}
      />
      <div className="spectrogram-ruler-row">
        <div className="spectrogram-ruler-row-name">TIME</div>
        <div className="spectrogram-ruler-row-track">
          {timeTicks.map((tick) => (
            <div
              key={`time-${tick.kind}-${tick.timeMs}`}
              className={`spectrogram-ruler-tick spectrogram-ruler-tick-${tick.kind}`}
              style={{ left: `${tick.leftPercent}%` }}
            >
              {tick.label ? <span className="spectrogram-ruler-label">{tick.label}</span> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="spectrogram-ruler-row">
        <div className="spectrogram-ruler-row-name">BEAT</div>
        <div className="spectrogram-ruler-row-track">
          {beatTicks.map((tick) => (
            <div
              key={`beat-${tick.kind}-${tick.timeMs}`}
              className={`spectrogram-ruler-tick spectrogram-ruler-tick-${tick.kind}`}
              style={{ left: `${tick.leftPercent}%` }}
            >
              {tick.label ? <span className="spectrogram-ruler-label">{tick.label}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getVisibleSelectionStyle(
  selectedTimeRange: SelectedTimeRange | undefined,
  viewport: SpectrogramViewport
): CSSProperties | undefined {
  if (!selectedTimeRange) {
    return undefined;
  }

  const viewportEndMs = viewport.startMs + viewport.durationMs;
  const visibleStartMs = Math.max(viewport.startMs, selectedTimeRange.startMs);
  const visibleEndMs = Math.min(viewportEndMs, selectedTimeRange.endMs);

  if (visibleEndMs <= visibleStartMs) {
    return undefined;
  }

  const leftPercent = timeToViewportPercent(visibleStartMs, viewport);
  const widthPercent = timeToViewportPercent(visibleEndMs, viewport) - leftPercent;

  return {
    left: `${leftPercent}%`,
    width: `${widthPercent}%`
  };
}
