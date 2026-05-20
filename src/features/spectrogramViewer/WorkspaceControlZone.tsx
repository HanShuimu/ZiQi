import { Button } from "../../ui";

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
  onPlaybackToggle
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
    </div>
  );
}

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
