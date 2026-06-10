import { Button, NumberField, PanelSection, SegmentedControl, SliderField } from "../../ui";
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
  loopRange: { startMs: number; endMs: number } | undefined;
  onBarGridChange: (
    settings: Partial<Pick<WorkspaceState, "beatOffsetMs" | "beatsPerBar" | "bpm">>
  ) => void;
  onLoopClear: () => Promise<void> | void;
  onLoopEndSet: (timeMs: number) => Promise<void> | void;
  onLoopStartSet: (timeMs: number) => Promise<void> | void;
  onPlaybackRateChange: (rate: number) => Promise<void> | void;
  onPlaybackToggle: () => Promise<void> | void;
  onPitchHeatmapDisplayChange: (settings: PitchHeatmapDisplaySettings) => void;
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
  loopRange,
  onBarGridChange,
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
      <PanelSection className="workspace-control-group" label="Playback">
        <Button className="playback-toggle" activating={isPlaying} onClick={onPlaybackToggle} type="button">
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <div className="playback-time">
          <span>{formatTime(currentTimeMs)}</span>
          <span>/</span>
          <span>{formatTime(durationMs)}</span>
        </div>
      </PanelSection>

      <PanelSection className="workspace-control-group" label="Speed">
        <SegmentedControl
          ariaLabel="Playback speed"
          className="playback-rate-controls"
          options={PLAYBACK_RATE_OPTIONS.map((rate) => ({ label: `${rate}x`, value: rate }))}
          value={playbackRate}
          onChange={onPlaybackRateChange}
        />
      </PanelSection>

      <PanelSection className="workspace-control-group bar-grid-controls" label="Bar Grid">
        <NumberField
          className="bar-grid-number-field"
          label="Beats per bar"
          min={1}
          onChange={(value) =>
            onBarGridChange({
              beatsPerBar: parsePositiveInteger(value, beatsPerBar)
            })
          }
          step={1}
          value={beatsPerBar}
        />
        <div className="bpm-stepper">
          <Button
            aria-label="Decrease BPM"
            className="bpm-stepper-button"
            onClick={() => onBarGridChange({ bpm: Math.max(1, Math.round(bpm) - 1) })}
            type="button"
          >
            -
          </Button>
          <NumberField
            className="bar-grid-number-field"
            inputClassName="bpm-number-input"
            label="BPM"
            min={1}
            onChange={(value) =>
              onBarGridChange({
                bpm: parsePositiveInteger(value, bpm)
              })
            }
            step={1}
            value={bpm}
          />
          <Button
            aria-label="Increase BPM"
            className="bpm-stepper-button"
            onClick={() => onBarGridChange({ bpm: Math.max(1, Math.round(bpm) + 1) })}
            type="button"
          >
            +
          </Button>
        </div>
        <NumberField
          className="bar-grid-number-field"
          label="Beat offset milliseconds"
          onChange={(value) =>
            onBarGridChange({
              beatOffsetMs: parseInteger(value, beatOffsetMs)
            })
          }
          step={1}
          value={beatOffsetMs}
        />
      </PanelSection>

      <PanelSection className="workspace-control-group" label="Loop">
        <Button onClick={() => onLoopStartSet(currentTimeMs)} type="button">
          Set Loop Start
        </Button>
        <Button onClick={() => onLoopEndSet(currentTimeMs)} type="button">
          Set Loop End
        </Button>
        {loopRange ? (
          <Button onClick={onLoopClear} type="button">
            Clear Loop
          </Button>
        ) : null}
        {loopRange ? (
          <span className="loop-summary">
            Loop {formatTime(loopRange.startMs)}-{formatTime(loopRange.endMs)}
          </span>
        ) : null}
      </PanelSection>

      <PanelSection className="workspace-control-group heatmap-display-controls" label="Heatmap Display">
        <SliderField
          ariaValueText={`Gain ${pitchHeatmapDisplay.gainDb} dB`}
          label="Gain"
          max={24}
          min={-48}
          onChange={(gainDb) =>
            onPitchHeatmapDisplayChange({
              ...pitchHeatmapDisplay,
              gainDb
            })
          }
          step={1}
          value={pitchHeatmapDisplay.gainDb}
        />
        <SliderField
          ariaValueText={`Contrast ${pitchHeatmapDisplay.contrast}`}
          label="Contrast"
          max={1.8}
          min={0.6}
          onChange={(contrast) =>
            onPitchHeatmapDisplayChange({
              ...pitchHeatmapDisplay,
              contrast
            })
          }
          step={0.1}
          value={pitchHeatmapDisplay.contrast}
        />
        <SliderField
          ariaValueText={`Range ${pitchHeatmapDisplay.dynamicRangeDb} dB`}
          label="Range"
          max={150}
          min={80}
          onChange={(dynamicRangeDb) =>
            onPitchHeatmapDisplayChange({
              ...pitchHeatmapDisplay,
              dynamicRangeDb
            })
          }
          step={1}
          value={pitchHeatmapDisplay.dynamicRangeDb}
        />
        <SliderField
          ariaValueText={`Floor ${pitchHeatmapDisplay.noiseFloorDb} dB`}
          label="Floor"
          max={0}
          min={-80}
          onChange={(noiseFloorDb) =>
            onPitchHeatmapDisplayChange({
              ...pitchHeatmapDisplay,
              noiseFloorDb
            })
          }
          step={1}
          value={pitchHeatmapDisplay.noiseFloorDb}
        />
        <SliderField
          ariaValueText={`Intensity ${pitchHeatmapDisplay.colorIntensity}`}
          label="Intensity"
          max={1.4}
          min={0.5}
          onChange={(colorIntensity) =>
            onPitchHeatmapDisplayChange({
              ...pitchHeatmapDisplay,
              colorIntensity
            })
          }
          step={0.1}
          value={pitchHeatmapDisplay.colorIntensity}
        />
        <Button onClick={() => onPitchHeatmapDisplayChange(DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS)} type="button">
          Reset
        </Button>
      </PanelSection>
    </div>
  );
}

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function parsePositiveInteger(value: number, fallback: number) {
  const parsed = parseInteger(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function parseInteger(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.round(value) : fallback;
}
