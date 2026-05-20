import type { WorkspaceState } from "../../core/project/types";
import type { ProjectCommandDependencies } from "./projectCommandTypes";

export function createUpdateWorkspaceCommand({
  setProject
}: ProjectCommandDependencies) {
  return function updateWorkspace(workspacePatch: Partial<WorkspaceState>) {
    setProject((currentProject) => {
      if (!currentProject) {
        return currentProject;
      }

      return {
        ...currentProject,
        workspace: {
          ...currentProject.workspace,
          ...workspacePatch
        }
      };
    });
  };
}
