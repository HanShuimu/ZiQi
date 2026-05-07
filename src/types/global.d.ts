declare global {
  interface Window {
    ziqiApp: {
      getVersion(): Promise<string>;
      selectAudioFile(): Promise<{ audioData: ArrayBuffer; filePath: string } | null>;
    };
  }
}

export {};
