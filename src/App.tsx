import { useMemo } from "react";
import { AppSessionProvider } from "./app/session/AppSessionProvider";
import { useAppSession } from "./app/session/useAppSession";
import { useMenuCommands } from "./app/menu/useMenuCommands";
import { WorkbenchShell } from "./components/WorkbenchShell";
import { getSkinDefinition } from "./skins/registry";
import { UiProvider } from "./ui";
import type { WaveformService } from "./services/audio/browserWaveformService";
import type { SpectrogramService } from "./services/audio/browserSpectrogramService";
import type { PitchEnergyService } from "./services/audio/browserPitchEnergyService";

interface AppProps {
  waveformService?: WaveformService;
  spectrogramService?: SpectrogramService;
  pitchEnergyService?: PitchEnergyService;
}

export function App({ waveformService, spectrogramService, pitchEnergyService }: AppProps) {
  return (
    <AppSessionProvider
      waveformService={waveformService}
      spectrogramService={spectrogramService}
      pitchEnergyService={pitchEnergyService}
    >
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
        pitchEnergyOverview={session.pitchEnergyOverview}
        spectrogramOverview={session.spectrogramOverview}
        waveformOverview={session.waveformOverview}
      />
    </UiProvider>
  );
}
