import type { WaveformOverview } from "../../core/audio/types";
import { rendererLogger, type RendererLogger } from "../logging/rendererLogger";
import {
  createWaveformOverviewFromBuffer,
  type WaveformBuildOptions
} from "./waveform";

export interface WaveformService {
  buildOverviewFromAudioData(
    audioData: ArrayBuffer,
    options?: WaveformBuildOptions
  ): Promise<WaveformOverview>;
}

export function createBrowserWaveformService(
  logger: RendererLogger = rendererLogger
): WaveformService {
  return {
    async buildOverviewFromAudioData(audioData, options) {
      const byteLength = audioData.byteLength;
      const audioContext = new AudioContext();
      let decodedAudio: AudioBuffer;
      const decodeStartedAt = nowMs();

      logger.trace("waveform.decode.start", "Decoding audio for waveform", {
        byteLength,
        pointsPerSecond: options?.pointsPerSecond
      });

      try {
        decodedAudio = await audioContext.decodeAudioData(audioData);
        logger.trace("waveform.decode.end", "Decoded audio for waveform", {
          byteLength,
          durationMs: elapsedMs(decodeStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          pointsPerSecond: options?.pointsPerSecond
        });
      } catch (error) {
        logger.trace("waveform.decode.fail", "Failed to decode audio for waveform", {
          byteLength,
          durationMs: elapsedMs(decodeStartedAt),
          pointsPerSecond: options?.pointsPerSecond,
          errorMessage: getErrorMessage(error)
        });
        throw new Error("Failed to decode audio waveform.", { cause: error });
      } finally {
        await closeAudioContext(audioContext);
      }

      const overviewStartedAt = nowMs();
      logger.trace("waveform.overview.start", "Building waveform overview", {
        byteLength,
        audioDurationMs: Math.round(decodedAudio.duration * 1000),
        sampleRate: decodedAudio.sampleRate,
        channelCount: decodedAudio.numberOfChannels,
        pointsPerSecond: options?.pointsPerSecond
      });

      try {
        const overview = createWaveformOverviewFromBuffer(decodedAudio, options);
        logger.trace("waveform.overview.end", "Built waveform overview", {
          byteLength,
          durationMs: elapsedMs(overviewStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          pointsPerSecond: options?.pointsPerSecond
        });
        return overview;
      } catch (error) {
        logger.trace("waveform.overview.fail", "Failed to build waveform overview", {
          byteLength,
          durationMs: elapsedMs(overviewStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          pointsPerSecond: options?.pointsPerSecond,
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
