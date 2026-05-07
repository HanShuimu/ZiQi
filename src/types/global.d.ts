declare global {
  interface Window {
    ziqiApp: {
      getVersion(): Promise<string>;
      readAudioFile(filePath: string): Promise<ArrayBuffer>;
      selectAudioFile(): Promise<{ filePath: string } | null>;
    };
  }
}

export {};
