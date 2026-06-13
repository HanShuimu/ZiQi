import {
  formatPreciseTimeWithMilliseconds,
  type HeatmapPointerState
} from "./pitchHover";

interface SpectrogramHoverStatusProps {
  pointerState: HeatmapPointerState | null;
}

export function SpectrogramHoverStatus({ pointerState }: SpectrogramHoverStatusProps) {
  return (
    <div className="pitch-hover-status" data-testid="pitch-hover-status">
      {pointerState ? (
        <>
          <span className="pitch-hover-status-label">{pointerState.noteName}</span>
          <span>{pointerState.frequencyHz.toFixed(2)} Hz</span>
          <span>MIDI {pointerState.midiNumber}</span>
          <span className="pitch-hover-status-time">
            {formatPreciseTimeWithMilliseconds(pointerState.timeMs)}
          </span>
        </>
      ) : (
        <>
          <span className="pitch-hover-status-label">Pointer</span>
          <span>Hover over the heatmap</span>
        </>
      )}
    </div>
  );
}
