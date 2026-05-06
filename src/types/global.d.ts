declare global {
  interface Window {
    ziqiApp: {
      getVersion(): Promise<string>;
      selectAudioFile(): Promise<{ filePath: string } | null>;
    };
  }
}

export {};
