import type { ProjectAudioFacade } from "./interfaces";
import { mockProjectAudioFacade } from "./mockFacade";
import { BrowserPlaybackService, type BrowserPlaybackMedia } from "./browserPlaybackService";

interface BrowserProjectAudioMedia extends BrowserPlaybackMedia {
  duration?: number;
  src?: string;
  load?: () => void;
}

export function createBrowserProjectAudioFacade(
  media: BrowserProjectAudioMedia
): ProjectAudioFacade {
  const playback = new BrowserPlaybackService(media);

  return {
    source: {
      async load(filePath) {
        if ("src" in media) {
          media.src = toAudioUrl(filePath);
        }

        media.load?.();
        await waitForMetadata(media);

        return {
          durationMs: Number.isFinite(media.duration) ? Math.round((media.duration ?? 0) * 1000) : 0,
          sampleRate: 0,
          channelCount: 2
        };
      },
      async unload() {
        await playback.pause();
        if ("src" in media) {
          media.src = "";
        }
      }
    },
    playback,
    analysis: mockProjectAudioFacade.analysis,
    processing: mockProjectAudioFacade.processing
  };
}

function waitForMetadata(media: BrowserProjectAudioMedia) {
  if (Number.isFinite(media.duration) && (media.duration ?? 0) > 0) {
    return Promise.resolve();
  }

  if (!media.addEventListener || !media.removeEventListener) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const cleanup = () => {
      media.removeEventListener?.("loadedmetadata", handleLoadedMetadata);
      media.removeEventListener?.("error", handleError);
    };
    const handleLoadedMetadata = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      resolve();
    };

    media.addEventListener?.("loadedmetadata", handleLoadedMetadata);
    media.addEventListener?.("error", handleError);
  });
}

function toAudioUrl(filePath: string) {
  if (/^[a-z]:[\\/]/i.test(filePath)) {
    const normalizedPath = filePath.replace(/\\/g, "/");
    return `file:///${encodeURI(normalizedPath)}`;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(filePath)) {
    return filePath;
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  return `file:///${encodeURI(normalizedPath)}`;
}
