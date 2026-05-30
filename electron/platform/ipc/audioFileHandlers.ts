import { ipcMain, dialog } from "electron";
import fs from "node:fs/promises";

interface AudioFileHandlerLogger {
  trace(event: string, message: string, details?: AudioFileHandlerLogDetails): void;
}

type AudioFileHandlerLogDetails = Record<string, string | number | boolean | null | undefined>;

interface AudioFileHandlerDependencies {
  logger: AudioFileHandlerLogger;
  trustedImportedAudioPaths: Set<string>;
}

export function registerAudioFileHandlers(dependencies: AudioFileHandlerDependencies): void {
  ipcMain.handle("audio:select-file", async () => {
    dependencies.logger.trace("ipc.audio.select.start", "Audio select IPC started");

    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Audio Files", extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      dependencies.logger.trace("ipc.audio.select.cancel", "Audio select IPC canceled");
      return null;
    }

    const filePath = result.filePaths[0];

    try {
      dependencies.logger.trace("ipc.audio.read.start", "Audio read IPC started", { filePath });
      const file = await fs.readFile(filePath);
      dependencies.trustedImportedAudioPaths.add(filePath);
      dependencies.logger.trace("ipc.audio.read.end", "Audio read IPC completed", {
        filePath,
        byteLength: file.byteLength
      });
      return {
        audioData: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        filePath
      };
    } catch (error) {
      dependencies.logger.trace("ipc.audio.read.fail", "Audio read IPC failed", {
        filePath,
        errorMessage: getErrorMessage(error)
      });
      throw new Error("Failed to load audio file.", { cause: error });
    }
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
