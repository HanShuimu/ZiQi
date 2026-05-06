import type { AudioMetadata } from "../audio/types";
import type { ProjectSummary, SourceAudio, WorkspaceState } from "./types";

interface CreateProjectFromAudioOptions {
  filePath: string;
  metadata: AudioMetadata;
  now?: Date;
}

const defaultWorkspaceState: WorkspaceState = {
  preset: "spectrum-analysis",
  activeDock: "analysis",
  gridEnabled: true,
  bpm: 120,
  beatOffsetMs: 0,
  playbackRate: 1
};

export function createProjectFromAudio({
  filePath,
  metadata,
  now = new Date()
}: CreateProjectFromAudioOptions): ProjectSummary {
  const fileName = getFileName(filePath);
  const projectName = removeExtension(fileName) || "Untitled Project";
  const timestamp = now.toISOString();
  const sourceAudio: SourceAudio = {
    id: `source-${timestamp}`,
    name: fileName,
    durationMs: metadata.durationMs,
    sampleRate: metadata.sampleRate,
    channelCount: metadata.channelCount,
    filePath
  };

  return {
    id: `project-${timestamp}`,
    name: projectName,
    sourceAudio,
    assets: [],
    analysisRuns: [],
    annotations: [],
    workspace: { ...defaultWorkspaceState }
  };
}

function getFileName(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const segments = normalizedPath.split("/");
  return segments.at(-1) || filePath;
}

function removeExtension(fileName: string) {
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex <= 0) {
    return fileName;
  }

  return fileName.slice(0, extensionIndex);
}
