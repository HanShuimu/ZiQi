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
      let decodedAudio: AudioBuffer;

      try {
        const audioData = await response.arrayBuffer();
        decodedAudio = await audioContext.decodeAudioData(audioData);
      } catch {
        throw new Error("Failed to decode audio waveform.");
      } finally {
        await closeAudioContext(audioContext);
      }

      return createWaveformOverviewFromBuffer(decodedAudio, options);
    }
  };
}

async function closeAudioContext(audioContext: AudioContext) {
  try {
    await audioContext.close?.();
  } catch {
    // Ignore cleanup failures so they do not mask the primary result or error.
  }
}
