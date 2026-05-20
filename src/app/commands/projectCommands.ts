import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { SpectrogramOverview, WaveformOverview } from "../../core/audio/types";
import type { ProjectSummary, WorkspaceState } from "../../core/project/types";
import { createProjectFromAudio } from "../../core/project/createProjectFromAudio";
import { normalizeWorkspaceState } from "../../core/workspace/workspaceState";
import type { SpectrogramService } from "../../services/audio/browserSpectrogramService";
import type { WaveformService } from "../../services/audio/browserWaveformService";
import type { ProjectAudioFacade } from "../../services/projectAudio/interfaces";
import type { ProjectLocation } from "../session/types";

interface ProjectCommandDependencies {
  project: ProjectSummary | null;
  projectLocation: ProjectLocation | null;
  activePlaybackUrl: MutableRefObject<string | null>;
  audioFacade: ProjectAudioFacade;
  waveformService: WaveformService;
  spectrogramService: SpectrogramService;
  setProject: Dispatch<SetStateAction<ProjectSummary | null>>;
  setProjectLocation: Dispatch<SetStateAction<ProjectLocation | null>>;
  setWaveformOverview: Dispatch<SetStateAction<WaveformOverview | null>>;
  setSpectrogramOverview: Dispatch<SetStateAction<SpectrogramOverview | null>>;
  setIsImporting: Dispatch<SetStateAction<boolean>>;
  setIsOpeningProject: Dispatch<SetStateAction<boolean>>;
  setIsSavingProject: Dispatch<SetStateAction<boolean>>;
  setImportError: Dispatch<SetStateAction<string | null>>;
}

export function createProjectCommands(dependencies: ProjectCommandDependencies) {
  return {
    importAudio: () => importAudio(dependencies),
    saveProject: () => saveProject(dependencies),
    openProject: () => openProject(dependencies),
    updateWorkspace: (workspacePatch: Partial<WorkspaceState>) =>
      updateWorkspace(dependencies, workspacePatch)
  };
}

async function importAudio({
  activePlaybackUrl,
  audioFacade,
  waveformService,
  spectrogramService,
  setProject,
  setProjectLocation,
  setWaveformOverview,
  setSpectrogramOverview,
  setIsImporting,
  setImportError
}: ProjectCommandDependencies) {
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
        await waveformService.buildOverviewFromAudioData(selectedFile.audioData);
      const nextSpectrogramOverview =
        await spectrogramService.buildOverviewFromAudioData(spectrogramAudioData);
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

async function saveProject({
  project,
  projectLocation,
  setProject,
  setProjectLocation,
  setIsSavingProject,
  setImportError
}: ProjectCommandDependencies) {
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

async function openProject({
  project,
  activePlaybackUrl,
  audioFacade,
  waveformService,
  spectrogramService,
  setProject,
  setProjectLocation,
  setWaveformOverview,
  setSpectrogramOverview,
  setIsOpeningProject,
  setImportError
}: ProjectCommandDependencies) {
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
        await waveformService.buildOverviewFromAudioData(openedProject.audioData);
      const nextSpectrogramOverview =
        await spectrogramService.buildOverviewFromAudioData(spectrogramAudioData);
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

function updateWorkspace(
  { setProject }: ProjectCommandDependencies,
  workspacePatch: Partial<WorkspaceState>
) {
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
