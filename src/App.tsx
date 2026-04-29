import { useEffect, useMemo } from "react";
import { WorkbenchShell } from "./components/WorkbenchShell";
import { createBrowserProjectAudioFacade } from "./domain/audio/browserProjectAudioFacade";
import { createMockProjectSummary } from "./domain/project/mockProject";

const project = createMockProjectSummary();

export function App() {
  const audioFacade = useMemo(
    () => createBrowserProjectAudioFacade(new Audio()),
    []
  );

  useEffect(() => {
    void audioFacade.source.load(project.sourceAudio.filePath).catch(() => undefined);
  }, [audioFacade]);

  return <WorkbenchShell audioFacade={audioFacade} project={project} />;
}
