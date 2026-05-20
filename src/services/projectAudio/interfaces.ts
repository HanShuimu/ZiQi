import type {
  AudioMetadata,
  EqBandSetting,
  PlaybackState,
  SpectrumFrame,
  SpectrumViewport
} from "../../core/audio/types";

export interface AudioSourceService {
  load(filePath: string, sourceUrl?: string): Promise<AudioMetadata>;
  unload(): Promise<void>;
}

export interface PlaybackService {
  getState(): PlaybackState;
  play(fromMs?: number): Promise<void>;
  pause(): Promise<void>;
  seek(timeMs: number): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;
  setLoopRange(startMs: number, endMs: number): Promise<void>;
  clearLoopRange(): Promise<void>;
}

export interface AnalysisDataService {
  getSpectrum(viewport: SpectrumViewport): Promise<SpectrumFrame[]>;
}

export interface AudioProcessingService {
  setEqBands(bands: EqBandSetting[]): Promise<void>;
  resetEq(): Promise<void>;
}

export interface ProjectAudioFacade {
  source: AudioSourceService;
  playback: PlaybackService;
  analysis: AnalysisDataService;
  processing: AudioProcessingService;
}
