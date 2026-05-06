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

export type { WaveformOverview, WaveformPoint } from "./waveform";
