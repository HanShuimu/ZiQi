import type { ProjectSummary, WorkspaceState } from "../core/project/types";
import type { ProjectAudioFacade } from "../services/projectAudio/interfaces";
import type { SpectrogramOverview, WaveformOverview } from "../core/audio/types";
import { mockProjectAudioFacade } from "../services/projectAudio/mockFacade";
import { Panel } from "../ui";
import { TranscriptionWorkspace } from "../workspaces/transcription/TranscriptionWorkspace";

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
        <div>
          <div className="eyebrow">ZiQi Workbench</div>
          <h1>Transcription Workbench</h1>
        </div>
        <div className="topbar-meta">
          <span>Preset: {project.workspace.preset}</span>
        </div>
      </header>
      {importError ? <p className="error-copy">{importError}</p> : null}
      <TranscriptionWorkspace
        project={project}
        audioFacade={audioFacade}
        waveformOverview={waveformOverview}
        spectrogramOverview={spectrogramOverview}
        onWorkspaceChange={onWorkspaceChange}
      />
    </div>
  );
}
