import { ipcMain, dialog } from "electron";
import {
  isSerializableProject,
  openProjectFromFile,
  saveExistingProject,
  saveNewProject
} from "../projectFiles/projectFiles.js";
import type { SerializableProject } from "../projectFiles/projectFiles.js";

interface ProjectLocation {
  projectFilePath: string;
  projectRootPath: string;
}

interface SaveProjectRequest {
  project: SerializableProject;
  projectFilePath?: string;
  projectRootPath?: string;
}

interface ProjectFileHandlerDependencies {
  getCurrentProjectLocation: () => ProjectLocation | null;
  trustedImportedAudioPaths: Set<string>;
  updateCurrentProjectLocation: (location: ProjectLocation) => void;
}

export function registerProjectFileHandlers(dependencies: ProjectFileHandlerDependencies): void {
  let pendingOpenedProjectLocation: ProjectLocation | null = null;

  ipcMain.handle("project:save", async (_event, request) => {
    if (!isSaveProjectRequest(request)) {
      throw new Error("Failed to save project.");
    }

    if (request.projectFilePath && request.projectRootPath) {
      const currentLocation = dependencies.getCurrentProjectLocation();
      if (
        !currentLocation ||
        request.projectFilePath !== currentLocation.projectFilePath ||
        request.projectRootPath !== currentLocation.projectRootPath
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
    if (!dependencies.trustedImportedAudioPaths.has(trustedAudioPath)) {
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
    dependencies.updateCurrentProjectLocation(savedProject);
    dependencies.trustedImportedAudioPaths.delete(trustedAudioPath);
    return savedProject;
  });

  ipcMain.handle("project:open", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "ZiQi Project", extensions: ["ziqi"] }]
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

    dependencies.updateCurrentProjectLocation(request);
    pendingOpenedProjectLocation = null;
  });
}

function isSaveProjectRequest(value: unknown): value is SaveProjectRequest {
  if (!isRecord(value) || !isSerializableProject(value.project)) return false;
  const hasProjectFilePath = "projectFilePath" in value;
  const hasProjectRootPath = "projectRootPath" in value;
  if (hasProjectFilePath !== hasProjectRootPath) return false;
  if (hasProjectFilePath && (typeof value.projectFilePath !== "string" || typeof value.projectRootPath !== "string")) return false;
  return true;
}

function isProjectLocationRequest(value: unknown): value is ProjectLocation {
  return isRecord(value) && typeof value.projectFilePath === "string" && typeof value.projectRootPath === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
