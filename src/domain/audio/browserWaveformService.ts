import {
  createWaveformOverviewFromBuffer,
  type WaveformBuildOptions,
  type WaveformOverview
} from "./waveform";

export interface WaveformService {
  buildOverview(audioUrl: string, options?: WaveformBuildOptions): Promise<WaveformOverview>;
}

export function createBrowserWaveformService(): WaveformService {
  return {
    async buildOverview(audioUrl, options) {
      let response: Response;

      try {
        response = await fetch(audioUrl);
      } catch {
        throw new Error("Failed to load audio file.");
      }

      if (!response.ok) {
        throw new Error("Failed to load audio file.");
      }

      const audioContext = new AudioContext();

      try {
        const audioData = await response.arrayBuffer();
        const decodedAudio = await audioContext.decodeAudioData(audioData);
        return createWaveformOverviewFromBuffer(decodedAudio, options);
      } catch {
        throw new Error("Failed to decode audio waveform.");
      }
    }
  };
}
