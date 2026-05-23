import { createProjectFromAudio } from "../../core/project/createProjectFromAudio";
import { normalizeWorkspaceState } from "../../core/workspace/workspaceState";
import type { ProjectCommandDependencies } from "./projectCommandTypes";

export function createImportAudioCommand({
  activePlaybackUrl,
  audioFacade,
  waveformService,
  spectrogramService,
  pitchEnergyService,
  setProject,
  setProjectLocation,
  setWaveformOverview,
  setSpectrogramOverview,
  setPitchEnergyOverview,
  setIsImporting,
  setImportError
}: ProjectCommandDependencies) {
  return async function importAudio() {
    setIsImporting(true);
    setImportError(null);

    try {
      const selectedFile = await window.ziqiApp.selectAudioFile();
      if (!selectedFile) {
        return;
      }

      const nextPlaybackUrl = URL.createObjectURL(new Blob([selectedFile.audioData]));
      const spectrogramAudioData = selectedFile.audioData.slice(0);
      const pitchAudioData = selectedFile.audioData.slice(0);
      try {
        const nextWaveformOverview =
          await waveformService.buildOverviewFromAudioData(selectedFile.audioData);
        const nextSpectrogramOverview =
          await spectrogramService.buildOverviewFromAudioData(spectrogramAudioData);
        const nextPitchEnergyOverview =
          await pitchEnergyService.buildOverviewFromAudioData(pitchAudioData);
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
        setPitchEnergyOverview(nextPitchEnergyOverview);
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
  };
}
