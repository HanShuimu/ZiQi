import type {
  MenuCommand,
  OpenProjectResult,
  ProjectLocation,
  RendererLogEntry,
  SaveProjectRequest,
  SaveProjectResult
} from "../../types/global";
import type { UserSettings } from "../../core/userSettings/types";

export interface AudioFileSelection {
  audioData: ArrayBuffer;
  filePath: string;
}

export interface AppRuntime {
  kind: "electron" | "dev";
  getVersion(): Promise<string>;
  log(entry: RendererLogEntry): void;
  getUserSettings(): Promise<UserSettings>;
  updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings>;
  selectAudioFile(): Promise<AudioFileSelection | null>;
  saveProject(request: SaveProjectRequest): Promise<SaveProjectResult | null>;
  openProject(): Promise<OpenProjectResult | null>;
  activateOpenedProject(request: ProjectLocation): Promise<void>;
  onMenuCommand(callback: (command: MenuCommand) => void): () => void;
}
