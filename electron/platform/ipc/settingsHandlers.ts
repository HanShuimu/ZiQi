import { ipcMain } from "electron";
import type { UserSettings } from "../userSettings/userSettings.js";

interface SettingsHandlerDependencies {
  userSettingsStore: {
    read(): Promise<UserSettings>;
    update(patch: Partial<UserSettings>): Promise<UserSettings>;
  } | null;
  getCurrentUserSettings: () => UserSettings;
  setCurrentUserSettings: (settings: UserSettings) => void;
  installApplicationMenu: () => void;
}

export function registerSettingsHandlers(dependencies: SettingsHandlerDependencies): void {
  ipcMain.handle("settings:get-user-settings", async () => dependencies.getCurrentUserSettings());

  ipcMain.handle("settings:update-user-settings", async (_event, patch) => {
    if (!dependencies.userSettingsStore || !isUserSettingsPatch(patch)) {
      throw new Error("Failed to update user settings.");
    }
    const updated = await dependencies.userSettingsStore.update(patch);
    dependencies.setCurrentUserSettings(updated);
    dependencies.installApplicationMenu();
    return updated;
  });
}

function isUserSettingsPatch(value: unknown): value is Partial<UserSettings> {
  if (!isRecord(value)) return false;
  if (!("uiSkin" in value)) return true;
  return value.uiSkin === "default" || value.uiSkin === "animal-island";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
