import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ProjectAnalysisView, ProjectSummary } from "../../core/project/types";
import { normalizeProjectAnalysisView } from "../../core/project/analysisView";
import {
  createBrowserWaveformService,
  type WaveformService
} from "../../services/audio/browserWaveformService";
import {
  createBrowserSpectrogramService,
  type SpectrogramService
} from "../../services/audio/browserSpectrogramService";
import {
  createBrowserPitchEnergyService,
  type PitchEnergyService
} from "../../services/audio/browserPitchEnergyService";
import type { PitchEnergyOverview, SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import { createProjectCommands } from "../commands/projectCommands";
import { rendererLogger } from "../../services/logging/rendererLogger";
import { createBrowserProjectAudioFacade } from "../../services/projectAudio/browserProjectAudioFacade";
import { useAppRuntime } from "../runtime";
import { AppSessionContext } from "./AppSessionContext";
import type { AppSessionValue, ProjectLocation } from "./types";

interface AppSessionProviderProps {
  children: ReactNode;
  waveformService?: WaveformService;
  spectrogramService?: SpectrogramService;
  pitchEnergyService?: PitchEnergyService;
}

export function AppSessionProvider({
  children,
  waveformService,
  spectrogramService,
  pitchEnergyService
}: AppSessionProviderProps) {
  const runtime = useAppRuntime();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [projectLocation, setProjectLocation] = useState<ProjectLocation | null>(null);
  const [waveformOverview, setWaveformOverview] = useState<WaveformOverview | null>(null);
  const [spectrogramOverview, setSpectrogramOverview] = useState<SpectrogramOverview | null>(null);
  const [pitchEnergyOverview, setPitchEnergyOverview] = useState<PitchEnergyOverview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const activePlaybackUrl = useRef<string | null>(null);
  const audioFacade = useMemo(
    () => createBrowserProjectAudioFacade(new Audio()),
    []
  );
  const activeWaveformService = useMemo(
    () => waveformService ?? createBrowserWaveformService(rendererLogger),
    [waveformService]
  );
  const activeSpectrogramService = useMemo(
    () => spectrogramService ?? createBrowserSpectrogramService(rendererLogger),
    [spectrogramService]
  );
  const activePitchEnergyService = useMemo(
    () => pitchEnergyService ?? createBrowserPitchEnergyService({ logger: rendererLogger }),
    [pitchEnergyService]
  );

  useEffect(() => {
    const playbackUrlRef = activePlaybackUrl;

    return () => {
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
      }
    };
  }, []);

  const value = useMemo<AppSessionValue>(
    () => {
      // eslint-disable-next-line react-hooks/refs
      const projectCommands = createProjectCommands({
        runtime,
        project,
        projectLocation,
        activePlaybackUrl,
        audioFacade,
        waveformService: activeWaveformService,
        spectrogramService: activeSpectrogramService,
        pitchEnergyService: activePitchEnergyService,
        logger: rendererLogger,
        setProject,
        setProjectLocation,
        setWaveformOverview,
        setSpectrogramOverview,
        setPitchEnergyOverview,
        setIsImporting,
        setIsOpeningProject,
        setIsSavingProject,
        setImportError
      });
      const updateProjectAnalysisView = (analysisViewPatch: Partial<ProjectAnalysisView>) => {
        setProject((currentProject) => {
          if (!currentProject) {
            return currentProject;
          }

          return {
            ...currentProject,
            analysisView: normalizeProjectAnalysisView({
              ...currentProject.analysisView,
              ...analysisViewPatch
            })
          };
        });
      };

      return {
        project,
        projectLocation,
        waveformOverview,
        spectrogramOverview,
        pitchEnergyOverview,
        isImporting,
        isOpeningProject,
        isSavingProject,
        importError,
        audioFacade,
        waveformService: activeWaveformService,
        spectrogramService: activeSpectrogramService,
        pitchEnergyService: activePitchEnergyService,
        importAudio: projectCommands.importAudio,
        saveProject: projectCommands.saveProject,
        openProject: projectCommands.openProject,
        updateProjectAnalysisView,
        updateWorkspace: projectCommands.updateWorkspace
      };
    },
    [
      project,
      projectLocation,
      waveformOverview,
      spectrogramOverview,
      pitchEnergyOverview,
      isImporting,
      isOpeningProject,
      isSavingProject,
      importError,
      runtime,
      audioFacade,
      activeWaveformService,
      activeSpectrogramService,
      activePitchEnergyService
    ]
  );

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}
