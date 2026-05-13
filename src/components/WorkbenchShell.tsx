import { useEffect, useMemo, useState } from "react";
import type { ProjectSummary } from "../domain/project/types";
import { mockProjectAudioFacade } from "../domain/audio/mockFacade";
import type { ProjectAudioFacade } from "../domain/audio/interfaces";
import type { PlaybackState, SpectrogramOverview, WaveformOverview } from "../domain/audio/types";
import { SpectrogramView } from "./SpectrogramView";

interface WorkbenchShellProps {
  project: ProjectSummary | null;
  audioFacade?: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  spectrogramOverview?: SpectrogramOverview | null;
  importError?: string | null;
}

export function WorkbenchShell({
  project,
  audioFacade = mockProjectAudioFacade,
  waveformOverview,
  spectrogramOverview,
  importError
}: WorkbenchShellProps) {
  const [appVersion, setAppVersion] = useState<string>("...");
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() =>
    audioFacade.playback.getState()
  );

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

  const currentPositionLabel = useMemo(() => {
    const ms = playbackState.currentTimeMs;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }, [playbackState.currentTimeMs]);

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
        <main className="empty-workspace panel">
          <div>
            <div className="section-label">Project</div>
            <h2>No project loaded</h2>
            <p className="panel-copy">
              Use the File menu to import audio or open an existing ZiQi project.
            </p>
            {importError ? <p className="error-copy">{importError}</p> : null}
          </div>
        </main>
      ) : (
      <main className="workspace-grid">
        <aside className="left-rail panel">
          <section>
            <div className="section-label">Project</div>
            <h2>{project.name}</h2>
            <p>{project.sourceAudio.name}</p>
            <p>{project.sourceAudio.channelCount} channels</p>
          </section>

          <section>
            <div className="section-label">Assets</div>
            {project.assets.map((asset) => (
              <div key={asset.id} className="list-item">
                <strong>{asset.name}</strong>
                <span>{asset.kind}</span>
              </div>
            ))}
          </section>

          <section>
            <div className="section-label">Annotations</div>
            {project.annotations.map((annotation) => (
              <div key={annotation.id} className="list-item">
                <strong>{annotation.label}</strong>
                <span>{Math.round(annotation.startMs / 1000)}s</span>
              </div>
            ))}
          </section>
        </aside>

        <section className="main-column">
          <div className="panel spectrum-panel">
            <div className="spectrum-head">
              <div>
                <div className="section-label">Primary Workspace</div>
                <h2>Raw Spectrum</h2>
              </div>
              <div className="spectrum-meta">
                <span>Cursor {currentPositionLabel}</span>
                <span>{project.workspace.bpm} BPM</span>
                <span>{playbackState.playbackRate.toFixed(2)}x</span>
              </div>
            </div>

            <SpectrogramView
              currentTimeMs={playbackState.currentTimeMs}
              durationMs={durationMs}
              spectrogramOverview={spectrogramOverview}
              waveformOverview={waveformOverview}
            />
          </div>

          <div className="dock-tabs panel">
            <span className="active">Analysis</span>
            <span>Stems</span>
            <span>Notes</span>
            <span>Compare</span>
            <span>Hidden</span>
          </div>

          <div className="dock-grid">
            <section className="panel">
              <div className="section-label">Analysis</div>
              {project.analysisRuns.map((run) => (
                <div key={run.id} className="list-item">
                  <strong>{run.name}</strong>
                  <span>{run.status}</span>
                </div>
              ))}
            </section>

            <section className="panel">
              <div className="section-label">Stems</div>
              <div className="list-item">
                <strong>Local Demucs Slot</strong>
                <span>pending</span>
              </div>
              <div className="list-item">
                <strong>Remote API Slot</strong>
                <span>pending</span>
              </div>
            </section>

            <section className="panel">
              <div className="section-label">Session Notes</div>
              <p className="panel-copy">
                This dock will later host markers, saved viewpoints, and quick
                comparison notes without replacing the raw spectrum workspace.
              </p>
            </section>
          </div>

        </section>
      </main>
      )}
    </div>
  );
}
