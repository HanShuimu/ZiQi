import type { SpectrogramOverview } from "../../core/audio/types";
import {
  rendererLogger,
  type RendererLogDetails,
  type RendererLogger
} from "../logging/rendererLogger";
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

      traceAudioLog(logger, "spectrogram.decode.start", "Decoding audio for spectrogram", {
        byteLength,
        framesPerSecond: options?.framesPerSecond
      });

      try {
        decodedAudio = await audioContext.decodeAudioData(audioData);
        traceAudioLog(logger, "spectrogram.decode.end", "Decoded audio for spectrogram", {
          byteLength,
          durationMs: elapsedMs(decodeStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          framesPerSecond: options?.framesPerSecond
        });
      } catch (error) {
        traceAudioLog(
          logger,
          "spectrogram.decode.fail",
          "Failed to decode audio for spectrogram",
          {
            byteLength,
            durationMs: elapsedMs(decodeStartedAt),
            framesPerSecond: options?.framesPerSecond,
            errorMessage: getErrorMessage(error)
          }
        );
        throw new Error("Failed to generate spectrogram.", { cause: error });
      } finally {
        await closeAudioContext(audioContext);
      }

      const overviewStartedAt = nowMs();
      traceAudioLog(logger, "spectrogram.overview.start", "Building spectrogram overview", {
        byteLength,
        audioDurationMs: Math.round(decodedAudio.duration * 1000),
        sampleRate: decodedAudio.sampleRate,
        channelCount: decodedAudio.numberOfChannels,
        framesPerSecond: options?.framesPerSecond
      });

      try {
        const overview = createSpectrogramOverviewFromBuffer(decodedAudio, options);
        traceAudioLog(logger, "spectrogram.overview.end", "Built spectrogram overview", {
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
        traceAudioLog(
          logger,
          "spectrogram.overview.fail",
          "Failed to build spectrogram overview",
          {
            byteLength,
            durationMs: elapsedMs(overviewStartedAt),
            audioDurationMs: Math.round(decodedAudio.duration * 1000),
            sampleRate: decodedAudio.sampleRate,
            channelCount: decodedAudio.numberOfChannels,
            framesPerSecond: options?.framesPerSecond,
            errorMessage: getErrorMessage(error)
          }
        );
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

function traceAudioLog(
  logger: RendererLogger,
  event: string,
  message: string,
  details?: RendererLogDetails
) {
  try {
    logger.trace(event, message, details);
  } catch {
    // Audio analysis logs are diagnostic only; ignore logger failures.
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
