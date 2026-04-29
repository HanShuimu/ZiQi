import { useEffect, useMemo, useState } from "react";
import type { ProjectSummary } from "../domain/project/types";
import { mockProjectAudioFacade } from "../domain/audio/mockFacade";
import type { SpectrumFrame } from "../domain/audio/types";

interface WorkbenchShellProps {
  project: ProjectSummary;
}

export function WorkbenchShell({ project }: WorkbenchShellProps) {
  const [appVersion, setAppVersion] = useState<string>("...");
  const [spectrumFrames, setSpectrumFrames] = useState<SpectrumFrame[]>([]);

  useEffect(() => {
    void window.ziqiApp.getVersion().then(setAppVersion);
    void mockProjectAudioFacade.analysis
      .getSpectrum({
        startMs: 0,
        endMs: 12000,
        minHz: 20,
        maxHz: 5000,
        channelMode: "merged"
      })
      .then(setSpectrumFrames);
  }, []);

  const currentPositionLabel = useMemo(() => {
    const ms = mockProjectAudioFacade.playback.getState().currentTimeMs;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">ZiQi Workbench</div>
          <h1>Transcription Workbench</h1>
        </div>
        <div className="topbar-meta">
          <span>Preset: {project.workspace.preset}</span>
          <span>App {appVersion}</span>
        </div>
      </header>

      <section className="command-strip">
        <button>Open Project</button>
        <button>Import Audio</button>
        <button>Play from Cursor</button>
        <button>Toggle Grid</button>
        <button>Run Stem Provider</button>
        <button>Run Analysis</button>
      </section>

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
                <span>{project.workspace.playbackRate.toFixed(2)}x</span>
              </div>
            </div>

            <div className="spectrum-canvas">
              <div className="spectrum-grid">
                {spectrumFrames.map((frame) => (
                  <div key={frame.startMs} className="spectrum-column">
                    {frame.bins.map((bin, index) => (
                      <div
                        key={index}
                        className="spectrum-bin"
                        style={{
                          opacity: Math.min(1, bin + 0.2),
                          height: `${Math.max(6, bin * 100)}%`
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div className="cursor-line cursor-line-vertical" />
              <div className="cursor-line cursor-line-horizontal" />
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
            <div className="transport-bar">
              <div className="transport-progress" style={{ width: "33%" }} />
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}

