import { ipcMain, dialog } from "electron";
import fs from "node:fs/promises";

interface AudioFileHandlerDependencies {
  trustedImportedAudioPaths: Set<string>;
}

export function registerAudioFileHandlers(dependencies: AudioFileHandlerDependencies): void {
  ipcMain.handle("audio:select-file", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Audio Files", extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];

    try {
      const file = await fs.readFile(filePath);
      dependencies.trustedImportedAudioPaths.add(filePath);
      return {
        audioData: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        filePath
      };
    } catch {
      throw new Error("Failed to load audio file.");
    }
  });
}
