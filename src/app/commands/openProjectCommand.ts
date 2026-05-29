import { normalizeWorkspaceState } from "../../core/workspace/workspaceState";
import { normalizeProjectAnalysisView } from "../../core/project/analysisView";
import type { ProjectCommandDependencies } from "./projectCommandTypes";

export function createOpenProjectCommand({
  project,
  activePlaybackUrl,
  audioFacade,
  waveformService,
  spectrogramService,
  pitchEnergyService,
  logger,
  setProject,
  setProjectLocation,
  setWaveformOverview,
  setSpectrogramOverview,
  setPitchEnergyOverview,
  setIsOpeningProject,
  setImportError
}: ProjectCommandDependencies) {
  return async function openProject() {
    const commandStart = performance.now();
    let outcome: "success" | "canceled" | "failed" = "failed";
    logger.trace("project.open.start", "Open project command started", {
      hadExistingProject: project !== null
    });
    setIsOpeningProject(true);
    setImportError(null);

    try {
      const nativeStart = performance.now();
      const openedProject = await window.ziqiApp.openProject();
      logger.trace("project.open.native.end", "Native open project completed", {
        durationMs: performance.now() - nativeStart,
        canceled: openedProject === null
      });
      if (!openedProject) {
        outcome = "canceled";
        return;
      }

      const previousPlaybackUrl = activePlaybackUrl.current;
      const nextPlaybackUrl = URL.createObjectURL(new Blob([openedProject.audioData]));
      logger.trace("project.open.objectUrl.created", "Created project playback object URL", {
        byteLength: openedProject.audioData.byteLength
      });
      const spectrogramAudioData = openedProject.audioData.slice(0);
      const pitchAudioData = openedProject.audioData.slice(0);
      try {
        const waveformStart = performance.now();
        logger.trace("project.open.waveform.start", "Building project waveform overview");
        const nextWaveformOverview =
          await waveformService.buildOverviewFromAudioData(openedProject.audioData);
        logger.trace("project.open.waveform.end", "Built project waveform overview", {
          durationMs: performance.now() - waveformStart,
          pointCount: nextWaveformOverview.points.length
        });
        const spectrogramStart = performance.now();
        logger.trace("project.open.spectrogram.start", "Building project spectrogram overview");
        const nextSpectrogramOverview =
          await spectrogramService.buildOverviewFromAudioData(spectrogramAudioData);
        logger.trace("project.open.spectrogram.end", "Built project spectrogram overview", {
          durationMs: performance.now() - spectrogramStart,
          frameCount: nextSpectrogramOverview.frames.length
        });
        const pitchHeatmapStart = performance.now();
        logger.trace("project.open.pitchHeatmap.start", "Building project pitch heatmap overview");
        const nextPitchEnergyOverview =
          await pitchEnergyService.buildOverviewFromAudioData(pitchAudioData);
        logger.trace("project.open.pitchHeatmap.end", "Built project pitch heatmap overview", {
          durationMs: performance.now() - pitchHeatmapStart,
          frameCount: nextPitchEnergyOverview.frames.length
        });
        const playbackSourceStart = performance.now();
        logger.trace("project.open.playbackSource.start", "Loading project playback source");
        await audioFacade.source.load(openedProject.project.sourceAudio.filePath, nextPlaybackUrl);
        logger.trace("project.open.playbackSource.end", "Loaded project playback source", {
          durationMs: performance.now() - playbackSourceStart,
          filePath: openedProject.project.sourceAudio.filePath
        });
        const normalizedProject = {
          ...openedProject.project,
          analysisView: normalizeProjectAnalysisView(openedProject.project.analysisView),
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
        logger.trace("project.open.playbackState.end", "Applied project playback state");
        await window.ziqiApp.activateOpenedProject({
          projectFilePath: openedProject.projectFilePath,
          projectRootPath: openedProject.projectRootPath
        });
        logger.trace("project.open.activate.end", "Activated opened project", {
          projectFilePath: openedProject.projectFilePath,
          projectRootPath: openedProject.projectRootPath
        });
        setProject(normalizedProject);
        setWaveformOverview(nextWaveformOverview);
        setSpectrogramOverview(nextSpectrogramOverview);
        setPitchEnergyOverview(nextPitchEnergyOverview);
        setProjectLocation({
          projectFilePath: openedProject.projectFilePath,
          projectRootPath: openedProject.projectRootPath
        });
        if (activePlaybackUrl.current) {
          URL.revokeObjectURL(activePlaybackUrl.current);
        }
        activePlaybackUrl.current = nextPlaybackUrl;
        logger.trace("project.open.stateCommitted", "Committed opened project state", {
          projectName: normalizedProject.name
        });
        outcome = "success";
      } catch (error) {
        URL.revokeObjectURL(nextPlaybackUrl);
        try {
          logger.trace("project.open.rollback.start", "Restoring previous project playback");
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
          logger.trace("project.open.rollback.end", "Restored previous project playback");
        } catch {
          // Keep the original open failure as the user-facing error.
        }
        throw error;
      }
    } catch (error) {
      if (outcome !== "failed") {
        outcome = "failed";
      }
      logger.trace("project.open.fail", "Open project command failed", {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      setImportError(error instanceof Error ? error.message : "Failed to open project.");
    } finally {
      setIsOpeningProject(false);
      logger.trace("project.open.end", "Open project command finished", {
        durationMs: performance.now() - commandStart,
        outcome
      });
    }
  };
}
