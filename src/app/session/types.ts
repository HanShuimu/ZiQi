import type { PitchEnergyOverview, SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import type { ProjectSummary, WorkspaceState } from "../../core/project/types";
import type { SkinId } from "../../core/userSettings/types";
import type { ProjectAudioFacade } from "../../services/projectAudio/interfaces";
import type { PitchEnergyService } from "../../services/audio/browserPitchEnergyService";
import type { SpectrogramService } from "../../services/audio/browserSpectrogramService";
import type { WaveformService } from "../../services/audio/browserWaveformService";

export interface ProjectLocation {
  projectFilePath: string;
  projectRootPath: string;
}

export interface AppSessionState {
  project: ProjectSummary | null;
  projectLocation: ProjectLocation | null;
  waveformOverview: WaveformOverview | null;
  spectrogramOverview: SpectrogramOverview | null;
  pitchEnergyOverview: PitchEnergyOverview | null;
  isImporting: boolean;
  isOpeningProject: boolean;
  isSavingProject: boolean;
  importError: string | null;
  uiSkin: SkinId;
}

export interface AppSessionServices {
  audioFacade: ProjectAudioFacade;
  waveformService: WaveformService;
  spectrogramService: SpectrogramService;
  pitchEnergyService: PitchEnergyService;
}

export interface AppSessionActions {
  importAudio: () => Promise<void>;
  saveProject: () => Promise<void>;
  openProject: () => Promise<void>;
  changeSkin: (nextSkin: SkinId) => Promise<void>;
  updateWorkspace: (workspacePatch: Partial<WorkspaceState>) => void;
}

export interface AppSessionValue extends AppSessionState, AppSessionServices, AppSessionActions {}
