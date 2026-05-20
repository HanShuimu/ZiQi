export interface AudioMetadata {
  durationMs: number;
  sampleRate: number;
  channelCount: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTimeMs: number;
  playbackRate: number;
  loopRange?: {
    startMs: number;
    endMs: number;
  };
}

export interface SpectrumViewport {
  startMs: number;
  endMs: number;
  minHz: number;
  maxHz: number;
  channelMode: "stereo" | "left" | "right" | "merged";
}

export interface SpectrumFrame {
  startMs: number;
  endMs: number;
  bins: number[];
}

export interface EqBandSetting {
  frequencyHz: number;
  gainDb: number;
  q: number;
}

export interface WaveformPoint {
  startMs: number;
  endMs: number;
  peak: number;
}

export interface WaveformOverview {
  pointsPerSecond: number;
  durationMs: number;
  points: WaveformPoint[];
}

export interface SpectrogramFrame {
  startMs: number;
  endMs: number;
  magnitudes: number[];
}

export interface SpectrogramOverview {
  durationMs: number;
  framesPerSecond: number;
  minFrequencyHz: number;
  maxFrequencyHz: number;
  binsPerFrame: number;
  frames: SpectrogramFrame[];
}
