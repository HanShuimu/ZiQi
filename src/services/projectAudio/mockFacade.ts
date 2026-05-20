import type { ProjectAudioFacade } from "./interfaces";
import type { AudioMetadata, PlaybackState, SpectrumViewport } from "../../core/audio/types";

const state: PlaybackState = {
  isPlaying: false,
  currentTimeMs: 43120,
  playbackRate: 0.8
};

const metadata: AudioMetadata = {
  durationMs: 242000,
  sampleRate: 48000,
  channelCount: 2
};

function createSpectrumBins(length: number, phase: number) {
  return Array.from({ length }, (_, index) => {
    const base = Math.sin((index / length) * Math.PI * 10 + phase);
    const envelope = 0.5 + 0.5 * Math.sin((index / length) * Math.PI * 2);
    return Math.max(0.06, envelope * (0.35 + base * 0.3 + Math.random() * 0.08));
  });
}

export const mockProjectAudioFacade: ProjectAudioFacade = {
  source: {
    async load() {
      return metadata;
    },
    async unload() {}
  },
  playback: {
    getState() {
      return state;
    },
    async play(fromMs) {
      state.isPlaying = true;
      if (typeof fromMs === "number") {
        state.currentTimeMs = fromMs;
      }
    },
    async pause() {
      state.isPlaying = false;
    },
    async seek(timeMs) {
      state.currentTimeMs = timeMs;
    },
    async setPlaybackRate(rate) {
      state.playbackRate = rate;
    },
    async setLoopRange(startMs, endMs) {
      state.loopRange = { startMs, endMs };
    },
    async clearLoopRange() {
      delete state.loopRange;
    }
  },
  analysis: {
    async getSpectrum(viewport: SpectrumViewport) {
      const frameCount = 72;
      const duration = viewport.endMs - viewport.startMs;
      return Array.from({ length: frameCount }, (_, frameIndex) => {
        const startMs = viewport.startMs + (duration / frameCount) * frameIndex;
        const endMs = viewport.startMs + (duration / frameCount) * (frameIndex + 1);
        return {
          startMs,
          endMs,
          bins: createSpectrumBins(36, frameIndex * 0.17)
        };
      });
    }
  },
  processing: {
    async setEqBands() {},
    async resetEq() {}
  }
};
