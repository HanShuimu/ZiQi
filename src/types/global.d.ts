import type { ProjectSummary } from "../core/project/types";
import type { UserSettings } from "../core/userSettings/types";

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

export type MenuCommand =
  | "open-project"
  | "save-project"
  | "import-audio"
  | "set-skin-default"
  | "set-skin-animal-island";

declare global {
  interface Window {
    ziqiApp: {
      getVersion(): Promise<string>;
      getUserSettings(): Promise<UserSettings>;
      updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings>;
      selectAudioFile(): Promise<{ audioData: ArrayBuffer; filePath: string } | null>;
      saveProject(request: SaveProjectRequest): Promise<SaveProjectResult | null>;
      openProject(): Promise<OpenProjectResult | null>;
      activateOpenedProject(request: ProjectLocation): Promise<void>;
      onMenuCommand(callback: (command: MenuCommand) => void): () => void;
    };
  }
}
