import { DEFAULT_USER_SETTINGS } from "../../core/userSettings/types";
import type { UserSettings } from "../../core/userSettings/types";
import type { AppRuntime } from "./types";

const ELECTRON_AUDIO_IMPORT_MESSAGE = "Audio import is available only in the Electron runtime.";
const ELECTRON_PROJECT_OPEN_MESSAGE = "Project open is available only in the Electron runtime.";
const ELECTRON_PROJECT_SAVE_MESSAGE = "Project save is available only in the Electron runtime.";
const ELECTRON_PROJECT_ACTIVATE_MESSAGE = "Project activation is available only in the Electron runtime.";

export function createDevRuntime(): AppRuntime {
  let settings: UserSettings = DEFAULT_USER_SETTINGS;

  return {
    kind: "dev",
    getVersion: async () => "dev",
    log: () => {},
    getUserSettings: async () => settings,
    updateUserSettings: async (patch) => {
      settings = { ...settings, ...patch };
      return settings;
    },
    selectAudioFile: async () => {
      throw new Error(ELECTRON_AUDIO_IMPORT_MESSAGE);
    },
    saveProject: async () => {
      throw new Error(ELECTRON_PROJECT_SAVE_MESSAGE);
    },
    openProject: async () => {
      throw new Error(ELECTRON_PROJECT_OPEN_MESSAGE);
    },
    activateOpenedProject: async () => {
      throw new Error(ELECTRON_PROJECT_ACTIVATE_MESSAGE);
    },
    onMenuCommand: () => () => {}
  };
}
