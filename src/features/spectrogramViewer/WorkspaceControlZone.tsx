import { Button } from "../../ui";
import type { PitchHeatmapDisplaySettings } from "../../core/audio/types";
import { DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS } from "../../core/audio/pitchHeatmap";

const PLAYBACK_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;

export interface WorkspaceControlZoneProps {
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;
  loopRange: { startMs: number; endMs: number } | undefined;
  onLoopClear: () => Promise<void> | void;
  onLoopEndSet: (timeMs: number) => Promise<void> | void;
  onLoopStartSet: (timeMs: number) => Promise<void> | void;
  onPlaybackRateChange: (rate: number) => Promise<void> | void;
  onPlaybackToggle: () => Promise<void> | void;
  onPitchHeatmapDisplayChange: (settings: PitchHeatmapDisplaySettings) => void;
  pitchHeatmapDisplay: PitchHeatmapDisplaySettings;
}

export function WorkspaceControlZone({
  currentTimeMs,
  durationMs,
  isPlaying,
  playbackRate,
  loopRange,
  onLoopClear,
  onLoopEndSet,
  onLoopStartSet,
  onPlaybackRateChange,
  onPlaybackToggle,
  onPitchHeatmapDisplayChange,
  pitchHeatmapDisplay
}: WorkspaceControlZoneProps) {
  return (
    <div className="workspace-control-zone" aria-label="Workspace controls">
      <div className="workspace-control-group">
        <div className="workspace-control-label">Playback</div>
        <Button className="playback-toggle" activating={isPlaying} onClick={onPlaybackToggle}>
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <div className="playback-time">
          <span>{formatTime(currentTimeMs)}</span>
          <span>/</span>
          <span>{formatTime(durationMs)}</span>
        </div>
      </div>

      <div className="workspace-control-group" aria-label="Playback speed">
        <div className="workspace-control-label">Speed</div>
        <div className="playback-rate-controls">
          {PLAYBACK_RATE_OPTIONS.map((rate) => (
            <button
              aria-pressed={playbackRate === rate}
              className="playback-rate-button"
              key={rate}
              onClick={() => onPlaybackRateChange(rate)}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      <div className="workspace-control-group" aria-label="Loop controls">
        <div className="workspace-control-label">Loop</div>
        <button onClick={() => onLoopStartSet(currentTimeMs)}>Set Loop Start</button>
        <button onClick={() => onLoopEndSet(currentTimeMs)}>Set Loop End</button>
        {loopRange ? <button onClick={onLoopClear}>Clear Loop</button> : null}
        {loopRange ? (
          <span className="loop-summary">
            Loop {formatTime(loopRange.startMs)}-{formatTime(loopRange.endMs)}
          </span>
        ) : null}
      </div>

      <div className="workspace-control-group heatmap-display-controls" aria-label="Heatmap Display">
        <div className="workspace-control-label">Heatmap Display</div>
        <label>
          Gain
          <input
            aria-label="Gain"
            max={36}
            min={-24}
            onChange={(event) =>
              onPitchHeatmapDisplayChange({
                ...pitchHeatmapDisplay,
                gainDb: Number(event.currentTarget.value)
              })
            }
            step={1}
            type="range"
            value={pitchHeatmapDisplay.gainDb}
          />
        </label>
        <label>
          Contrast
          <input
            aria-label="Contrast"
            max={3}
            min={0.5}
            onChange={(event) =>
              onPitchHeatmapDisplayChange({
                ...pitchHeatmapDisplay,
                contrast: Number(event.currentTarget.value)
              })
            }
            step={0.1}
            type="range"
            value={pitchHeatmapDisplay.contrast}
          />
        </label>
        <label>
          Range
          <input
            aria-label="Range"
            max={120}
            min={40}
            onChange={(event) =>
              onPitchHeatmapDisplayChange({
                ...pitchHeatmapDisplay,
                dynamicRangeDb: Number(event.currentTarget.value)
              })
            }
            step={1}
            type="range"
            value={pitchHeatmapDisplay.dynamicRangeDb}
          />
        </label>
        <label>
          Floor
          <input
            aria-label="Floor"
            max={-40}
            min={-120}
            onChange={(event) =>
              onPitchHeatmapDisplayChange({
                ...pitchHeatmapDisplay,
                noiseFloorDb: Number(event.currentTarget.value)
              })
            }
            step={1}
            type="range"
            value={pitchHeatmapDisplay.noiseFloorDb}
          />
        </label>
        <label>
          Intensity
          <input
            aria-label="Intensity"
            max={2}
            min={0.5}
            onChange={(event) =>
              onPitchHeatmapDisplayChange({
                ...pitchHeatmapDisplay,
                colorIntensity: Number(event.currentTarget.value)
              })
            }
            step={0.1}
            type="range"
            value={pitchHeatmapDisplay.colorIntensity}
          />
        </label>
        <button onClick={() => onPitchHeatmapDisplayChange(DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS)}>
          Reset
        </button>
      </div>
    </div>
  );
}

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
