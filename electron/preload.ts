import { contextBridge, ipcRenderer } from "electron";

const api = {
  getVersion: () => ipcRenderer.invoke("app:get-version") as Promise<string>,
  readAudioFile: (filePath: string) =>
    ipcRenderer.invoke("audio:read-file", filePath) as Promise<ArrayBuffer>,
  selectAudioFile: () =>
    ipcRenderer.invoke("audio:select-file") as Promise<{ filePath: string } | null>
};

contextBridge.exposeInMainWorld("ziqiApp", api);
