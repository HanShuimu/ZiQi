import type { ProjectAudioFacade } from "./interfaces";
import { mockProjectAudioFacade } from "./mockFacade";
import { BrowserPlaybackService, type BrowserPlaybackMedia } from "./browserPlaybackService";
import { toAudioUrl } from "./audioFileUrl";

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
      async load(filePath, sourceUrl) {
        const hasMediaSource = "src" in media;
        const previousSrc = hasMediaSource ? media.src : undefined;

        if (hasMediaSource) {
          media.src = sourceUrl ?? toAudioUrl(filePath);
        }

        try {
          media.load?.();
          await waitForMetadata(media);
        } catch {
          if (hasMediaSource) {
            media.src = previousSrc ?? "";
            media.load?.();
          }
          throw new Error("Failed to load audio file.");
        }

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

  return new Promise<void>((resolve, reject) => {
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
      reject(new Error("Failed to load audio file."));
    };

    media.addEventListener?.("loadedmetadata", handleLoadedMetadata);
    media.addEventListener?.("error", handleError);
  });
}
