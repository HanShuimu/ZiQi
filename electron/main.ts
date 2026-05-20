import { app, BrowserWindow, Menu, protocol } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApplicationMenuTemplate, type MenuCommand } from "./platform/menu/applicationMenu.js";
import { createUserSettingsStore, type UserSettings } from "./platform/userSettings/userSettings.js";
import { registerAppProtocol } from "./platform/protocol/appProtocol.js";
import { registerAppInfoHandlers } from "./platform/ipc/appInfoHandlers.js";
import { registerSettingsHandlers } from "./platform/ipc/settingsHandlers.js";
import { registerAudioFileHandlers } from "./platform/ipc/audioFileHandlers.js";
import { registerProjectFileHandlers } from "./platform/ipc/projectFileHandlers.js";

protocol.registerSchemesAsPrivileged([
  { scheme: "ziqi", privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererDevUrl = process.env.ZIQI_RENDERER_DEV_URL;
const rendererDistDir = path.join(__dirname, "../dist");

let currentProjectLocation: { projectFilePath: string; projectRootPath: string } | null = null;
const trustedImportedAudioPaths = new Set<string>();
let currentUserSettings: UserSettings = { uiSkin: "default" };
let userSettingsStore: ReturnType<typeof createUserSettingsStore> | null = null;

function createWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 1100, minHeight: 760,
    backgroundColor: "#f3efe8",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (rendererDevUrl) {
    void window.loadURL(rendererDevUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return window;
  }

  void window.loadURL("ziqi://app/index.html");
  return window;
}

function installApplicationMenu() {
  const template = createApplicationMenuTemplate({
    activeSkin: currentUserSettings.uiSkin,
    platform: process.platform,
    dispatch: dispatchMenuCommand
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template as MenuItemConstructorOptions[]));
}

function dispatchMenuCommand(command: MenuCommand) {
  BrowserWindow.getFocusedWindow()?.webContents.send("menu:command", command);
}

function updateCurrentProjectLocation(location: { projectFilePath: string; projectRootPath: string }) {
  currentProjectLocation = {
    projectFilePath: location.projectFilePath,
    projectRootPath: location.projectRootPath
  };
}

app.whenReady().then(async () => {
  userSettingsStore = createUserSettingsStore(app.getPath("userData"));
  currentUserSettings = await userSettingsStore.read();

  registerAppProtocol(rendererDistDir);
  registerAppInfoHandlers();
  registerSettingsHandlers({
    userSettingsStore,
    getCurrentUserSettings: () => currentUserSettings,
    setCurrentUserSettings: (settings) => { currentUserSettings = settings; },
    installApplicationMenu
  });
  registerAudioFileHandlers({ trustedImportedAudioPaths });
  registerProjectFileHandlers({
    getCurrentProjectLocation: () => currentProjectLocation,
    trustedImportedAudioPaths,
    updateCurrentProjectLocation
  });

  installApplicationMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
