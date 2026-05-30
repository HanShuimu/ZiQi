import type { PitchEnergyOverview } from "../../core/audio/types";
import {
  rendererLogger,
  type RendererLogDetails,
  type RendererLogger
} from "../logging/rendererLogger";
import {
  DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND,
  createMultiresolutionPitchEnergyOverviewFromBuffer
} from "./pitchStft";

export interface PitchEnergyBuildOptions {
  framesPerSecond?: number;
  onProgress?: (progress: { frameIndex: number; frameCount: number }) => void;
}

export interface PitchEnergyService {
  buildOverviewFromAudioData(
    audioData: ArrayBuffer,
    options?: PitchEnergyBuildOptions
  ): Promise<PitchEnergyOverview>;
}

interface BrowserPitchEnergyServiceDependencies {
  buildOverviewFromBuffer?: typeof createMultiresolutionPitchEnergyOverviewFromBuffer;
  logger?: RendererLogger;
}

export function createBrowserPitchEnergyService({
  buildOverviewFromBuffer = createMultiresolutionPitchEnergyOverviewFromBuffer,
  logger = rendererLogger
}: BrowserPitchEnergyServiceDependencies = {}): PitchEnergyService {
  return {
    async buildOverviewFromAudioData(audioData, options = {}) {
      const framesPerSecond =
        options.framesPerSecond ?? DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND;
      const byteLength = audioData.byteLength;
      const audioContext = new AudioContext();
      let decodedAudio: AudioBuffer;

      const decodeStartedAt = nowMs();
      traceAudioLog(logger, "pitchHeatmap.decode.start", "Decoding audio for pitch heatmap", {
        byteLength,
        framesPerSecond
      });

      try {
        decodedAudio = await audioContext.decodeAudioData(audioData);
        traceAudioLog(logger, "pitchHeatmap.decode.end", "Decoded audio for pitch heatmap", {
          byteLength,
          durationMs: elapsedMs(decodeStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          framesPerSecond
        });
      } catch (error) {
        traceAudioLog(
          logger,
          "pitchHeatmap.decode.fail",
          "Failed to decode audio for pitch heatmap",
          {
            byteLength,
            durationMs: elapsedMs(decodeStartedAt),
            framesPerSecond,
            errorMessage: getErrorMessage(error)
          }
        );
        await closeAudioContext(audioContext);
        throw new Error("Failed to generate pitch heatmap.", { cause: error });
      }

      await closeAudioContext(audioContext);

      const frameCount = Math.ceil(decodedAudio.duration * framesPerSecond);
      const overviewStartedAt = nowMs();
      traceAudioLog(logger, "pitchHeatmap.overview.start", "Building pitch heatmap overview", {
        byteLength,
        audioDurationMs: Math.round(decodedAudio.duration * 1000),
        sampleRate: decodedAudio.sampleRate,
        channelCount: decodedAudio.numberOfChannels,
        framesPerSecond,
        frameCount,
        analysisEngine: "multiresolution-stft"
      });

      try {
        const overview = buildOverviewFromBuffer(decodedAudio, {
          framesPerSecond,
          onProgress(progress) {
            options.onProgress?.(progress);
            if (shouldLogProgress(progress.frameIndex, progress.frameCount)) {
              traceAudioLog(logger, "pitchHeatmap.progress", "Analyzed pitch heatmap frame", {
                frameIndex: progress.frameIndex,
                frameCount: progress.frameCount,
                percent: Math.round((progress.frameIndex / progress.frameCount) * 100)
              });
            }
          }
        });
        traceAudioLog(logger, "pitchHeatmap.overview.end", "Built pitch heatmap overview", {
          byteLength,
          durationMs: elapsedMs(overviewStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          framesPerSecond,
          frameCount
        });
        return overview;
      } catch (error) {
        traceAudioLog(
          logger,
          "pitchHeatmap.overview.fail",
          "Failed to build pitch heatmap overview",
          {
            byteLength,
            durationMs: elapsedMs(overviewStartedAt),
            audioDurationMs: Math.round(decodedAudio.duration * 1000),
            sampleRate: decodedAudio.sampleRate,
            channelCount: decodedAudio.numberOfChannels,
            framesPerSecond,
            frameCount,
            errorMessage: getErrorMessage(error)
          }
        );
        throw new Error("Failed to generate pitch heatmap.", { cause: error });
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

function shouldLogProgress(frameIndex: number, frameCount: number) {
  return frameIndex === 1 || frameIndex === frameCount || frameIndex % 24 === 0;
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
