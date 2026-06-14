import {
  getPitchLaneCssProperties,
  type HeatmapPointerState
} from "./pitchHover";

interface SpectrogramOverlayLayerProps {
  barGridLines: Array<{ leftPercent: number; timeMs: number }>;
  isPlaybackVisible: boolean;
  pointerState: HeatmapPointerState | null;
  progressPercent: number;
  timeGridLines: number[];
}

export function SpectrogramOverlayLayer({
  barGridLines,
  isPlaybackVisible,
  pointerState,
  progressPercent,
  timeGridLines
}: SpectrogramOverlayLayerProps) {
  return (
    <>
      {pointerState ? (
        <>
          <div
            className="spectrogram-hover-row"
            data-testid="pitch-hover-row"
            style={getPitchLaneCssProperties(pointerState.pitchIndex)}
          />
          <div
            className="spectrogram-hover-time-line"
            data-testid="pitch-hover-time-line"
            style={{ left: `${pointerState.xPercent}%` }}
          />
        </>
      ) : null}
      {timeGridLines.map((position) => (
        <div
          key={position}
          className="spectrogram-time-grid-line"
          data-testid="spectrogram-time-grid-line"
          style={{ left: `${position}%` }}
        />
      ))}
      {barGridLines.map((line) => (
        <div
          key={line.timeMs}
          className="spectrogram-bar-grid-line"
          data-testid="spectrogram-bar-grid-line"
          style={{ left: `${line.leftPercent}%` }}
        />
      ))}
      {isPlaybackVisible ? (
        <div
          className="cursor-line cursor-line-vertical spectrogram-cursor"
          data-testid="spectrogram-cursor"
          style={{ left: `${progressPercent}%` }}
        />
      ) : null}
    </>
  );
}
