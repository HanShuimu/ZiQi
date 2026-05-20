import { useMemo } from "react";
import { AppSessionProvider } from "./app/session/AppSessionProvider";
import { useAppSession } from "./app/session/useAppSession";
import { useMenuCommands } from "./app/menu/useMenuCommands";
import { WorkbenchShell } from "./components/WorkbenchShell";
import { getSkinDefinition } from "./skins/registry";
import { UiProvider } from "./ui";
import type { WaveformService } from "./services/audio/browserWaveformService";
import type { SpectrogramService } from "./services/audio/browserSpectrogramService";

interface AppProps {
  waveformService?: WaveformService;
  spectrogramService?: SpectrogramService;
}

export function App({ waveformService, spectrogramService }: AppProps) {
  return (
    <AppSessionProvider waveformService={waveformService} spectrogramService={spectrogramService}>
      <AppContent />
    </AppSessionProvider>
  );
}

function AppContent() {
  const session = useAppSession();
  const skinDefinition = useMemo(
    () => getSkinDefinition(session.uiSkin),
    [session.uiSkin]
  );

  useMenuCommands(session);

  return (
    <UiProvider skinId={skinDefinition.id} adapter={skinDefinition.adapter}>
      <WorkbenchShell
        audioFacade={session.audioFacade}
        importError={session.importError}
        onWorkspaceChange={session.updateWorkspace}
        project={session.project}
        spectrogramOverview={session.spectrogramOverview}
        waveformOverview={session.waveformOverview}
      />
    </UiProvider>
  );
}
