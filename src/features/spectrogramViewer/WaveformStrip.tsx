import type { WaveformOverview } from "../../core/audio/types";

interface WaveformStripProps {
  isPlaybackVisible: boolean;
  progressPercent: number;
  renderedWaveformPoints: WaveformOverview["points"];
}

export function WaveformStrip({
  isPlaybackVisible,
  progressPercent,
  renderedWaveformPoints
}: WaveformStripProps) {
  return (
    <div
      className="waveform-overview spectrogram-waveform-row"
      aria-label="Audio waveform overview"
      role="img"
    >
      <div className="waveform-grid waveform-grid-compact">
        {renderedWaveformPoints.map((point) => (
          <div
            key={`${point.startMs}-${point.endMs}`}
            className="waveform-point"
            data-testid="waveform-point"
            style={{ height: `${Math.max(2, point.peak * 100)}%` }}
          />
        ))}
      </div>
      {isPlaybackVisible ? (
        <div
          className="cursor-line cursor-line-vertical waveform-cursor"
          style={{ left: `${progressPercent}%` }}
        />
      ) : null}
    </div>
  );
}
