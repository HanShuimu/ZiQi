import type { ProjectSummary, WorkspaceState } from "../core/project/types";
import type { ProjectAnalysisView } from "../core/project/types";
import type { ProjectAudioFacade } from "../services/projectAudio/interfaces";
import type { PitchEnergyOverview, SpectrogramOverview, WaveformOverview } from "../core/audio/types";
import { mockProjectAudioFacade } from "../services/projectAudio/mockFacade";
import { Panel } from "../ui";
import { TranscriptionWorkspace } from "../workspaces/transcription/TranscriptionWorkspace";

interface WorkbenchShellProps {
  project: ProjectSummary | null;
  audioFacade?: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  spectrogramOverview?: SpectrogramOverview | null;
  pitchEnergyOverview?: PitchEnergyOverview | null;
  importError?: string | null;
  isDebugSelectionPanelOpen?: boolean;
  onProjectAnalysisViewChange?: (analysisViewPatch: Partial<ProjectAnalysisView>) => void;
  onDebugSelectionPanelClose?: () => void;
  onWorkspaceChange?: (workspacePatch: Partial<WorkspaceState>) => void;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}

function formatSampleRate(sampleRate: number) {
  if (sampleRate % 1000 === 0) {
    return `${sampleRate / 1000}kHz`;
  }
  return `${Math.round((sampleRate / 1000) * 10) / 10}kHz`;
}

export function WorkbenchShell({
  project,
  audioFacade = mockProjectAudioFacade,
  waveformOverview,
  spectrogramOverview,
  pitchEnergyOverview,
  importError,
  isDebugSelectionPanelOpen = false,
  onProjectAnalysisViewChange = () => {},
  onDebugSelectionPanelClose = () => {},
  onWorkspaceChange = () => {}
}: WorkbenchShellProps) {
  void isDebugSelectionPanelOpen;
  void onDebugSelectionPanelClose;

  if (!project) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div>
            <div className="eyebrow">ZiQi Workbench</div>
            <h1>Transcription Workbench</h1>
          </div>
        </header>
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
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-title">
          <div className="eyebrow">ZiQi Workbench</div>
          <h1>{project.name}</h1>
          <p>{project.sourceAudio.name}</p>
        </div>
        <div className="topbar-meta" aria-label="Source audio metadata">
          <span>{formatDuration(project.sourceAudio.durationMs)}</span>
          <span>{project.sourceAudio.channelCount}ch</span>
          <span>{formatSampleRate(project.sourceAudio.sampleRate)}</span>
        </div>
      </header>
      {importError ? <p className="error-copy">{importError}</p> : null}
      <TranscriptionWorkspace
        project={project}
        audioFacade={audioFacade}
        waveformOverview={waveformOverview}
        spectrogramOverview={spectrogramOverview}
        pitchEnergyOverview={pitchEnergyOverview}
        onProjectAnalysisViewChange={onProjectAnalysisViewChange}
        onWorkspaceChange={onWorkspaceChange}
      />
    </div>
  );
}
