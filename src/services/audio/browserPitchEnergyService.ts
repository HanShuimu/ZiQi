import {
  MAX_PITCH_MIDI_NUMBER,
  MIN_PITCH_FREQUENCY_HZ,
  MIN_PITCH_MIDI_NUMBER,
  PITCH_HEATMAP_NOTE_COUNT,
  createPitchEnergyFrame
} from "../../core/audio/pitchHeatmap";
import type { PitchEnergyOverview } from "../../core/audio/types";
import { rendererLogger, type RendererLogger } from "../logging/rendererLogger";

export interface PitchEnergyBuildOptions {
  framesPerSecond?: number;
  onProgress?: (progress: { frameIndex: number; frameCount: number }) => void;
}

export interface PitchEnergyEngine {
  analyzeFrame(frame: Float32Array, sampleRate: number): number[];
}

export interface PitchEnergyService {
  buildOverviewFromAudioData(
    audioData: ArrayBuffer,
    options?: PitchEnergyBuildOptions
  ): Promise<PitchEnergyOverview>;
}

interface BrowserPitchEnergyServiceDependencies {
  loadEngine?: () => Promise<PitchEnergyEngine>;
  logger?: RendererLogger;
}

interface NormalizedPitchEnergyBuildOptions {
  framesPerSecond: number;
  onProgress?: (progress: { frameIndex: number; frameCount: number }) => void;
}

const DEFAULT_FRAMES_PER_SECOND = 24;
const SPECTRUM_CQ_FRAME_SIZE = 32_768;

export function createBrowserPitchEnergyService({
  loadEngine = loadEssentiaPitchEnergyEngine,
  logger = rendererLogger
}: BrowserPitchEnergyServiceDependencies = {}): PitchEnergyService {
  return {
    async buildOverviewFromAudioData(audioData, options = {}) {
      const framesPerSecond = options.framesPerSecond ?? DEFAULT_FRAMES_PER_SECOND;
      const byteLength = audioData.byteLength;
      const audioContext = new AudioContext();
      let decodedAudio: AudioBuffer;

      const decodeStartedAt = nowMs();
      logger.trace("pitchHeatmap.decode.start", "Decoding audio for pitch heatmap", {
        byteLength,
        framesPerSecond
      });

      try {
        decodedAudio = await audioContext.decodeAudioData(audioData);
        logger.trace("pitchHeatmap.decode.end", "Decoded audio for pitch heatmap", {
          byteLength,
          durationMs: elapsedMs(decodeStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          framesPerSecond
        });
      } catch (error) {
        logger.trace("pitchHeatmap.decode.fail", "Failed to decode audio for pitch heatmap", {
          byteLength,
          durationMs: elapsedMs(decodeStartedAt),
          framesPerSecond,
          errorMessage: getErrorMessage(error)
        });
        await closeAudioContext(audioContext);
        throw new Error("Failed to generate pitch heatmap.", { cause: error });
      }

      await closeAudioContext(audioContext);

      let engine: PitchEnergyEngine;
      const engineStartedAt = nowMs();
      logger.trace("pitchHeatmap.engine.load.start", "Loading pitch analysis engine", {
        byteLength,
        audioDurationMs: Math.round(decodedAudio.duration * 1000),
        sampleRate: decodedAudio.sampleRate,
        channelCount: decodedAudio.numberOfChannels,
        framesPerSecond
      });

      try {
        engine = await loadEngine();
        logger.trace("pitchHeatmap.engine.load.end", "Loaded pitch analysis engine", {
          byteLength,
          durationMs: elapsedMs(engineStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          framesPerSecond
        });
      } catch (error) {
        logger.trace("pitchHeatmap.engine.load.fail", "Failed to load pitch analysis engine", {
          byteLength,
          durationMs: elapsedMs(engineStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          framesPerSecond,
          errorMessage: getErrorMessage(error)
        });
        throw new Error("Failed to load pitch analysis engine.", { cause: error });
      }

      const frameCount = Math.ceil(decodedAudio.duration * framesPerSecond);
      const overviewStartedAt = nowMs();
      logger.trace("pitchHeatmap.overview.start", "Building pitch heatmap overview", {
        byteLength,
        audioDurationMs: Math.round(decodedAudio.duration * 1000),
        sampleRate: decodedAudio.sampleRate,
        channelCount: decodedAudio.numberOfChannels,
        framesPerSecond,
        frameCount
      });

      try {
        const overview = createPitchEnergyOverviewFromBuffer(decodedAudio, engine, {
          framesPerSecond,
          onProgress(progress) {
            options.onProgress?.(progress);
            if (shouldLogProgress(progress.frameIndex, progress.frameCount)) {
              logger.trace("pitchHeatmap.progress", "Analyzed pitch heatmap frame", {
                frameIndex: progress.frameIndex,
                frameCount: progress.frameCount,
                percent: Math.round((progress.frameIndex / progress.frameCount) * 100)
              });
            }
          }
        });
        logger.trace("pitchHeatmap.overview.end", "Built pitch heatmap overview", {
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
        logger.trace("pitchHeatmap.overview.fail", "Failed to build pitch heatmap overview", {
          byteLength,
          durationMs: elapsedMs(overviewStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels,
          framesPerSecond,
          frameCount,
          errorMessage: getErrorMessage(error)
        });
        throw new Error("Failed to generate pitch heatmap.", { cause: error });
      }
    }
  };
}

export function createPitchEnergyOverviewFromBuffer(
  buffer: AudioBuffer,
  engine: PitchEnergyEngine,
  options: NormalizedPitchEnergyBuildOptions
): PitchEnergyOverview {
  const durationMs = Math.round(buffer.duration * 1000);
  const sampleCount = Math.max(0, Math.floor(buffer.duration * buffer.sampleRate));
  const monoSamples = mixToMono(buffer, sampleCount);
  const frameCount = Math.ceil(buffer.duration * options.framesPerSecond);
  const hopSamples = buffer.sampleRate / options.framesPerSecond;

  return {
    durationMs,
    framesPerSecond: options.framesPerSecond,
    minMidiNumber: MIN_PITCH_MIDI_NUMBER,
    maxMidiNumber: MAX_PITCH_MIDI_NUMBER,
    notesPerFrame: PITCH_HEATMAP_NOTE_COUNT,
    frames: Array.from({ length: frameCount }, (_, index) => {
      const centerSample = Math.round((index + 0.5) * hopSamples);
      const frame = extractCenteredFrame(monoSamples, centerSample, SPECTRUM_CQ_FRAME_SIZE);
      const pitchFrame = createPitchEnergyFrame({
        startMs: Math.round((index / options.framesPerSecond) * 1000),
        endMs: Math.min(durationMs, Math.round(((index + 1) / options.framesPerSecond) * 1000)),
        energies: engine.analyzeFrame(frame, buffer.sampleRate)
      });

      options.onProgress?.({
        frameIndex: index + 1,
        frameCount
      });

      return pitchFrame;
    })
  };
}

function extractCenteredFrame(samples: Float32Array, centerSample: number, frameSize: number) {
  const frame = new Float32Array(frameSize);
  const sourceStart = centerSample - Math.floor(frameSize / 2);

  for (let frameIndex = 0; frameIndex < frameSize; frameIndex += 1) {
    const sourceIndex = sourceStart + frameIndex;
    if (sourceIndex >= 0 && sourceIndex < samples.length) {
      frame[frameIndex] = samples[sourceIndex];
    }
  }

  return frame;
}

export async function loadEssentiaPitchEnergyEngine(): Promise<PitchEnergyEngine> {
  const essentiaModule = await import("essentia.js");
  const essentiaPackage = essentiaModule.default ?? essentiaModule;
  const Essentia = essentiaPackage.Essentia ?? essentiaModule.Essentia;
  const EssentiaWASM = unwrapEssentiaWASM(
    essentiaPackage.EssentiaWASM ?? essentiaModule.EssentiaWASM
  );
  const essentia = new Essentia(EssentiaWASM);

  return {
    analyzeFrame(frame, sampleRate) {
      const vector = essentia.arrayToVector(frame);
      const result = essentia.SpectrumCQ(
        vector,
        12,
        MIN_PITCH_FREQUENCY_HZ,
        4,
        PITCH_HEATMAP_NOTE_COUNT,
        sampleRate,
        1,
        0.01,
        "hann",
        true
      );

      return Array.from(essentia.vectorToArray(result.spectrumCQ));
    }
  };
}

function unwrapEssentiaWASM(value: unknown) {
  if (isEssentiaWASM(value)) {
    return value;
  }

  if (isRecord(value) && isEssentiaWASM(value.EssentiaWASM)) {
    return value.EssentiaWASM;
  }

  return value;
}

function isEssentiaWASM(value: unknown): value is { EssentiaJS: unknown } {
  return isRecord(value) && typeof value.EssentiaJS === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mixToMono(buffer: AudioBuffer, sampleCount: number) {
  const monoSamples = new Float32Array(sampleCount);

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    let mixedSample = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      mixedSample += buffer.getChannelData(channel)[sampleIndex] ?? 0;
    }
    monoSamples[sampleIndex] = mixedSample / buffer.numberOfChannels;
  }

  return monoSamples;
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

function nowMs() {
  return globalThis.performance?.now() ?? Date.now();
}

function elapsedMs(startMs: number) {
  return Math.round(nowMs() - startMs);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
