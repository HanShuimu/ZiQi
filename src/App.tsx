import { useEffect, useMemo, useRef, useState } from "react";
import { WorkbenchShell } from "./components/WorkbenchShell";
import { createBrowserProjectAudioFacade } from "./domain/audio/browserProjectAudioFacade";
import type { ProjectSummary } from "./domain/project/types";
import { createProjectFromAudio } from "./domain/project/createProjectFromAudio";
import {
  createBrowserWaveformService,
  type WaveformService
} from "./domain/audio/browserWaveformService";
import type { WaveformOverview } from "./domain/audio/types";

interface AppProps {
  waveformService?: WaveformService;
}

interface ProjectLocation {
  projectFilePath: string;
  projectRootPath: string;
}

export function App({ waveformService }: AppProps) {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [projectLocation, setProjectLocation] = useState<ProjectLocation | null>(null);
  const [waveformOverview, setWaveformOverview] = useState<WaveformOverview | null>(null);
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
    () => waveformService ?? createBrowserWaveformService(),
    [waveformService]
  );

  useEffect(() => {
    return () => {
      if (activePlaybackUrl.current) {
        URL.revokeObjectURL(activePlaybackUrl.current);
      }
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
      try {
        const nextWaveformOverview =
          await activeWaveformService.buildOverviewFromAudioData(selectedFile.audioData);
        const metadata = await audioFacade.source.load(selectedFile.filePath, nextPlaybackUrl);
        await audioFacade.playback.seek(0);
        setProject(
          createProjectFromAudio({
            filePath: selectedFile.filePath,
            metadata
          })
        );
        setProjectLocation(null);
        setWaveformOverview(nextWaveformOverview);
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
      try {
        const nextWaveformOverview =
          await activeWaveformService.buildOverviewFromAudioData(openedProject.audioData);
        await audioFacade.source.load(openedProject.project.sourceAudio.filePath, nextPlaybackUrl);
        await audioFacade.playback.seek(0);
        await window.ziqiApp.activateOpenedProject({
          projectFilePath: openedProject.projectFilePath,
          projectRootPath: openedProject.projectRootPath
        });
        setProject(openedProject.project);
        setWaveformOverview(nextWaveformOverview);
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

  return (
    <WorkbenchShell
      audioFacade={audioFacade}
      importError={importError}
      isImporting={isImporting}
      isOpeningProject={isOpeningProject}
      isSavingProject={isSavingProject}
      onImportAudio={handleImportAudio}
      onOpenProject={handleOpenProject}
      onSaveProject={handleSaveProject}
      project={project}
      waveformOverview={waveformOverview}
    />
  );
}
