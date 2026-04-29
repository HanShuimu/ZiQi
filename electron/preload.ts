import { contextBridge, ipcRenderer } from "electron";

const api = {
  getVersion: () => ipcRenderer.invoke("app:get-version") as Promise<string>
};

contextBridge.exposeInMainWorld("ziqiApp", api);

