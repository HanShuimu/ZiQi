import type { WaveformOverview } from "../../core/audio/types";

export interface WaveformBuildOptions {
  pointsPerSecond?: number;
}

interface DecodedAudioBuffer {
  duration: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

const DEFAULT_POINTS_PER_SECOND = 50;

export function createWaveformOverviewFromBuffer(
  buffer: DecodedAudioBuffer,
  options: WaveformBuildOptions = {}
): WaveformOverview {
  const pointsPerSecond = options.pointsPerSecond ?? DEFAULT_POINTS_PER_SECOND;
  const durationMs = Math.round(buffer.duration * 1000);
  const sampleCount = Math.max(0, Math.floor(buffer.duration * buffer.sampleRate));

  if (sampleCount === 0 || buffer.numberOfChannels === 0) {
    return {
      pointsPerSecond,
      durationMs: 0,
      points: []
    };
  }

  const pointCount = Math.ceil(buffer.duration * pointsPerSecond);
  const samplesPerPoint = buffer.sampleRate / pointsPerSecond;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const startSample = Math.floor(index * samplesPerPoint);
    const endSample = Math.min(sampleCount, Math.floor((index + 1) * samplesPerPoint));
    const peak = calculateMonoPeak(buffer, startSample, endSample);

    return {
      startMs: Math.round((startSample / buffer.sampleRate) * 1000),
      endMs: Math.min(durationMs, Math.round((endSample / buffer.sampleRate) * 1000)),
      peak
    };
  });

  return {
    pointsPerSecond,
    durationMs,
    points
  };
}

function calculateMonoPeak(buffer: DecodedAudioBuffer, startSample: number, endSample: number) {
  let peak = 0;

  for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex += 1) {
    let mixedSample = 0;

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      mixedSample += buffer.getChannelData(channel)[sampleIndex] ?? 0;
    }

    mixedSample /= buffer.numberOfChannels;
    peak = Math.max(peak, Math.abs(mixedSample));
  }

  return clamp01(roundPeak(peak));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function roundPeak(value: number) {
  return Math.round(value * 1000) / 1000;
}
