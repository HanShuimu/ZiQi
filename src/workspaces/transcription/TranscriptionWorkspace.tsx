import type { ProjectSummary, WorkspaceState } from "../../core/project/types";
import type { ProjectAudioFacade } from "../../services/projectAudio/interfaces";
import type { SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import { SpectrogramViewer } from "../../features/spectrogramViewer/SpectrogramViewer";

export interface TranscriptionWorkspaceProps {
  project: ProjectSummary;
  audioFacade: ProjectAudioFacade;
  waveformOverview?: WaveformOverview | null;
  spectrogramOverview?: SpectrogramOverview | null;
  onWorkspaceChange: (workspacePatch: Partial<WorkspaceState>) => void;
}

export function TranscriptionWorkspace({
  project,
  audioFacade,
  waveformOverview,
  spectrogramOverview,
  onWorkspaceChange
}: TranscriptionWorkspaceProps) {
  return (
    <main className="workspace-grid workspace-grid-focused">
      <section className="main-column">
        <SpectrogramViewer
          project={project}
          audioFacade={audioFacade}
          waveformOverview={waveformOverview}
          spectrogramOverview={spectrogramOverview}
          onWorkspaceChange={onWorkspaceChange}
        />
      </section>
    </main>
  );
}
