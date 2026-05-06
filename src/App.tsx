import { useMemo, useState } from "react";
import { WorkbenchShell } from "./components/WorkbenchShell";
import { createBrowserProjectAudioFacade } from "./domain/audio/browserProjectAudioFacade";
import type { ProjectSummary } from "./domain/project/types";
import { createProjectFromAudio } from "./domain/project/createProjectFromAudio";

export function App() {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const audioFacade = useMemo(
    () => createBrowserProjectAudioFacade(new Audio()),
    []
  );

  async function handleImportAudio() {
    setIsImporting(true);
    setImportError(null);

    try {
      const selectedFile = await window.ziqiApp.selectAudioFile();
      if (!selectedFile) {
        return;
      }

      const metadata = await audioFacade.source.load(selectedFile.filePath);
      await audioFacade.playback.seek(0);
      setProject(
        createProjectFromAudio({
          filePath: selectedFile.filePath,
          metadata
        })
      );
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
    />
  );
}
