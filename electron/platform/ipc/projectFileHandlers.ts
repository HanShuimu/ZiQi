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

interface ProjectFileHandlerLogger {
  trace(event: string, message: string, details?: ProjectFileHandlerLogDetails): void;
}

type ProjectFileHandlerLogDetails = Record<string, string | number | boolean | null | undefined>;

interface SaveProjectRequest {
  project: SerializableProject;
  projectFilePath?: string;
  projectRootPath?: string;
}

interface ProjectFileHandlerDependencies {
  getCurrentProjectLocation: () => ProjectLocation | null;
  logger: ProjectFileHandlerLogger;
  trustedImportedAudioPaths: Set<string>;
  updateCurrentProjectLocation: (location: ProjectLocation) => void;
}

export function registerProjectFileHandlers(dependencies: ProjectFileHandlerDependencies): void {
  let pendingOpenedProjectLocation: ProjectLocation | null = null;

  ipcMain.handle("project:save", async (_event, request) => {
    dependencies.logger.trace("ipc.project.save.start", "Project save IPC started", getSaveRequestLogDetails(request));

    try {
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

        const savedProject = await saveExistingProject({
          project: request.project,
          projectFilePath: request.projectFilePath,
          projectRootPath: request.projectRootPath
        }, { logger: dependencies.logger });
        dependencies.logger.trace("ipc.project.save.end", "Project save IPC completed", {
          projectFilePath: savedProject.projectFilePath,
          projectRootPath: savedProject.projectRootPath
        });
        return savedProject;
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
        dependencies.logger.trace("ipc.project.save.cancel", "Project save IPC canceled");
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
      }, { logger: dependencies.logger });
      dependencies.updateCurrentProjectLocation(savedProject);
      dependencies.trustedImportedAudioPaths.delete(trustedAudioPath);
      dependencies.logger.trace("ipc.project.save.end", "Project save IPC completed", {
        projectFilePath: savedProject.projectFilePath,
        projectRootPath: savedProject.projectRootPath
      });
      return savedProject;
    } catch (error) {
      dependencies.logger.trace("ipc.project.save.fail", "Project save IPC failed", {
        ...getSaveRequestLogDetails(request),
        errorMessage: getErrorMessage(error)
      });
      throw error;
    }
  });

  ipcMain.handle("project:open", async () => {
    dependencies.logger.trace("ipc.project.open.start", "Project open IPC started");

    try {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "ZiQi Project", extensions: ["ziqi"] }]
      });

      if (result.canceled || result.filePaths.length === 0) {
        dependencies.logger.trace("ipc.project.open.cancel", "Project open IPC canceled");
        return null;
      }

      const projectFilePath = result.filePaths[0];
      dependencies.logger.trace("ipc.project.open.selected", "Project file selected", {
        projectFilePath
      });
      const openedProject = await openProjectFromFile(projectFilePath, { logger: dependencies.logger });
      pendingOpenedProjectLocation = {
        projectFilePath: openedProject.projectFilePath,
        projectRootPath: openedProject.projectRootPath
      };
      dependencies.logger.trace("ipc.project.open.end", "Project open IPC completed", {
        projectFilePath: openedProject.projectFilePath,
        projectRootPath: openedProject.projectRootPath
      });
      return openedProject;
    } catch (error) {
      dependencies.logger.trace("ipc.project.open.fail", "Project open IPC failed", {
        errorMessage: getErrorMessage(error)
      });
      throw error;
    }
  });

  ipcMain.handle("project:activate-opened", async (_event, request) => {
    dependencies.logger.trace(
      "ipc.project.activateOpened.start",
      "Project activate opened IPC started",
      getProjectLocationLogDetails(request)
    );

    try {
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
      dependencies.logger.trace(
        "ipc.project.activateOpened.end",
        "Project activate opened IPC completed",
        {
          projectFilePath: request.projectFilePath,
          projectRootPath: request.projectRootPath
        }
      );
    } catch (error) {
      dependencies.logger.trace(
        "ipc.project.activateOpened.fail",
        "Project activate opened IPC failed",
        {
          ...getProjectLocationLogDetails(request),
          errorMessage: getErrorMessage(error)
        }
      );
      throw error;
    }
  });
}

function getSaveRequestLogDetails(request: unknown): ProjectFileHandlerLogDetails {
  if (!isRecord(request)) return {};
  return {
    projectFilePath: typeof request.projectFilePath === "string" ? request.projectFilePath : undefined,
    projectRootPath: typeof request.projectRootPath === "string" ? request.projectRootPath : undefined
  };
}

function getProjectLocationLogDetails(request: unknown): ProjectFileHandlerLogDetails {
  if (!isRecord(request)) return {};
  return {
    projectFilePath: typeof request.projectFilePath === "string" ? request.projectFilePath : undefined,
    projectRootPath: typeof request.projectRootPath === "string" ? request.projectRootPath : undefined
  };
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
