import { Button } from "../../ui";
import type { PitchHeatmapDisplaySettings } from "../../core/audio/types";
import { DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS } from "../../core/audio/pitchHeatmap";
import type { WorkspaceState } from "../../core/project/types";

const PLAYBACK_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;

export interface WorkspaceControlZoneProps {
  beatOffsetMs: number;
  beatsPerBar: number;
  bpm: number;
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;
  loopEnabled: boolean;
  hasSelectedTimeRange: boolean;
  onBarGridChange: (
    settings: Partial<Pick<WorkspaceState, "beatOffsetMs" | "beatsPerBar" | "bpm">>
  ) => void;
  onLoopEnabledChange: (enabled: boolean) => Promise<void> | void;
  onPlaybackRateChange: (rate: number) => Promise<void> | void;
  onPlaybackToggle: () => Promise<void> | void;
  onPitchHeatmapDisplayChange: (settings: PitchHeatmapDisplaySettings) => void;
  onSelectedTimeRangeClear: () => Promise<void> | void;
  pitchHeatmapDisplay: PitchHeatmapDisplaySettings;
}

export function WorkspaceControlZone({
  beatOffsetMs,
  beatsPerBar,
  bpm,
  currentTimeMs,
  durationMs,
  isPlaying,
  playbackRate,
  loopEnabled,
  hasSelectedTimeRange,
  onBarGridChange,
  onLoopEnabledChange,
  onPlaybackRateChange,
  onPlaybackToggle,
  onPitchHeatmapDisplayChange,
  onSelectedTimeRangeClear,
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

      <div className="workspace-control-group bar-grid-controls" aria-label="Bar Grid controls">
        <div className="workspace-control-label">Bar Grid</div>
        <label className="bar-grid-number-field">
          Beats
          <input
            aria-label="Beats per bar"
            min={1}
            onChange={(event) =>
              onBarGridChange({
                beatsPerBar: parsePositiveInteger(event.currentTarget.value, beatsPerBar)
              })
            }
            step={1}
            type="number"
            value={beatsPerBar}
          />
        </label>
        <div className="bar-grid-number-field">
          <span>BPM</span>
          <span className="bpm-stepper">
            <button
              aria-label="Decrease BPM"
              onClick={() => onBarGridChange({ bpm: Math.max(1, Math.round(bpm) - 1) })}
              type="button"
            >
              -
            </button>
            <input
              aria-label="BPM"
              min={1}
              onChange={(event) =>
                onBarGridChange({
                  bpm: parsePositiveInteger(event.currentTarget.value, bpm)
                })
              }
              step={1}
              type="number"
              value={bpm}
            />
            <button
              aria-label="Increase BPM"
              onClick={() => onBarGridChange({ bpm: Math.max(1, Math.round(bpm) + 1) })}
              type="button"
            >
              +
            </button>
          </span>
        </div>
        <label className="bar-grid-number-field">
          Offset ms
          <input
            aria-label="Beat offset milliseconds"
            onChange={(event) =>
              onBarGridChange({
                beatOffsetMs: parseInteger(event.currentTarget.value, beatOffsetMs)
              })
            }
            step={1}
            type="number"
            value={beatOffsetMs}
          />
        </label>
      </div>

      <div className="workspace-control-group" aria-label="Loop controls">
        <div className="workspace-control-label">Loop</div>
        <button
          aria-pressed={loopEnabled}
          disabled={!hasSelectedTimeRange}
          onClick={() => onLoopEnabledChange(!loopEnabled)}
          type="button"
        >
          Loop
        </button>
        {hasSelectedTimeRange ? (
          <button onClick={onSelectedTimeRangeClear} type="button">
            Clear Selection
          </button>
        ) : null}
      </div>

      <div className="workspace-control-group heatmap-display-controls" aria-label="Heatmap Display">
        <div className="workspace-control-label">Heatmap Display</div>
        <label>
          Gain
          <input
            aria-label="Gain"
            max={24}
            min={-48}
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
            max={1.8}
            min={0.6}
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
            max={150}
            min={80}
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
            max={0}
            min={-80}
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
            max={1.4}
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

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = parseInteger(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}
