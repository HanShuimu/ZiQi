import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ProjectSummary } from "../../core/project/types";
import {
  createBrowserWaveformService,
  type WaveformService
} from "../../services/audio/browserWaveformService";
import {
  createBrowserSpectrogramService,
  type SpectrogramService
} from "../../services/audio/browserSpectrogramService";
import type { SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import { createProjectCommands } from "../commands/projectCommands";
import { createSkinCommands } from "../commands/skinCommands";
import type { SkinId } from "../../core/userSettings/types";
import { DEFAULT_USER_SETTINGS } from "../../core/userSettings/types";
import { createBrowserProjectAudioFacade } from "../../services/projectAudio/browserProjectAudioFacade";
import { AppSessionContext } from "./AppSessionContext";
import type { AppSessionValue, ProjectLocation } from "./types";

interface AppSessionProviderProps {
  children: ReactNode;
  waveformService?: WaveformService;
  spectrogramService?: SpectrogramService;
}

export function AppSessionProvider({
  children,
  waveformService,
  spectrogramService
}: AppSessionProviderProps) {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [projectLocation, setProjectLocation] = useState<ProjectLocation | null>(null);
  const [waveformOverview, setWaveformOverview] = useState<WaveformOverview | null>(null);
  const [spectrogramOverview, setSpectrogramOverview] = useState<SpectrogramOverview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [uiSkin, setUiSkin] = useState<SkinId>(DEFAULT_USER_SETTINGS.uiSkin);
  const activePlaybackUrl = useRef<string | null>(null);
  const audioFacade = useMemo(
    () => createBrowserProjectAudioFacade(new Audio()),
    []
  );
  const activeWaveformService = useMemo(
    () => waveformService ?? createBrowserWaveformService(),
    [waveformService]
  );
  const activeSpectrogramService = useMemo(
    () => spectrogramService ?? createBrowserSpectrogramService(),
    [spectrogramService]
  );

  useEffect(() => {
    const playbackUrlRef = activePlaybackUrl;

    return () => {
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    void window.ziqiApp.getUserSettings().then((settings) => {
      if (isActive) {
        setUiSkin(settings.uiSkin);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  const value = useMemo<AppSessionValue>(
    () => {
      // eslint-disable-next-line react-hooks/refs
      const projectCommands = createProjectCommands({
        project,
        projectLocation,
        activePlaybackUrl,
        audioFacade,
        waveformService: activeWaveformService,
        spectrogramService: activeSpectrogramService,
        setProject,
        setProjectLocation,
        setWaveformOverview,
        setSpectrogramOverview,
        setIsImporting,
        setIsOpeningProject,
        setIsSavingProject,
        setImportError
      });
      const skinCommands = createSkinCommands({ setUiSkin, setImportError });

      return {
        project,
        projectLocation,
        waveformOverview,
        spectrogramOverview,
        isImporting,
        isOpeningProject,
        isSavingProject,
        importError,
        uiSkin,
        audioFacade,
        waveformService: activeWaveformService,
        spectrogramService: activeSpectrogramService,
        importAudio: projectCommands.importAudio,
        saveProject: projectCommands.saveProject,
        openProject: projectCommands.openProject,
        changeSkin: skinCommands.changeSkin,
        updateWorkspace: projectCommands.updateWorkspace
      };
    },
    [
      project,
      projectLocation,
      waveformOverview,
      spectrogramOverview,
      isImporting,
      isOpeningProject,
      isSavingProject,
      importError,
      uiSkin,
      audioFacade,
      activeWaveformService,
      activeSpectrogramService
    ]
  );

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}
