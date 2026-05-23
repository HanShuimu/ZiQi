import type { AudioMetadata } from "../audio/types";
import type { ProjectSummary, SourceAudio } from "./types";
import { createDefaultProjectAnalysisView } from "./analysisView";
import { createDefaultWorkspaceState } from "../workspace/workspaceState";

interface CreateProjectFromAudioOptions {
  filePath: string;
  metadata: AudioMetadata;
  now?: Date;
}

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
    analysisView: createDefaultProjectAnalysisView(),
    workspace: createDefaultWorkspaceState(metadata.durationMs)
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
