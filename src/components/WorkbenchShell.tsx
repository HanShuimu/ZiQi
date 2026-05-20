import { useEffect, useState } from "react";
import type { ProjectSummary, WorkspaceState } from "../core/project/types";
import { mockProjectAudioFacade } from "../domain/audio/mockFacade";
import type { ProjectAudioFacade } from "../domain/audio/interfaces";
import type { PlaybackState, SpectrogramOverview, WaveformOverview } from "../core/audio/types";
import { SpectrogramView } from "./SpectrogramView";
import { ListItem, Panel, Tabs } from "../ui";

interface WorkbenchShellProps {
  project: ProjectSummary | null;
  audioFacade?: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  spectrogramOverview?: SpectrogramOverview | null;
  importError?: string | null;
  onWorkspaceChange?: (workspacePatch: Partial<WorkspaceState>) => void;
}

export function WorkbenchShell({
  project,
  audioFacade = mockProjectAudioFacade,
  waveformOverview,
  spectrogramOverview,
  importError,
  onWorkspaceChange = () => {}
}: WorkbenchShellProps) {
  const [appVersion, setAppVersion] = useState<string>("...");
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() =>
    audioFacade.playback.getState()
  );
  const [pendingLoopStartMs, setPendingLoopStartMs] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window.ziqiApp?.getVersion === "function") {
      void window.ziqiApp.getVersion().then(setAppVersion);
    } else {
      setAppVersion("bridge-missing");
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPlaybackState(audioFacade.playback.getState());
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [audioFacade]);

  async function handlePlaybackToggle() {
    if (playbackState.isPlaying) {
      await audioFacade.playback.pause();
    } else {
      await audioFacade.playback.play(playbackState.currentTimeMs);
    }

    setPlaybackState(audioFacade.playback.getState());
  }

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
    if (!project) {
      return;
    }

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
  }, [project, playbackState, audioFacade]);

  const durationMs = project?.sourceAudio.durationMs ?? 0;
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">ZiQi Workbench</div>
          <h1>Transcription Workbench</h1>
        </div>
        <div className="topbar-meta">
          <span>Preset: {project?.workspace.preset ?? "none"}</span>
          <span>App {appVersion}</span>
        </div>
      </header>

      {project && importError ? <p className="error-copy">{importError}</p> : null}

      {!project ? (
        <Panel className="empty-workspace">
          <div>
            <div className="section-label">Project</div>
            <h2>No project loaded</h2>
            <p className="panel-copy">
              Use the File menu to import audio or open an existing ZiQi project.
            </p>
            {importError ? <p className="error-copy">{importError}</p> : null}
          </div>
        </Panel>
      ) : (
      <main className="workspace-grid">
        <Panel className="left-rail">
          <section>
            <div className="section-label">Project</div>
            <h2>{project.name}</h2>
            <p>{project.sourceAudio.name}</p>
            <p>{project.sourceAudio.channelCount} channels</p>
          </section>

          <section>
            <div className="section-label">Assets</div>
            {project.assets.map((asset) => (
              <ListItem key={asset.id}>
                <strong>{asset.name}</strong>
                <span>{asset.kind}</span>
              </ListItem>
            ))}
          </section>

          <section>
            <div className="section-label">Annotations</div>
            {project.annotations.map((annotation) => (
              <ListItem key={annotation.id}>
                <strong>{annotation.label}</strong>
                <span>{Math.round(annotation.startMs / 1000)}s</span>
              </ListItem>
            ))}
          </section>
        </Panel>

        <section className="main-column">
          <Panel className="spectrum-panel">
            <div className="spectrum-head">
              <div>
                <div className="section-label">Primary Workspace</div>
                <h2>Raw Spectrum</h2>
              </div>
              <div className="spectrum-meta">
                <span>{project.workspace.bpm} BPM</span>
                <span>{playbackState.playbackRate.toFixed(2)}x</span>
              </div>
            </div>

            <SpectrogramView
              currentTimeMs={playbackState.currentTimeMs}
              durationMs={durationMs}
              isPlaying={playbackState.isPlaying}
              loopRange={playbackState.loopRange ?? project?.workspace.loopRange}
              onLoopClear={handleLoopClear}
              onLoopEndSet={handleLoopEndSet}
              onLoopStartSet={handleLoopStartSet}
              onPlaybackRateChange={handlePlaybackRateChange}
              onPlaybackToggle={handlePlaybackToggle}
              onSeek={handleSeek}
              onViewportChange={(spectrogramViewport) => onWorkspaceChange({ spectrogramViewport })}
              playbackRate={playbackState.playbackRate}
              spectrogramOverview={spectrogramOverview}
              viewport={project?.workspace.spectrogramViewport}
              waveformOverview={waveformOverview}
            />
          </Panel>

          <Tabs className="panel">
            <span className="active">Analysis</span>
            <span>Stems</span>
            <span>Notes</span>
            <span>Compare</span>
            <span>Hidden</span>
          </Tabs>

          <div className="dock-grid">
            <Panel>
              <div className="section-label">Analysis</div>
              {project.analysisRuns.map((run) => (
                <ListItem key={run.id}>
                  <strong>{run.name}</strong>
                  <span>{run.status}</span>
                </ListItem>
              ))}
            </Panel>

            <Panel>
              <div className="section-label">Stems</div>
              <ListItem>
                <strong>Local Demucs Slot</strong>
                <span>pending</span>
              </ListItem>
              <ListItem>
                <strong>Remote API Slot</strong>
                <span>pending</span>
              </ListItem>
            </Panel>

            <Panel>
              <div className="section-label">Session Notes</div>
              <p className="panel-copy">
                This dock will later host markers, saved viewpoints, and quick
                comparison notes without replacing the raw spectrum workspace.
              </p>
            </Panel>
          </div>

        </section>
      </main>
      )}
    </div>
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
