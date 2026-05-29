import type { SpectrogramOverview } from "../../core/audio/types";
import { rendererLogger, type RendererLogger } from "../logging/rendererLogger";
import {
  createSpectrogramOverviewFromBuffer,
  type SpectrogramBuildOptions
} from "./spectrogram";

export interface SpectrogramService {
  buildOverviewFromAudioData(
    audioData: ArrayBuffer,
    options?: SpectrogramBuildOptions
  ): Promise<SpectrogramOverview>;
}

export function createBrowserSpectrogramService(
  logger: RendererLogger = rendererLogger
): SpectrogramService {
  return {
    async buildOverviewFromAudioData(audioData, options) {
      const byteLength = audioData.byteLength;
      const audioContext = new AudioContext();
      let decodedAudio: AudioBuffer;
      const decodeStartedAt = nowMs();

      logger.trace("spectrogram.decode.start", "Decoding audio for spectrogram", {
        byteLength,
        framesPerSecond: options?.framesPerSecond
      });

      try {
        decodedAudio = await audioContext.decodeAudioData(audioData);
        logger.trace("spectrogram.decode.end", "Decoded audio for spectrogram", {
          byteLength,
          durationMs: elapsedMs(decodeStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          framesPerSecond: options?.framesPerSecond
        });
      } catch (error) {
        logger.trace("spectrogram.decode.fail", "Failed to decode audio for spectrogram", {
          byteLength,
          durationMs: elapsedMs(decodeStartedAt),
          framesPerSecond: options?.framesPerSecond,
          errorMessage: getErrorMessage(error)
        });
        throw new Error("Failed to generate spectrogram.", { cause: error });
      } finally {
        await closeAudioContext(audioContext);
      }

      const overviewStartedAt = nowMs();
      logger.trace("spectrogram.overview.start", "Building spectrogram overview", {
        byteLength,
        audioDurationMs: Math.round(decodedAudio.duration * 1000),
        sampleRate: decodedAudio.sampleRate,
        channelCount: decodedAudio.numberOfChannels,
        framesPerSecond: options?.framesPerSecond
      });

      try {
        const overview = createSpectrogramOverviewFromBuffer(decodedAudio, options);
        logger.trace("spectrogram.overview.end", "Built spectrogram overview", {
          byteLength,
          durationMs: elapsedMs(overviewStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          framesPerSecond: options?.framesPerSecond,
          frameCount: overview.frames.length
        });
        return overview;
      } catch (error) {
        logger.trace("spectrogram.overview.fail", "Failed to build spectrogram overview", {
          byteLength,
          durationMs: elapsedMs(overviewStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          framesPerSecond: options?.framesPerSecond,
          errorMessage: getErrorMessage(error)
        });
        throw error;
      }
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

function nowMs() {
  return globalThis.performance?.now() ?? Date.now();
}

function elapsedMs(startMs: number) {
  return Math.round(nowMs() - startMs);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
