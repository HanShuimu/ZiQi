import {
  MAX_PITCH_MIDI_NUMBER,
  MIN_PITCH_MIDI_NUMBER,
  PITCH_HEATMAP_NOTE_COUNT,
  createPitchEnergyFrame
} from "../../core/audio/pitchHeatmap";
import type { PitchEnergyOverview } from "../../core/audio/types";

export interface PitchResolutionPlan {
  downsampleFactor: number;
  fftSize: number;
  analysisSampleRate: number;
  effectiveWindowSamples: number;
  frequencyBinWidthHz: number;
  nyquistFrequencyHz: number;
}

export interface PitchStftBuildOptions {
  framesPerSecond?: number;
  onProgress?: (progress: { frameIndex: number; frameCount: number }) => void;
}

interface DecodedAudioBuffer {
  duration: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

interface PitchResolutionSelectionOptions {
  midiNumber: number;
  sampleRate: number;
  plans?: PitchResolutionPlan[];
}

interface NoteBand {
  lowerFrequencyHz: number;
  upperFrequencyHz: number;
}

const RESOLUTION_DOWNSAMPLE_FACTORS = [16, 8, 4, 2, 1] as const;
const BASE_FFT_SIZE = 4096;
const MIN_NOTE_BINS = 4;
const A4_MIDI_NUMBER = 69;
const A4_FREQUENCY_HZ = 440;

export const DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND = 100;

export function createMultiresolutionPitchEnergyOverviewFromBuffer(
  buffer: DecodedAudioBuffer,
  options: PitchStftBuildOptions = {}
): PitchEnergyOverview {
  const framesPerSecond = options.framesPerSecond ?? DEFAULT_PITCH_ENERGY_FRAMES_PER_SECOND;
  const durationMs = Math.round(buffer.duration * 1000);
  const sampleCount = Math.max(0, Math.floor(buffer.duration * buffer.sampleRate));

  if (sampleCount === 0 || buffer.numberOfChannels === 0) {
    return {
      durationMs: 0,
      framesPerSecond,
      minMidiNumber: MIN_PITCH_MIDI_NUMBER,
      maxMidiNumber: MAX_PITCH_MIDI_NUMBER,
      notesPerFrame: PITCH_HEATMAP_NOTE_COUNT,
      frames: []
    };
  }

  const monoSamples = mixToMono(buffer, sampleCount);
  const plans = createPitchResolutionPlans(buffer.sampleRate);
  const notePlans = createNoteResolutionPlans(buffer.sampleRate, plans);
  const noteBands = createNoteBands();
  const frameCount = Math.ceil(buffer.duration * framesPerSecond);
  const hopSamples = buffer.sampleRate / framesPerSecond;
  const frames = Array.from({ length: frameCount }, (_, index) => {
    const centerSample = Math.round((index + 0.5) * hopSamples);
    const spectraByDownsampleFactor = new Map(
      plans.map((plan) => [
        plan.downsampleFactor,
        calculateWindowSpectrum(monoSamples, centerSample, plan)
      ])
    );
    const energies = notePlans.map((plan, noteIndex) =>
      calculateBandEnergy({
        magnitudes: spectraByDownsampleFactor.get(plan.downsampleFactor) ?? [],
        band: noteBands[noteIndex],
        plan
      })
    );
    const frame = createPitchEnergyFrame({
      startMs: Math.round((index / framesPerSecond) * 1000),
      endMs: Math.min(durationMs, Math.round(((index + 1) / framesPerSecond) * 1000)),
      energies
    });

    options.onProgress?.({
      frameIndex: index + 1,
      frameCount
    });

    return frame;
  });

  return {
    durationMs,
    framesPerSecond,
    minMidiNumber: MIN_PITCH_MIDI_NUMBER,
    maxMidiNumber: MAX_PITCH_MIDI_NUMBER,
    notesPerFrame: PITCH_HEATMAP_NOTE_COUNT,
    frames
  };
}

export function createPitchResolutionPlans(sampleRate: number): PitchResolutionPlan[] {
  return RESOLUTION_DOWNSAMPLE_FACTORS.map((downsampleFactor) => {
    const analysisSampleRate = sampleRate / downsampleFactor;

    return {
      downsampleFactor,
      fftSize: BASE_FFT_SIZE,
      analysisSampleRate,
      effectiveWindowSamples: BASE_FFT_SIZE * downsampleFactor,
      frequencyBinWidthHz: analysisSampleRate / BASE_FFT_SIZE,
      nyquistFrequencyHz: analysisSampleRate / 2
    };
  });
}

export function selectPitchResolutionPlan({
  midiNumber,
  sampleRate,
  plans = createPitchResolutionPlans(sampleRate)
}: PitchResolutionSelectionOptions): PitchResolutionPlan {
  const band = createNoteBand(midiNumber);
  const bandWidthHz = band.upperFrequencyHz - band.lowerFrequencyHz;
  let shortestMatchingPlan: PitchResolutionPlan | undefined;

  for (const plan of plans) {
    const hasEnoughBins = bandWidthHz / plan.frequencyBinWidthHz >= MIN_NOTE_BINS;
    const canRepresentBand = band.upperFrequencyHz < plan.nyquistFrequencyHz;

    if (hasEnoughBins && canRepresentBand) {
      shortestMatchingPlan = plan;
    }
  }

  if (shortestMatchingPlan) {
    return shortestMatchingPlan;
  }

  const longestRepresentablePlan = plans.find((plan) => band.upperFrequencyHz < plan.nyquistFrequencyHz);
  return longestRepresentablePlan ?? plans[plans.length - 1];
}

function createNoteResolutionPlans(sampleRate: number, plans: PitchResolutionPlan[]) {
  return Array.from({ length: PITCH_HEATMAP_NOTE_COUNT }, (_, index) =>
    selectPitchResolutionPlan({
      midiNumber: MIN_PITCH_MIDI_NUMBER + index,
      sampleRate,
      plans
    })
  );
}

function createNoteBands() {
  return Array.from({ length: PITCH_HEATMAP_NOTE_COUNT }, (_, index) =>
    createNoteBand(MIN_PITCH_MIDI_NUMBER + index)
  );
}

function createNoteBand(midiNumber: number): NoteBand {
  return {
    lowerFrequencyHz: midiToFrequency(midiNumber - 0.5),
    upperFrequencyHz: midiToFrequency(midiNumber + 0.5)
  };
}

function midiToFrequency(midiNumber: number) {
  return A4_FREQUENCY_HZ * 2 ** ((midiNumber - A4_MIDI_NUMBER) / 12);
}

function mixToMono(buffer: DecodedAudioBuffer, sampleCount: number) {
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

function calculateWindowSpectrum(
  samples: Float32Array,
  centerSample: number,
  plan: PitchResolutionPlan
) {
  const real = new Float32Array(plan.fftSize);
  const imaginary = new Float32Array(plan.fftSize);
  const windowStart = centerSample - Math.floor(plan.effectiveWindowSamples / 2);

  for (let index = 0; index < plan.fftSize; index += 1) {
    const sourceIndex = windowStart + index * plan.downsampleFactor;
    const sample = samples[sourceIndex] ?? 0;
    real[index] = sample * hannWindow(index, plan.fftSize);
  }

  fft(real, imaginary);

  const usableBinCount = Math.floor(plan.fftSize / 2);
  return Array.from({ length: usableBinCount }, (_, index) =>
    Math.hypot(real[index], imaginary[index])
  );
}

function calculateBandEnergy({
  magnitudes,
  band,
  plan
}: {
  magnitudes: number[];
  band: NoteBand;
  plan: PitchResolutionPlan;
}) {
  let weightedTotal = 0;
  let totalWeight = 0;

  for (let index = 0; index < magnitudes.length; index += 1) {
    const binStartHz = (index - 0.5) * plan.frequencyBinWidthHz;
    const binEndHz = (index + 0.5) * plan.frequencyBinWidthHz;
    const overlapHz =
      Math.min(binEndHz, band.upperFrequencyHz) - Math.max(binStartHz, band.lowerFrequencyHz);

    if (overlapHz > 0) {
      weightedTotal += magnitudes[index] * overlapHz;
      totalWeight += overlapHz;
    }
  }

  if (totalWeight > 0) {
    return weightedTotal / totalWeight;
  }

  return magnitudes[frequencyToFftIndex(midiBandCenter(band), plan)] ?? 0;
}

function midiBandCenter(band: NoteBand) {
  return Math.sqrt(band.lowerFrequencyHz * band.upperFrequencyHz);
}

function frequencyToFftIndex(frequencyHz: number, plan: PitchResolutionPlan) {
  return Math.min(
    Math.floor(plan.fftSize / 2) - 1,
    Math.max(0, Math.round(frequencyHz / plan.frequencyBinWidthHz))
  );
}

function hannWindow(index: number, length: number) {
  if (length <= 1) {
    return 1;
  }

  return 0.5 * (1 - Math.cos((2 * Math.PI * index) / (length - 1)));
}

function fft(real: Float32Array, imaginary: Float32Array) {
  const length = real.length;
  let j = 0;

  for (let i = 1; i < length; i += 1) {
    let bit = length >> 1;
    while ((j & bit) !== 0) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }

  for (let size = 2; size <= length; size <<= 1) {
    const halfSize = size >> 1;
    const phaseStep = (-2 * Math.PI) / size;

    for (let start = 0; start < length; start += size) {
      for (let offset = 0; offset < halfSize; offset += 1) {
        const phase = phaseStep * offset;
        const cos = Math.cos(phase);
        const sin = Math.sin(phase);
        const evenIndex = start + offset;
        const oddIndex = evenIndex + halfSize;
        const oddReal = real[oddIndex] * cos - imaginary[oddIndex] * sin;
        const oddImaginary = real[oddIndex] * sin + imaginary[oddIndex] * cos;

        real[oddIndex] = real[evenIndex] - oddReal;
        imaginary[oddIndex] = imaginary[evenIndex] - oddImaginary;
        real[evenIndex] += oddReal;
        imaginary[evenIndex] += oddImaginary;
      }
    }
  }
}
