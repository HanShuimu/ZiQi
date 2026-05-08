import { contextBridge, ipcRenderer } from "electron";

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
    ipcRenderer.invoke("project:activate-opened", request)
};

contextBridge.exposeInMainWorld("ziqiApp", api);
