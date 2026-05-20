import type { ProjectCommandDependencies } from "./projectCommandTypes";

export function createSaveProjectCommand({
  project,
  projectLocation,
  setProject,
  setProjectLocation,
  setIsSavingProject,
  setImportError
}: ProjectCommandDependencies) {
  return async function saveProject() {
    if (!project) {
      return;
    }

    setIsSavingProject(true);
    setImportError(null);

    try {
      const savedProject = await window.ziqiApp.saveProject({
        project,
        ...(projectLocation ?? {})
      });
      if (!savedProject) {
        return;
      }

      setProject(savedProject.project);
      setProjectLocation({
        projectFilePath: savedProject.projectFilePath,
        projectRootPath: savedProject.projectRootPath
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to save project.");
    } finally {
      setIsSavingProject(false);
    }
  };
}
