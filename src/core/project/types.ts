export type ProjectId = string;
export type AudioAssetId = string;
export type AnalysisRunId = string;
export type AnnotationId = string;

export interface SourceAudio {
  id: AudioAssetId;
  name: string;
  durationMs: number;
  sampleRate: number;
  channelCount: number;
  filePath: string;
}

export interface DerivedAudioAsset {
  id: AudioAssetId;
  name: string;
  kind: "stem" | "channel-split" | "range-export" | "processing-cache";
  providerId?: string;
  createdAt: string;
}

export interface AnalysisRun {
  id: AnalysisRunId;
  name: string;
  providerId: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
}

export interface TimelineAnnotation {
  id: AnnotationId;
  label: string;
  startMs: number;
  endMs?: number;
  kind: "marker" | "loop" | "note" | "review-point";
}

export interface LoopRange {
  startMs: number;
  endMs: number;
}

export interface WorkspaceSpectrogramViewport {
  startMs: number;
  durationMs: number;
}

export interface WorkspaceState {
  preset: "pure-spectrum" | "spectrum-analysis" | "wide-compare";
  activeDock: "analysis" | "stems" | "notes" | "compare" | "hidden";
  gridEnabled: boolean;
  bpm: number;
  beatOffsetMs: number;
  playbackRate: number;
  loopRange?: LoopRange;
  spectrogramViewport?: WorkspaceSpectrogramViewport;
}

export interface ProjectSummary {
  id: ProjectId;
  name: string;
  sourceAudio: SourceAudio;
  assets: DerivedAudioAsset[];
  analysisRuns: AnalysisRun[];
  annotations: TimelineAnnotation[];
  workspace: WorkspaceState;
}
