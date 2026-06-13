import { useMemo } from "react";
import { RuntimeProvider, useAppRuntime } from "./app/runtime";
import { AppSessionProvider } from "./app/session/AppSessionProvider";
import { useAppSession } from "./app/session/useAppSession";
import { UiSettingsProvider, useUiSettings } from "./app/uiSettings";
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
    <RuntimeProvider>
      <UiSettingsProvider>
        <AppSessionProvider
          waveformService={waveformService}
          spectrogramService={spectrogramService}
          pitchEnergyService={pitchEnergyService}
        >
          <AppContent />
        </AppSessionProvider>
      </UiSettingsProvider>
    </RuntimeProvider>
  );
}

function AppContent() {
  const runtime = useAppRuntime();
  const session = useAppSession();
  const uiSettings = useUiSettings();
  const skinDefinition = useMemo(
    () => getSkinDefinition(uiSettings.uiSkin),
    [uiSettings.uiSkin]
  );

  useMenuCommands({
    runtime,
    importAudio: session.importAudio,
    openProject: session.openProject,
    saveProject: session.saveProject,
    changeSkin: uiSettings.changeSkin
  });

  return (
    <UiProvider skinId={skinDefinition.id} adapter={skinDefinition.adapter}>
      <WorkbenchShell
        audioFacade={session.audioFacade}
        importError={session.importError}
        onProjectAnalysisViewChange={session.updateProjectAnalysisView}
        onWorkspaceChange={session.updateWorkspace}
        project={session.project}
        pitchEnergyOverview={session.pitchEnergyOverview}
        spectrogramOverview={session.spectrogramOverview}
        waveformOverview={session.waveformOverview}
      />
    </UiProvider>
  );
}
