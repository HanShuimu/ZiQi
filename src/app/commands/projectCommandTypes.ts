import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { PitchEnergyOverview, SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import type { ProjectSummary } from "../../core/project/types";
import type { PitchEnergyService } from "../../services/audio/browserPitchEnergyService";
import type { SpectrogramService } from "../../services/audio/browserSpectrogramService";
import type { WaveformService } from "../../services/audio/browserWaveformService";
import type { ProjectAudioFacade } from "../../services/projectAudio/interfaces";
import type { ProjectLocation } from "../session/types";

export interface ProjectCommandDependencies {
  project: ProjectSummary | null;
  projectLocation: ProjectLocation | null;
  activePlaybackUrl: MutableRefObject<string | null>;
  audioFacade: ProjectAudioFacade;
  waveformService: WaveformService;
  spectrogramService: SpectrogramService;
  pitchEnergyService: PitchEnergyService;
  setProject: Dispatch<SetStateAction<ProjectSummary | null>>;
  setProjectLocation: Dispatch<SetStateAction<ProjectLocation | null>>;
  setWaveformOverview: Dispatch<SetStateAction<WaveformOverview | null>>;
  setSpectrogramOverview: Dispatch<SetStateAction<SpectrogramOverview | null>>;
  setPitchEnergyOverview: Dispatch<SetStateAction<PitchEnergyOverview | null>>;
  setIsImporting: Dispatch<SetStateAction<boolean>>;
  setIsOpeningProject: Dispatch<SetStateAction<boolean>>;
  setIsSavingProject: Dispatch<SetStateAction<boolean>>;
  setImportError: Dispatch<SetStateAction<string | null>>;
}
