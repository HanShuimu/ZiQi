import {
  MAX_PITCH_MIDI_NUMBER,
  MIN_PITCH_FREQUENCY_HZ,
  MIN_PITCH_MIDI_NUMBER,
  PITCH_HEATMAP_NOTE_COUNT,
  createPitchEnergyFrame
} from "../../core/audio/pitchHeatmap";
import type { PitchEnergyOverview } from "../../core/audio/types";

export interface PitchEnergyBuildOptions {
  framesPerSecond?: number;
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
}

const DEFAULT_FRAMES_PER_SECOND = 24;
const SPECTRUM_CQ_FRAME_SIZE = 32_768;

export function createBrowserPitchEnergyService({
  loadEngine = loadEssentiaPitchEnergyEngine
}: BrowserPitchEnergyServiceDependencies = {}): PitchEnergyService {
  return {
    async buildOverviewFromAudioData(audioData, options = {}) {
      const framesPerSecond = options.framesPerSecond ?? DEFAULT_FRAMES_PER_SECOND;
      const audioContext = new AudioContext();
      let decodedAudio: AudioBuffer;

      try {
        decodedAudio = await audioContext.decodeAudioData(audioData);
      } catch {
        await closeAudioContext(audioContext);
        throw new Error("Failed to generate pitch heatmap.");
      }

      await closeAudioContext(audioContext);

      let engine: PitchEnergyEngine;
      try {
        engine = await loadEngine();
      } catch {
        throw new Error("Failed to load pitch analysis engine.");
      }

      try {
        return createPitchEnergyOverviewFromBuffer(decodedAudio, engine, {
          framesPerSecond
        });
      } catch {
        throw new Error("Failed to generate pitch heatmap.");
      }
    }
  };
}

export function createPitchEnergyOverviewFromBuffer(
  buffer: AudioBuffer,
  engine: PitchEnergyEngine,
  options: Required<PitchEnergyBuildOptions>
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

      return createPitchEnergyFrame({
        startMs: Math.round((index / options.framesPerSecond) * 1000),
        endMs: Math.min(durationMs, Math.round(((index + 1) / options.framesPerSecond) * 1000)),
        energies: engine.analyzeFrame(frame, buffer.sampleRate)
      });
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
