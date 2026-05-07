import { contextBridge, ipcRenderer } from "electron";

const api = {
  getVersion: () => ipcRenderer.invoke("app:get-version") as Promise<string>,
  selectAudioFile: () =>
    ipcRenderer.invoke("audio:select-file") as Promise<{
      audioData: ArrayBuffer;
      filePath: string;
    } | null>
};

contextBridge.exposeInMainWorld("ziqiApp", api);
