import type { ProjectSummary } from "./types";
import { createDefaultWorkspaceState } from "./workspaceState";

export function createMockProjectSummary(): ProjectSummary {
  return {
    id: "project-demo",
    name: "Demo Track Study",
    sourceAudio: {
      id: "source-001",
      name: "demo-track.wav",
      durationMs: 242000,
      sampleRate: 48000,
      channelCount: 2,
      filePath: "D:/Music/demo-track.wav"
    },
    assets: [
      {
        id: "asset-stem-001",
        name: "Vocals Stem",
        kind: "stem",
        providerId: "provider.demucs.local",
        createdAt: "2026-04-29T15:00:00.000Z"
      }
    ],
    analysisRuns: [
      {
        id: "analysis-001",
        name: "Chord Candidate Pass",
        providerId: "provider.llm.chord-assistant",
        status: "completed",
        createdAt: "2026-04-29T15:10:00.000Z"
      }
    ],
    annotations: [
      {
        id: "annotation-001",
        label: "Possible tonic shift",
        startMs: 43120,
        kind: "marker"
      }
    ],
    workspace: createDefaultWorkspaceState(120_000)
  };
}

