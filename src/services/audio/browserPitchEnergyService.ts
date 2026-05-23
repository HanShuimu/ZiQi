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
  const samplesPerFrame = buffer.sampleRate / options.framesPerSecond;

  return {
    durationMs,
    framesPerSecond: options.framesPerSecond,
    minMidiNumber: MIN_PITCH_MIDI_NUMBER,
    maxMidiNumber: MAX_PITCH_MIDI_NUMBER,
    notesPerFrame: PITCH_HEATMAP_NOTE_COUNT,
    frames: Array.from({ length: frameCount }, (_, index) => {
      const startSample = Math.floor(index * samplesPerFrame);
      const endSample = Math.min(sampleCount, Math.floor((index + 1) * samplesPerFrame));
      const frame = monoSamples.slice(startSample, Math.max(startSample + 1, endSample));

      return createPitchEnergyFrame({
        startMs: Math.round((index / options.framesPerSecond) * 1000),
        endMs: Math.min(durationMs, Math.round(((index + 1) / options.framesPerSecond) * 1000)),
        energies: engine.analyzeFrame(frame, buffer.sampleRate)
      });
    })
  };
}

async function loadEssentiaPitchEnergyEngine(): Promise<PitchEnergyEngine> {
  const [{ default: Essentia }, wasmModule] = await Promise.all([
    import("essentia.js/dist/essentia.js-core.es.js"),
    import("essentia.js/dist/essentia-wasm.es.js")
  ]);
  const essentia = new Essentia(wasmModule.default ?? wasmModule);

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
