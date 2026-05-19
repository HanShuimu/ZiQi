import { app, BrowserWindow, Menu, dialog, ipcMain, protocol } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isSerializableProject,
  openProjectFromFile,
  saveExistingProject,
  saveNewProject
} from "./projectFiles.js";
import type { SerializableProject } from "./projectFiles.js";
import { createApplicationMenuTemplate, type MenuCommand } from "./appMenu.js";
import { createUserSettingsStore, type UserSettings } from "./userSettings.js";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "ziqi",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rendererDevUrl = process.env.ZIQI_RENDERER_DEV_URL;
const rendererDistDir = path.join(__dirname, "../dist");
let currentProjectLocation: ProjectLocation | null = null;
const trustedImportedAudioPaths = new Set<string>();
let pendingOpenedProjectLocation: ProjectLocation | null = null;
let currentUserSettings: UserSettings = { uiSkin: "default" };
let userSettingsStore: ReturnType<typeof createUserSettingsStore> | null = null;

interface ProjectLocation {
  projectFilePath: string;
  projectRootPath: string;
}

interface SaveProjectRequest {
  project: SerializableProject;
  projectFilePath?: string;
  projectRootPath?: string;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
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

app.whenReady().then(async () => {
  userSettingsStore = createUserSettingsStore(app.getPath("userData"));
  currentUserSettings = await userSettingsStore.read();

  protocol.handle("ziqi", async (request) => {
    const requestUrl = new URL(request.url);
    const requestedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
    const filePath = path.normalize(path.join(rendererDistDir, relativePath));

    if (!filePath.startsWith(rendererDistDir)) {
      return new Response("Not found", { status: 404 });
    }

    try {
      const file = await fs.readFile(filePath);
      return new Response(file, {
        headers: {
          "content-type": getContentType(filePath)
        }
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  ipcMain.handle("app:get-version", () => app.getVersion());
  ipcMain.handle("settings:get-user-settings", async () => currentUserSettings);
  ipcMain.handle("settings:update-user-settings", async (_event, patch) => {
    if (!userSettingsStore || !isUserSettingsPatch(patch)) {
      throw new Error("Failed to update user settings.");
    }

    currentUserSettings = await userSettingsStore.update(patch);
    installApplicationMenu();
    return currentUserSettings;
  });
  ipcMain.handle("audio:select-file", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Audio Files",
          extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus"]
        },
        {
          name: "All Files",
          extensions: ["*"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];

    try {
      const file = await fs.readFile(filePath);
      trustedImportedAudioPaths.add(filePath);
      return {
        audioData: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        filePath
      };
    } catch {
      throw new Error("Failed to load audio file.");
    }
  });

  ipcMain.handle("project:save", async (_event, request) => {
    if (!isSaveProjectRequest(request)) {
      throw new Error("Failed to save project.");
    }

    if (request.projectFilePath && request.projectRootPath) {
      if (
        !currentProjectLocation ||
        request.projectFilePath !== currentProjectLocation.projectFilePath ||
        request.projectRootPath !== currentProjectLocation.projectRootPath
      ) {
        throw new Error("Failed to save project.");
      }

      return saveExistingProject({
        project: request.project,
        projectFilePath: request.projectFilePath,
        projectRootPath: request.projectRootPath
      });
    }

    const trustedAudioPath = request.project.sourceAudio.filePath;

    if (!trustedImportedAudioPaths.has(trustedAudioPath)) {
      throw new Error("Failed to save project.");
    }

    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose Project Parent Folder"
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const savedProject = await saveNewProject({
      parentDirectoryPath: result.filePaths[0],
      project: {
        ...request.project,
        sourceAudio: {
          ...request.project.sourceAudio,
          filePath: trustedAudioPath
        }
      }
    });
    updateCurrentProjectLocation(savedProject);
    trustedImportedAudioPaths.delete(trustedAudioPath);
    return savedProject;
  });

  ipcMain.handle("project:open", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "ZiQi Project",
          extensions: ["ziqi"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const openedProject = await openProjectFromFile(result.filePaths[0]);
    pendingOpenedProjectLocation = {
      projectFilePath: openedProject.projectFilePath,
      projectRootPath: openedProject.projectRootPath
    };
    return openedProject;
  });

  ipcMain.handle("project:activate-opened", async (_event, request) => {
    if (
      !isProjectLocationRequest(request) ||
      !pendingOpenedProjectLocation ||
      request.projectFilePath !== pendingOpenedProjectLocation.projectFilePath ||
      request.projectRootPath !== pendingOpenedProjectLocation.projectRootPath
    ) {
      throw new Error("Failed to open project.");
    }

    updateCurrentProjectLocation(request);
    pendingOpenedProjectLocation = null;
  });

  installApplicationMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function getContentType(filePath: string) {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function updateCurrentProjectLocation(result: ProjectLocation) {
  currentProjectLocation = {
    projectFilePath: result.projectFilePath,
    projectRootPath: result.projectRootPath
  };
}

function isSaveProjectRequest(value: unknown): value is SaveProjectRequest {
  if (!isRecord(value) || !isSerializableProject(value.project)) {
    return false;
  }

  const hasProjectFilePath = "projectFilePath" in value;
  const hasProjectRootPath = "projectRootPath" in value;

  if (hasProjectFilePath !== hasProjectRootPath) {
    return false;
  }

  if (
    hasProjectFilePath &&
    (typeof value.projectFilePath !== "string" || typeof value.projectRootPath !== "string")
  ) {
    return false;
  }

  return true;
}

function isProjectLocationRequest(value: unknown): value is ProjectLocation {
  return (
    isRecord(value) &&
    typeof value.projectFilePath === "string" &&
    typeof value.projectRootPath === "string"
  );
}

function isUserSettingsPatch(value: unknown): value is Partial<UserSettings> {
  if (!isRecord(value)) {
    return false;
  }

  if (!("uiSkin" in value)) {
    return true;
  }

  return value.uiSkin === "default" || value.uiSkin === "animal-island";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
