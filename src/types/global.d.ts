declare global {
  interface Window {
    ziqiApp: {
      getVersion(): Promise<string>;
    };
  }
}

export {};

