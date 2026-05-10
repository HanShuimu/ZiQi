import { useEffect, useMemo, useState } from "react";
import type { ProjectSummary } from "../domain/project/types";
import { mockProjectAudioFacade } from "../domain/audio/mockFacade";
import type { ProjectAudioFacade } from "../domain/audio/interfaces";
import type { PlaybackState, WaveformOverview } from "../domain/audio/types";

const MAX_RENDERED_WAVEFORM_POINTS = 800;

type RenderedWaveformPoint = WaveformOverview["points"][number];

interface WorkbenchShellProps {
  project: ProjectSummary | null;
  audioFacade?: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  importError?: string | null;
  isImporting?: boolean;
  isOpeningProject?: boolean;
  isSavingProject?: boolean;
  onImportAudio?: () => Promise<void> | void;
  onOpenProject?: () => Promise<void> | void;
  onSaveProject?: () => Promise<void> | void;
}

export function WorkbenchShell({
  project,
  audioFacade = mockProjectAudioFacade,
  waveformOverview,
  importError,
  isImporting = false,
  isOpeningProject = false,
  isSavingProject = false,
  onImportAudio,
  onOpenProject,
  onSaveProject
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

  async function handlePlayFromCursor() {
    await audioFacade.playback.play(playbackState.currentTimeMs);
    setPlaybackState(audioFacade.playback.getState());
  }

  async function handlePause() {
    await audioFacade.playback.pause();
    setPlaybackState(audioFacade.playback.getState());
  }

  async function handleSeek(nextTimeMs: number) {
    await audioFacade.playback.seek(nextTimeMs);
    setPlaybackState(audioFacade.playback.getState());
  }

  const durationMs = project?.sourceAudio.durationMs ?? 0;
  const progressPercent =
    durationMs > 0
      ? Math.min(100, Math.max(0, (playbackState.currentTimeMs / durationMs) * 100))
      : 0;
  const renderedWaveformPoints = useMemo(
    () => getRenderedWaveformPoints(waveformOverview),
    [waveformOverview]
  );
  const importButtonLabel = isImporting ? "Importing..." : "Import Audio";
  const openProjectButtonLabel = isOpeningProject ? "Opening..." : "Open Project";
  const saveProjectButtonLabel = isSavingProject ? "Saving..." : "Save Project";

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

      <section className="command-strip">
        <button disabled={isOpeningProject} onClick={onOpenProject}>
          {openProjectButtonLabel}
        </button>
        <button disabled={!project || isSavingProject} onClick={onSaveProject}>
          {saveProjectButtonLabel}
        </button>
        <button disabled={isImporting} onClick={onImportAudio}>
          {importButtonLabel}
        </button>
        <button disabled={!project} onClick={handlePlayFromCursor}>Play from Cursor</button>
        <button>Toggle Grid</button>
        <button>Run Stem Provider</button>
        <button>Run Analysis</button>
      </section>

      {project && importError ? <p className="error-copy">{importError}</p> : null}

      {!project ? (
        <main className="empty-workspace panel">
          <div>
            <div className="section-label">Project</div>
            <h2>No project loaded</h2>
            <p className="panel-copy">
              Import a local audio file to create a project and open the spectrum workspace.
            </p>
            {importError ? <p className="error-copy">{importError}</p> : null}
          </div>
          <button disabled={isImporting} onClick={onImportAudio}>
            {importButtonLabel}
          </button>
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

            <div className="spectrum-canvas waveform-canvas" aria-label="Audio waveform" role="img">
              {renderedWaveformPoints.length > 0 ? (
                <div className="waveform-grid">
                  {renderedWaveformPoints.map((point) => (
                    <div
                      key={`${point.startMs}-${point.endMs}`}
                      className="waveform-point"
                      data-testid="waveform-point"
                      style={{
                        height: `${Math.max(2, point.peak * 100)}%`
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="waveform-empty">Import audio to generate a waveform.</div>
              )}

              <div
                className="cursor-line cursor-line-vertical"
                style={{ left: `${progressPercent}%` }}
              />
              <div className="grid-overlay" />
            </div>
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

          <footer className="transport panel">
            <div className="transport-summary">
              <span>Loop: off</span>
              <span>Beat offset: {project.workspace.beatOffsetMs}ms</span>
              <span>Channel mode: stereo</span>
            </div>
            <div className="transport-controls">
              <button onClick={handlePlayFromCursor}>Play</button>
              <button onClick={handlePause}>Pause</button>
              <input
                aria-label="Seek position"
                className="transport-seek"
                max={durationMs}
                min={0}
                onChange={(event) => void handleSeek(Number(event.currentTarget.value))}
                step={100}
                type="range"
                value={playbackState.currentTimeMs}
              />
            </div>
            <div className="transport-bar">
              <div className="transport-progress" style={{ width: `${progressPercent}%` }} />
            </div>
          </footer>
        </section>
      </main>
      )}
    </div>
  );
}

function getRenderedWaveformPoints(
  waveformOverview: WaveformOverview | null | undefined
): RenderedWaveformPoint[] {
  const points = waveformOverview?.points ?? [];
  if (points.length <= MAX_RENDERED_WAVEFORM_POINTS) {
    return points;
  }

  return Array.from({ length: MAX_RENDERED_WAVEFORM_POINTS }, (_, index) => {
    const startIndex = Math.floor((index * points.length) / MAX_RENDERED_WAVEFORM_POINTS);
    const endIndex = Math.floor(((index + 1) * points.length) / MAX_RENDERED_WAVEFORM_POINTS);
    const group = points.slice(startIndex, Math.max(startIndex + 1, endIndex));

    return {
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      peak: Math.max(...group.map((point) => point.peak))
    };
  });
}
