import type { WorkspaceState } from "../../core/project/types";
import { createImportAudioCommand } from "./importAudioCommand";
import { createOpenProjectCommand } from "./openProjectCommand";
import type { ProjectCommandDependencies } from "./projectCommandTypes";
import { createSaveProjectCommand } from "./saveProjectCommand";
import { createUpdateWorkspaceCommand } from "./workspaceCommand";

export function createProjectCommands(dependencies: ProjectCommandDependencies) {
  const importAudio = createImportAudioCommand(dependencies);
  const openProject = createOpenProjectCommand(dependencies);
  const saveProject = createSaveProjectCommand(dependencies);
  const updateWorkspace = createUpdateWorkspaceCommand(dependencies);

  return {
    importAudio,
    saveProject,
    openProject,
    updateWorkspace: (workspacePatch: Partial<WorkspaceState>) =>
      updateWorkspace(workspacePatch)
  };
}
