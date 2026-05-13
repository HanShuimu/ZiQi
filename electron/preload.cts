import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

type MenuCommand = "open-project" | "save-project" | "import-audio";

const api = {
  getVersion: () => ipcRenderer.invoke("app:get-version") as Promise<string>,
  selectAudioFile: () =>
    ipcRenderer.invoke("audio:select-file") as Promise<{
      audioData: ArrayBuffer;
      filePath: string;
    } | null>,
  saveProject: (request: unknown) => ipcRenderer.invoke("project:save", request),
  openProject: () => ipcRenderer.invoke("project:open"),
  activateOpenedProject: (request: unknown) =>
    ipcRenderer.invoke("project:activate-opened", request),
  onMenuCommand: (callback: (command: MenuCommand) => void) => {
    const listener = (_event: IpcRendererEvent, command: MenuCommand) => {
      callback(command);
    };

    ipcRenderer.on("menu:command", listener);
    return () => ipcRenderer.removeListener("menu:command", listener);
  }
};

contextBridge.exposeInMainWorld("ziqiApp", api);
