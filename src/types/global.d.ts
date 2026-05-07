import type { ProjectSummary } from "../domain/project/types";

export interface ProjectLocation {
  projectFilePath: string;
  projectRootPath: string;
}

export interface SaveProjectRequest extends Partial<ProjectLocation> {
  project: ProjectSummary;
}

export interface SaveProjectResult extends ProjectLocation {
  project: ProjectSummary;
}

export interface OpenProjectResult extends SaveProjectResult {
  audioData: ArrayBuffer;
}

declare global {
  interface Window {
    ziqiApp: {
      getVersion(): Promise<string>;
      selectAudioFile(): Promise<{ audioData: ArrayBuffer; filePath: string } | null>;
      saveProject(request: SaveProjectRequest): Promise<SaveProjectResult | null>;
      openProject(): Promise<OpenProjectResult | null>;
    };
  }
}
