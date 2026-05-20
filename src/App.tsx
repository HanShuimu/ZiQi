import { useEffect, useMemo, useRef, useState } from "react";
import { WorkbenchShell } from "./components/WorkbenchShell";
import { createBrowserProjectAudioFacade } from "./services/projectAudio/browserProjectAudioFacade";
import type { ProjectSummary, WorkspaceState } from "./core/project/types";
import { createProjectFromAudio } from "./core/project/createProjectFromAudio";
import { normalizeWorkspaceState } from "./core/workspace/workspaceState";
import {
  createBrowserWaveformService,
  type WaveformService
} from "./services/audio/browserWaveformService";
import {
  createBrowserSpectrogramService,
  type SpectrogramService
} from "./services/audio/browserSpectrogramService";
import type { SpectrogramOverview, WaveformOverview } from "./core/audio/types";
import type { SkinId } from "./core/userSettings/types";
import { DEFAULT_USER_SETTINGS } from "./core/userSettings/types";
import { getSkinDefinition } from "./skins/registry";
import { UiProvider } from "./ui";

interface AppProps {
  waveformService?: WaveformService;
  spectrogramService?: SpectrogramService;
}

interface ProjectLocation {
  projectFilePath: string;
  projectRootPath: string;
}

export function App({ waveformService, spectrogramService }: AppProps) {
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

  const skinDefinition = getSkinDefinition(uiSkin);

  useEffect(() => {
    return () => {
      if (activePlaybackUrl.current) {
        URL.revokeObjectURL(activePlaybackUrl.current);
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

  async function handleImportAudio() {
    setIsImporting(true);
    setImportError(null);

    try {
      const selectedFile = await window.ziqiApp.selectAudioFile();
      if (!selectedFile) {
        return;
      }

      const nextPlaybackUrl = URL.createObjectURL(new Blob([selectedFile.audioData]));
      const spectrogramAudioData = selectedFile.audioData.slice(0);
      try {
        const nextWaveformOverview =
          await activeWaveformService.buildOverviewFromAudioData(selectedFile.audioData);
        const nextSpectrogramOverview =
          await activeSpectrogramService.buildOverviewFromAudioData(spectrogramAudioData);
        const metadata = await audioFacade.source.load(selectedFile.filePath, nextPlaybackUrl);
        const importedProject = createProjectFromAudio({
          filePath: selectedFile.filePath,
          metadata
        });
        setProject({
          ...importedProject,
          workspace: normalizeWorkspaceState(importedProject.workspace, metadata.durationMs)
        });
        await audioFacade.playback.setPlaybackRate(1);
        await audioFacade.playback.clearLoopRange();
        await audioFacade.playback.seek(0);
        setProjectLocation(null);
        setWaveformOverview(nextWaveformOverview);
        setSpectrogramOverview(nextSpectrogramOverview);
        if (activePlaybackUrl.current) {
          URL.revokeObjectURL(activePlaybackUrl.current);
        }
        activePlaybackUrl.current = nextPlaybackUrl;
      } catch (error) {
        URL.revokeObjectURL(nextPlaybackUrl);
        throw error;
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import audio.");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSaveProject() {
    if (!project) {
      return;
    }

    setIsSavingProject(true);
    setImportError(null);

    try {
      const savedProject = await window.ziqiApp.saveProject({
        project,
        ...(projectLocation ?? {})
      });
      if (!savedProject) {
        return;
      }

      setProject(savedProject.project);
      setProjectLocation({
        projectFilePath: savedProject.projectFilePath,
        projectRootPath: savedProject.projectRootPath
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to save project.");
    } finally {
      setIsSavingProject(false);
    }
  }

  async function handleOpenProject() {
    setIsOpeningProject(true);
    setImportError(null);

    try {
      const openedProject = await window.ziqiApp.openProject();
      if (!openedProject) {
        return;
      }

      const previousPlaybackUrl = activePlaybackUrl.current;
      const nextPlaybackUrl = URL.createObjectURL(new Blob([openedProject.audioData]));
      const spectrogramAudioData = openedProject.audioData.slice(0);
      try {
        const nextWaveformOverview =
          await activeWaveformService.buildOverviewFromAudioData(openedProject.audioData);
        const nextSpectrogramOverview =
          await activeSpectrogramService.buildOverviewFromAudioData(spectrogramAudioData);
        await audioFacade.source.load(openedProject.project.sourceAudio.filePath, nextPlaybackUrl);
        const normalizedProject = {
          ...openedProject.project,
          workspace: normalizeWorkspaceState(
            openedProject.project.workspace,
            openedProject.project.sourceAudio.durationMs
          )
        };
        await audioFacade.playback.setPlaybackRate(normalizedProject.workspace.playbackRate);
        if (normalizedProject.workspace.loopRange) {
          await audioFacade.playback.setLoopRange(
            normalizedProject.workspace.loopRange.startMs,
            normalizedProject.workspace.loopRange.endMs
          );
        } else {
          await audioFacade.playback.clearLoopRange();
        }
        await audioFacade.playback.seek(0);
        await window.ziqiApp.activateOpenedProject({
          projectFilePath: openedProject.projectFilePath,
          projectRootPath: openedProject.projectRootPath
        });
        setProject(normalizedProject);
        setWaveformOverview(nextWaveformOverview);
        setSpectrogramOverview(nextSpectrogramOverview);
        setProjectLocation({
          projectFilePath: openedProject.projectFilePath,
          projectRootPath: openedProject.projectRootPath
        });
        if (activePlaybackUrl.current) {
          URL.revokeObjectURL(activePlaybackUrl.current);
        }
        activePlaybackUrl.current = nextPlaybackUrl;
      } catch (error) {
        URL.revokeObjectURL(nextPlaybackUrl);
        try {
          if (previousPlaybackUrl && project) {
            await audioFacade.source.load(project.sourceAudio.filePath, previousPlaybackUrl);
            await audioFacade.playback.setPlaybackRate(project.workspace.playbackRate);
            if (project.workspace.loopRange) {
              await audioFacade.playback.setLoopRange(
                project.workspace.loopRange.startMs,
                project.workspace.loopRange.endMs
              );
            } else {
              await audioFacade.playback.clearLoopRange();
            }
          } else {
            await audioFacade.source.unload();
          }
        } catch {
          // Keep the original open failure as the user-facing error.
        }
        throw error;
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to open project.");
    } finally {
      setIsOpeningProject(false);
    }
  }

  async function handleSkinChange(nextSkin: SkinId) {
    setUiSkin(nextSkin);
    try {
      const savedSettings = await window.ziqiApp.updateUserSettings({ uiSkin: nextSkin });
      setUiSkin(savedSettings.uiSkin);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to update user settings.");
    }
  }

  useEffect(() => {
    if (typeof window.ziqiApp.onMenuCommand !== "function") {
      return;
    }

    return window.ziqiApp.onMenuCommand((command) => {
      if (command === "import-audio") {
        void handleImportAudio();
        return;
      }

      if (command === "open-project") {
        void handleOpenProject();
        return;
      }

      if (command === "save-project") {
        void handleSaveProject();
        return;
      }

      if (command === "set-skin-default") {
        void handleSkinChange("default");
        return;
      }

      if (command === "set-skin-animal-island") {
        void handleSkinChange("animal-island");
        return;
      }
    });
  }, [project, projectLocation, activeWaveformService, activeSpectrogramService, audioFacade]);

  function handleWorkspaceChange(workspacePatch: Partial<WorkspaceState>) {
    setProject((currentProject) => {
      if (!currentProject) {
        return currentProject;
      }

      return {
        ...currentProject,
        workspace: {
          ...currentProject.workspace,
          ...workspacePatch
        }
      };
    });
  }

  return (
    <UiProvider skinId={skinDefinition.id} adapter={skinDefinition.adapter}>
      <WorkbenchShell
        audioFacade={audioFacade}
        importError={importError}
        onWorkspaceChange={handleWorkspaceChange}
        project={project}
        spectrogramOverview={spectrogramOverview}
        waveformOverview={waveformOverview}
      />
    </UiProvider>
  );
}
