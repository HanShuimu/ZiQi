import { createProjectFromAudio } from "../../core/project/createProjectFromAudio";
import { normalizeWorkspaceState } from "../../core/workspace/workspaceState";
import type { ProjectCommandDependencies } from "./projectCommandTypes";

export function createImportAudioCommand({
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
  setIsImporting,
  setImportError
}: ProjectCommandDependencies) {
  return async function importAudio() {
    const commandStart = performance.now();
    logger.trace("audio.import.start", "Import audio command started");
    setIsImporting(true);
    setImportError(null);

    try {
      const nativeSelectStart = performance.now();
      const selectedFile = await window.ziqiApp.selectAudioFile();
      logger.trace("audio.import.nativeSelect.end", "Native audio selection completed", {
        durationMs: performance.now() - nativeSelectStart,
        canceled: selectedFile === null
      });
      if (!selectedFile) {
        return;
      }

      const nextPlaybackUrl = URL.createObjectURL(new Blob([selectedFile.audioData]));
      logger.trace("audio.import.objectUrl.created", "Created imported audio object URL", {
        byteLength: selectedFile.audioData.byteLength,
        filePath: selectedFile.filePath
      });
      const spectrogramAudioData = selectedFile.audioData.slice(0);
      const pitchAudioData = selectedFile.audioData.slice(0);
      try {
        const waveformStart = performance.now();
        logger.trace("audio.import.waveform.start", "Building imported audio waveform overview");
        const nextWaveformOverview =
          await waveformService.buildOverviewFromAudioData(selectedFile.audioData);
        logger.trace("audio.import.waveform.end", "Built imported audio waveform overview", {
          durationMs: performance.now() - waveformStart,
          pointCount: nextWaveformOverview.points.length
        });
        const spectrogramStart = performance.now();
        logger.trace("audio.import.spectrogram.start", "Building imported audio spectrogram overview");
        const nextSpectrogramOverview =
          await spectrogramService.buildOverviewFromAudioData(spectrogramAudioData);
        logger.trace("audio.import.spectrogram.end", "Built imported audio spectrogram overview", {
          durationMs: performance.now() - spectrogramStart,
          frameCount: nextSpectrogramOverview.frames.length
        });
        const pitchHeatmapStart = performance.now();
        logger.trace("audio.import.pitchHeatmap.start", "Building imported audio pitch heatmap overview");
        const nextPitchEnergyOverview =
          await pitchEnergyService.buildOverviewFromAudioData(pitchAudioData);
        logger.trace("audio.import.pitchHeatmap.end", "Built imported audio pitch heatmap overview", {
          durationMs: performance.now() - pitchHeatmapStart,
          frameCount: nextPitchEnergyOverview.frames.length
        });
        const playbackSourceStart = performance.now();
        logger.trace("audio.import.playbackSource.start", "Loading imported audio playback source");
        const metadata = await audioFacade.source.load(selectedFile.filePath, nextPlaybackUrl);
        logger.trace("audio.import.playbackSource.end", "Loaded imported audio playback source", {
          durationMs: performance.now() - playbackSourceStart,
          filePath: selectedFile.filePath
        });
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
        setPitchEnergyOverview(nextPitchEnergyOverview);
        if (activePlaybackUrl.current) {
          URL.revokeObjectURL(activePlaybackUrl.current);
        }
        activePlaybackUrl.current = nextPlaybackUrl;
        logger.trace("audio.import.stateCommitted", "Committed imported audio project state", {
          projectName: importedProject.name
        });
      } catch (error) {
        URL.revokeObjectURL(nextPlaybackUrl);
        throw error;
      }
    } catch (error) {
      logger.trace("audio.import.fail", "Import audio command failed", {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      setImportError(error instanceof Error ? error.message : "Failed to import audio.");
    } finally {
      setIsImporting(false);
      logger.trace("audio.import.end", "Import audio command completed", {
        durationMs: performance.now() - commandStart
      });
    }
  };
}
