import type { ZiqiPreloadApi } from "../../types/global";
import type { AppRuntime } from "./types";

export function createElectronRuntime(ziqiApp: ZiqiPreloadApi): AppRuntime {
  return {
    kind: "electron",
    getVersion: () => ziqiApp.getVersion(),
    log: (entry) => ziqiApp.log(entry),
    getUserSettings: () => ziqiApp.getUserSettings(),
    updateUserSettings: (patch) => ziqiApp.updateUserSettings(patch),
    selectAudioFile: () => ziqiApp.selectAudioFile(),
    saveProject: (request) => ziqiApp.saveProject(request),
    openProject: () => ziqiApp.openProject(),
    activateOpenedProject: (request) => ziqiApp.activateOpenedProject(request),
    onMenuCommand: (callback) => ziqiApp.onMenuCommand(callback)
  };
}
