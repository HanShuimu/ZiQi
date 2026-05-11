export interface SpectrogramOverview {
  durationMs: number;
  framesPerSecond: number;
  minFrequencyHz: number;
  maxFrequencyHz: number;
  binsPerFrame: number;
  frames: SpectrogramFrame[];
}

export interface SpectrogramFrame {
  startMs: number;
  endMs: number;
  magnitudes: number[];
}

export interface SpectrogramBuildOptions {
  binsPerFrame?: number;
  framesPerSecond?: number;
  fftSize?: number;
}

interface DecodedAudioBuffer {
  duration: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface PianoKey {
  midiNumber: number;
  name: string;
  frequencyHz: number;
  isBlackKey: boolean;
  position: number;
}

const DEFAULT_BINS_PER_FRAME = 96;
const DEFAULT_FRAMES_PER_SECOND = 24;
const DEFAULT_FFT_SIZE = 2048;
const A4_MIDI_NUMBER = 69;
const A4_FREQUENCY_HZ = 440;
const PIANO_START_MIDI = 21;
const PIANO_END_MIDI = 108;
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const MIN_PIANO_FREQUENCY_HZ = midiToFrequency(PIANO_START_MIDI);
export const MAX_PIANO_FREQUENCY_HZ = midiToFrequency(PIANO_END_MIDI);

export const PIANO_KEYS: PianoKey[] = Array.from(
  { length: PIANO_END_MIDI - PIANO_START_MIDI + 1 },
  (_, index) => {
    const midiNumber = PIANO_START_MIDI + index;
    const noteIndex = midiNumber % 12;
    const name = `${NOTE_NAMES[noteIndex]}${Math.floor(midiNumber / 12) - 1}`;
    const frequencyHz = midiToFrequency(midiNumber);

    return {
      midiNumber,
      name,
      frequencyHz,
      isBlackKey: name.includes("#"),
      position: frequencyToLogPosition(frequencyHz)
    };
  }
);

export function createSpectrogramOverviewFromBuffer(
  buffer: DecodedAudioBuffer,
  options: SpectrogramBuildOptions = {}
): SpectrogramOverview {
  const binsPerFrame = options.binsPerFrame ?? DEFAULT_BINS_PER_FRAME;
  const framesPerSecond = options.framesPerSecond ?? DEFAULT_FRAMES_PER_SECOND;
  const fftSize = normalizeFftSize(options.fftSize ?? DEFAULT_FFT_SIZE);
  const durationMs = Math.round(buffer.duration * 1000);
  const sampleCount = Math.max(0, Math.floor(buffer.duration * buffer.sampleRate));

  if (sampleCount === 0 || buffer.numberOfChannels === 0) {
    return {
      durationMs: 0,
      framesPerSecond,
      minFrequencyHz: MIN_PIANO_FREQUENCY_HZ,
      maxFrequencyHz: MAX_PIANO_FREQUENCY_HZ,
      binsPerFrame,
      frames: []
    };
  }

  const monoSamples = mixToMono(buffer, sampleCount);
  const frameCount = Math.ceil(buffer.duration * framesPerSecond);
  const samplesPerFrame = buffer.sampleRate / framesPerSecond;
  const binRanges = createLogFrequencyBinRanges({
    binsPerFrame,
    fftSize,
    sampleRate: buffer.sampleRate
  });
  const rawFrames = Array.from({ length: frameCount }, (_, index) => {
    const centerSample = Math.floor(index * samplesPerFrame);
    const spectrum = calculateWindowSpectrum(monoSamples, centerSample, fftSize);
    const magnitudes = binRanges.map(({ startIndex, endIndex }) =>
      averageRange(spectrum, startIndex, endIndex)
    );

    return {
      startMs: Math.round((index / framesPerSecond) * 1000),
      endMs: Math.min(durationMs, Math.round(((index + 1) / framesPerSecond) * 1000)),
      magnitudes
    };
  });
  const maxMagnitude = findMaxMagnitude(rawFrames);

  return {
    durationMs,
    framesPerSecond,
    minFrequencyHz: MIN_PIANO_FREQUENCY_HZ,
    maxFrequencyHz: MAX_PIANO_FREQUENCY_HZ,
    binsPerFrame,
    frames: rawFrames.map((frame) => ({
      ...frame,
      magnitudes: frame.magnitudes.map((value) => normalizeMagnitude(value, maxMagnitude))
    }))
  };
}

export function frequencyToLogPosition(frequencyHz: number) {
  const clampedFrequency = Math.min(
    MAX_PIANO_FREQUENCY_HZ,
    Math.max(MIN_PIANO_FREQUENCY_HZ, frequencyHz)
  );
  const minLog = Math.log2(MIN_PIANO_FREQUENCY_HZ);
  const maxLog = Math.log2(MAX_PIANO_FREQUENCY_HZ);
  return roundPosition((Math.log2(clampedFrequency) - minLog) / (maxLog - minLog));
}

export function magnitudeToSpectrogramColor(magnitude: number) {
  const value = Math.min(1, Math.max(0, magnitude));
  const stops = [
    { value: 0, color: [0, 0, 24] },
    { value: 0.25, color: [0, 0, 255] },
    { value: 0.5, color: [0, 255, 0] },
    { value: 0.75, color: [255, 255, 0] },
    { value: 1, color: [255, 0, 0] }
  ];

  for (let index = 0; index < stops.length - 1; index += 1) {
    const start = stops[index];
    const end = stops[index + 1];
    if (value >= start.value && value <= end.value) {
      const ratio = (value - start.value) / (end.value - start.value);
      const [red, green, blue] = start.color.map((channel, channelIndex) =>
        Math.round(channel + (end.color[channelIndex] - channel) * ratio)
      );
      return `rgb(${red}, ${green}, ${blue})`;
    }
  }

  return "rgb(255, 0, 0)";
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

function calculateWindowSpectrum(samples: Float32Array, centerSample: number, fftSize: number) {
  const real = new Float32Array(fftSize);
  const imaginary = new Float32Array(fftSize);
  const windowStart = centerSample - Math.floor(fftSize / 2);

  for (let index = 0; index < fftSize; index += 1) {
    const sample = samples[windowStart + index] ?? 0;
    real[index] = sample * hannWindow(index, fftSize);
  }

  fft(real, imaginary);

  const usableBinCount = Math.floor(fftSize / 2);
  return Array.from({ length: usableBinCount }, (_, index) =>
    Math.hypot(real[index], imaginary[index])
  );
}

function createLogFrequencyBinRanges({
  binsPerFrame,
  fftSize,
  sampleRate
}: {
  binsPerFrame: number;
  fftSize: number;
  sampleRate: number;
}) {
  return Array.from({ length: binsPerFrame }, (_, index) => {
    const startRatio = index / binsPerFrame;
    const endRatio = (index + 1) / binsPerFrame;
    const startFrequency = logPositionToFrequency(startRatio);
    const endFrequency = logPositionToFrequency(endRatio);
    const startIndex = frequencyToFftIndex(startFrequency, fftSize, sampleRate);
    const endIndex = Math.max(
      startIndex + 1,
      frequencyToFftIndex(endFrequency, fftSize, sampleRate)
    );

    return { startIndex, endIndex };
  });
}

function logPositionToFrequency(position: number) {
  return (
    MIN_PIANO_FREQUENCY_HZ *
    (MAX_PIANO_FREQUENCY_HZ / MIN_PIANO_FREQUENCY_HZ) ** Math.min(1, Math.max(0, position))
  );
}

function frequencyToFftIndex(frequencyHz: number, fftSize: number, sampleRate: number) {
  return Math.min(
    Math.floor(fftSize / 2) - 1,
    Math.max(0, Math.round((frequencyHz * fftSize) / sampleRate))
  );
}

function averageRange(values: number[], startIndex: number, endIndex: number) {
  let total = 0;
  let count = 0;

  for (let index = startIndex; index < endIndex; index += 1) {
    total += values[index] ?? 0;
    count += 1;
  }

  return count === 0 ? 0 : total / count;
}

function findMaxMagnitude(frames: SpectrogramFrame[]) {
  let maxMagnitude = 0;

  for (const frame of frames) {
    for (const magnitude of frame.magnitudes) {
      if (magnitude > maxMagnitude) {
        maxMagnitude = magnitude;
      }
    }
  }

  return maxMagnitude;
}

function normalizeMagnitude(value: number, maxMagnitude: number) {
  if (maxMagnitude <= 0) {
    return 0;
  }

  return Math.round(Math.min(1, Math.max(0, value / maxMagnitude)) * 1000) / 1000;
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

function normalizeFftSize(value: number) {
  const rounded = Math.max(8, Math.floor(value));
  return 2 ** Math.ceil(Math.log2(rounded));
}

function roundPosition(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
