import type { ProjectCommandDependencies } from "./projectCommandTypes";

export function createSaveProjectCommand({
  runtime,
  project,
  projectLocation,
  logger,
  setProject,
  setProjectLocation,
  setIsSavingProject,
  setImportError
}: ProjectCommandDependencies) {
  return async function saveProject() {
    if (!project) {
      logger.trace("project.save.skipNoProject", "Save project skipped because no project is loaded");
      return;
    }

    const commandStart = performance.now();
    let outcome: "success" | "canceled" | "failed" = "failed";
    logger.trace("project.save.start", "Save project command started", {
      hasProjectLocation: projectLocation !== null
    });
    setIsSavingProject(true);
    setImportError(null);

    try {
      const nativeStart = performance.now();
      const savedProject = await runtime.saveProject({
        project,
        ...(projectLocation ?? {})
      });
      logger.trace("project.save.native.end", "Native save project completed", {
        durationMs: performance.now() - nativeStart,
        canceled: savedProject === null
      });
      if (!savedProject) {
        logger.trace("project.save.cancel", "Save project command canceled");
        outcome = "canceled";
        return;
      }

      setProject(savedProject.project);
      setProjectLocation({
        projectFilePath: savedProject.projectFilePath,
        projectRootPath: savedProject.projectRootPath
      });
      logger.trace("project.save.stateCommitted", "Committed saved project state", {
        projectName: savedProject.project.name,
        projectFilePath: savedProject.projectFilePath,
        projectRootPath: savedProject.projectRootPath
      });
      outcome = "success";
    } catch (error) {
      if (outcome !== "failed") {
        outcome = "failed";
      }
      logger.trace("project.save.fail", "Save project command failed", {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      setImportError(error instanceof Error ? error.message : "Failed to save project.");
    } finally {
      setIsSavingProject(false);
      logger.trace("project.save.end", "Save project command finished", {
        durationMs: performance.now() - commandStart,
        outcome
      });
    }
  };
}
