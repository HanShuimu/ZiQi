import {
  createWaveformOverviewFromBuffer,
  type WaveformBuildOptions,
  type WaveformOverview
} from "./waveform";

export interface WaveformService {
  buildOverviewFromAudioData(
    audioData: ArrayBuffer,
    options?: WaveformBuildOptions
  ): Promise<WaveformOverview>;
}

export function createBrowserWaveformService(): WaveformService {
  return {
    async buildOverviewFromAudioData(audioData, options) {
      const audioContext = new AudioContext();
      let decodedAudio: AudioBuffer;

      try {
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
