import {
  createSpectrogramOverviewFromBuffer,
  type SpectrogramBuildOptions,
  type SpectrogramOverview
} from "./spectrogram";

export interface SpectrogramService {
  buildOverviewFromAudioData(
    audioData: ArrayBuffer,
    options?: SpectrogramBuildOptions
  ): Promise<SpectrogramOverview>;
}

export function createBrowserSpectrogramService(): SpectrogramService {
  return {
    async buildOverviewFromAudioData(audioData, options) {
      const audioContext = new AudioContext();
      let decodedAudio: AudioBuffer;

      try {
        decodedAudio = await audioContext.decodeAudioData(audioData);
      } catch {
        throw new Error("Failed to generate spectrogram.");
      } finally {
        await closeAudioContext(audioContext);
      }

      return createSpectrogramOverviewFromBuffer(decodedAudio, options);
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
