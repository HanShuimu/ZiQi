import { useCallback, useEffect, useState } from "react";
import type { ProjectSummary, SelectedTimeRange, WorkspaceState } from "../../core/project/types";
import type { ProjectAnalysisView } from "../../core/project/types";
import type { ProjectAudioFacade } from "../../services/projectAudio/interfaces";
import type {
  PitchEnergyOverview,
  PitchHeatmapDisplaySettings,
  PlaybackState,
  SpectrogramOverview,
  WaveformOverview
} from "../../core/audio/types";
import {
  DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
  clampPitchHeatmapDisplaySettings
} from "../../core/audio/pitchHeatmap";
import { SpectrogramView } from "./SpectrogramView";
import { WorkspaceControlZone } from "./WorkspaceControlZone";
import { Panel } from "../../ui";

export interface SpectrogramViewerProps {
  project: ProjectSummary;
  audioFacade: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  spectrogramOverview?: SpectrogramOverview | null;
  pitchEnergyOverview?: PitchEnergyOverview | null;
  onProjectAnalysisViewChange: (analysisViewPatch: Partial<ProjectAnalysisView>) => void;
  onWorkspaceChange: (workspacePatch: Partial<WorkspaceState>) => void;
}

export function SpectrogramViewer({
  project,
  audioFacade,
  waveformOverview,
  spectrogramOverview,
  pitchEnergyOverview,
  onProjectAnalysisViewChange,
  onWorkspaceChange
}: SpectrogramViewerProps) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() =>
    audioFacade.playback.getState()
  );
  const selectedTimeRange = project.workspace.selectedTimeRange;
  const loopEnabled = project.workspace.loopEnabled;

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

  async function applyPlaybackLoop(
    enabled: boolean,
    range: SelectedTimeRange | undefined = selectedTimeRange
  ) {
    if (enabled && range) {
      await audioFacade.playback.setLoopRange(range.startMs, range.endMs);
    } else {
      await audioFacade.playback.clearLoopRange();
    }

    setPlaybackState(audioFacade.playback.getState());
  }

  async function handleLoopEnabledChange(enabled: boolean) {
    await applyPlaybackLoop(enabled);
    onWorkspaceChange({ loopEnabled: enabled && Boolean(selectedTimeRange) });
  }

  async function handleSelectedTimeRangeChange(nextRange: SelectedTimeRange | undefined) {
    if (!nextRange) {
      await applyPlaybackLoop(false, nextRange);
      onWorkspaceChange({ selectedTimeRange: undefined, loopEnabled: false });
      return;
    }

    if (loopEnabled) {
      await applyPlaybackLoop(true, nextRange);
    }

    onWorkspaceChange({ selectedTimeRange: nextRange });
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
  const visibleLoopRange = loopEnabled ? selectedTimeRange : undefined;

  function handlePitchHeatmapDisplayChange(nextSettings: PitchHeatmapDisplaySettings) {
    onProjectAnalysisViewChange({
      pitchHeatmapDisplay: clampPitchHeatmapDisplaySettings(nextSettings)
    });
  }

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
        beatOffsetMs={project.workspace.beatOffsetMs}
        beatsPerBar={project.workspace.beatsPerBar}
        bpm={project.workspace.bpm}
        currentTimeMs={playbackState.currentTimeMs}
        durationMs={durationMs}
        isPlaying={playbackState.isPlaying}
        loopEnabled={loopEnabled}
        hasSelectedTimeRange={Boolean(selectedTimeRange)}
        onBarGridChange={onWorkspaceChange}
        onLoopEnabledChange={handleLoopEnabledChange}
        onPlaybackRateChange={handlePlaybackRateChange}
        onPlaybackToggle={handlePlaybackToggle}
        onPitchHeatmapDisplayChange={handlePitchHeatmapDisplayChange}
        onSelectedTimeRangeClear={() => handleSelectedTimeRangeChange(undefined)}
        playbackRate={playbackState.playbackRate}
        pitchHeatmapDisplay={pitchHeatmapDisplay}
      />

      <SpectrogramView
        beatOffsetMs={project.workspace.beatOffsetMs}
        beatsPerBar={project.workspace.beatsPerBar}
        bpm={project.workspace.bpm}
        currentTimeMs={playbackState.currentTimeMs}
        durationMs={durationMs}
        loopRange={visibleLoopRange}
        onSeek={handleSeek}
        onSelectedTimeRangeChange={handleSelectedTimeRangeChange}
        onViewportChange={(spectrogramViewport) => onWorkspaceChange({ spectrogramViewport })}
        pitchEnergyOverview={pitchEnergyOverview}
        pitchHeatmapDisplay={pitchHeatmapDisplay}
        selectedTimeRange={selectedTimeRange}
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
