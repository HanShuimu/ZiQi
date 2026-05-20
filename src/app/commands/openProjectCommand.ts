import { normalizeWorkspaceState } from "../../core/workspace/workspaceState";
import type { ProjectCommandDependencies } from "./projectCommandTypes";

export function createOpenProjectCommand({
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
  return async function openProject() {
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
  };
}
