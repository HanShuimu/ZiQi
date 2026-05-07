import { useMemo, useRef, useState } from "react";
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

export function App({ waveformService }: AppProps) {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [waveformOverview, setWaveformOverview] = useState<WaveformOverview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
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

  async function handleImportAudio() {
    setIsImporting(true);
    setImportError(null);

    try {
      const selectedFile = await window.ziqiApp.selectAudioFile();
      if (!selectedFile) {
        return;
      }

      const nextWaveformOverview =
        await activeWaveformService.buildOverviewFromAudioData(selectedFile.audioData);
      const nextPlaybackUrl = URL.createObjectURL(new Blob([selectedFile.audioData]));
      let metadata;
      try {
        metadata = await audioFacade.source.load(selectedFile.filePath, nextPlaybackUrl);
      } catch (error) {
        URL.revokeObjectURL(nextPlaybackUrl);
        throw error;
      }
      await audioFacade.playback.seek(0);
      setProject(
        createProjectFromAudio({
          filePath: selectedFile.filePath,
          metadata
        })
      );
      setWaveformOverview(nextWaveformOverview);
      if (activePlaybackUrl.current) {
        URL.revokeObjectURL(activePlaybackUrl.current);
      }
      activePlaybackUrl.current = nextPlaybackUrl;
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import audio.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <WorkbenchShell
      audioFacade={audioFacade}
      importError={importError}
      isImporting={isImporting}
      onImportAudio={handleImportAudio}
      project={project}
      waveformOverview={waveformOverview}
    />
  );
}
