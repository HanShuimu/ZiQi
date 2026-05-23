import { useCallback, useEffect, useState } from "react";
import type { ProjectSummary, WorkspaceState } from "../../core/project/types";
import type { ProjectAudioFacade } from "../../services/projectAudio/interfaces";
import type { PitchEnergyOverview, PlaybackState, SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import { DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS } from "../../core/audio/pitchHeatmap";
import { SpectrogramView } from "./SpectrogramView";
import { WorkspaceControlZone } from "./WorkspaceControlZone";
import { Panel } from "../../ui";

export interface SpectrogramViewerProps {
  project: ProjectSummary;
  audioFacade: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  spectrogramOverview?: SpectrogramOverview | null;
  pitchEnergyOverview?: PitchEnergyOverview | null;
  onWorkspaceChange: (workspacePatch: Partial<WorkspaceState>) => void;
}

export function SpectrogramViewer({
  project,
  audioFacade,
  waveformOverview,
  spectrogramOverview,
  pitchEnergyOverview,
  onWorkspaceChange
}: SpectrogramViewerProps) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() =>
    audioFacade.playback.getState()
  );
  const [pendingLoopStartMs, setPendingLoopStartMs] = useState<number | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPlaybackState(audioFacade.playback.getState());
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [audioFacade]);

  const handlePlaybackToggle = useCallback(async () => {
    if (playbackState.isPlaying) {
      await audioFacade.playback.pause();
    } else {
      await audioFacade.playback.play(playbackState.currentTimeMs);
    }

    setPlaybackState(audioFacade.playback.getState());
  }, [audioFacade, playbackState.currentTimeMs, playbackState.isPlaying]);

  async function handleSeek(timeMs: number) {
    await audioFacade.playback.seek(timeMs);
    setPlaybackState(audioFacade.playback.getState());
  }

  async function handlePlaybackRateChange(rate: number) {
    await audioFacade.playback.setPlaybackRate(rate);
    setPlaybackState(audioFacade.playback.getState());
    onWorkspaceChange({ playbackRate: rate });
  }

  function handleLoopStartSet(timeMs: number) {
    setPendingLoopStartMs(timeMs);
  }

  async function handleLoopEndSet(timeMs: number) {
    const startMs = pendingLoopStartMs ?? playbackState.loopRange?.startMs;
    if (typeof startMs !== "number" || timeMs <= startMs) {
      return;
    }

    const loopRange = {
      startMs,
      endMs: timeMs
    };

    await audioFacade.playback.setLoopRange(loopRange.startMs, loopRange.endMs);
    setPlaybackState(audioFacade.playback.getState());
    onWorkspaceChange({ loopRange });
  }

  async function handleLoopClear() {
    await audioFacade.playback.clearLoopRange();
    setPendingLoopStartMs(null);
    setPlaybackState(audioFacade.playback.getState());
    onWorkspaceChange({ loopRange: undefined });
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return;
      }

      if (shouldIgnorePlaybackShortcut(event.target)) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      void handlePlaybackToggle();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlaybackToggle]);

  const durationMs = project.sourceAudio.durationMs;
  const pitchHeatmapDisplay =
    project.analysisView?.pitchHeatmapDisplay ?? DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS;

  return (
    <Panel className="spectrum-panel">
      <div className="spectrum-head">
        <div>
          <div className="section-label">Primary Workspace</div>
          <h2>Pitch Heatmap</h2>
        </div>
        <div className="spectrum-meta">
          <span>{project.workspace.bpm} BPM</span>
          <span>{playbackState.playbackRate.toFixed(2)}x</span>
        </div>
      </div>

      <WorkspaceControlZone
        currentTimeMs={playbackState.currentTimeMs}
        durationMs={durationMs}
        isPlaying={playbackState.isPlaying}
        loopRange={playbackState.loopRange ?? project.workspace.loopRange}
        onLoopClear={handleLoopClear}
        onLoopEndSet={handleLoopEndSet}
        onLoopStartSet={handleLoopStartSet}
        onPlaybackRateChange={handlePlaybackRateChange}
        onPlaybackToggle={handlePlaybackToggle}
        playbackRate={playbackState.playbackRate}
      />

      <SpectrogramView
        currentTimeMs={playbackState.currentTimeMs}
        durationMs={durationMs}
        loopRange={playbackState.loopRange ?? project.workspace.loopRange}
        onSeek={handleSeek}
        onViewportChange={(spectrogramViewport) => onWorkspaceChange({ spectrogramViewport })}
        pitchEnergyOverview={pitchEnergyOverview}
        pitchHeatmapDisplay={pitchHeatmapDisplay}
        spectrogramOverview={spectrogramOverview}
        viewport={project.workspace.spectrogramViewport}
        waveformOverview={waveformOverview}
      />
    </Panel>
  );
}

function shouldIgnorePlaybackShortcut(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "button" ||
    target.isContentEditable
  );
}
