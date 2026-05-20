import { ipcMain, app } from "electron";

export function registerAppInfoHandlers(): void {
  ipcMain.handle("app:get-version", () => app.getVersion());
}
