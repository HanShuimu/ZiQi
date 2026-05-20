import { clampSpectrogramViewport, createDefaultSpectrogramViewport } from "../../core/spectrogramViewport";
import type { LoopRange, WorkspaceState } from "../project/types";

export const SUPPORTED_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;
type SupportedPlaybackRate = (typeof SUPPORTED_PLAYBACK_RATES)[number];

const DEFAULT_WORKSPACE_BASE = {
  preset: "pure-spectrum",
  activeDock: "analysis",
  gridEnabled: true,
  bpm: 120,
  beatOffsetMs: 0,
  playbackRate: 1
} as const;

export function createDefaultWorkspaceState(durationMs: number): WorkspaceState {
  return {
    ...DEFAULT_WORKSPACE_BASE,
    spectrogramViewport: createDefaultSpectrogramViewport(durationMs)
  };
}

export function normalizeWorkspaceState(
  workspace: Partial<WorkspaceState> | Record<string, unknown>,
  durationMs: number
): WorkspaceState {
  const defaultWorkspace = createDefaultWorkspaceState(durationMs);

  return {
    preset: isPreset(workspace.preset) ? workspace.preset : defaultWorkspace.preset,
    activeDock: isActiveDock(workspace.activeDock) ? workspace.activeDock : defaultWorkspace.activeDock,
    gridEnabled: typeof workspace.gridEnabled === "boolean" ? workspace.gridEnabled : defaultWorkspace.gridEnabled,
    bpm: finiteOrDefault(workspace.bpm, defaultWorkspace.bpm),
    beatOffsetMs: finiteOrDefault(workspace.beatOffsetMs, defaultWorkspace.beatOffsetMs),
    playbackRate: isSupportedPlaybackRate(workspace.playbackRate)
      ? workspace.playbackRate
      : defaultWorkspace.playbackRate,
    ...normalizeLoopRange(workspace.loopRange, durationMs),
    spectrogramViewport: normalizeSpectrogramViewport(
      workspace.spectrogramViewport,
      durationMs,
      defaultWorkspace.spectrogramViewport
    )
  };
}

function finiteOrDefault(value: unknown, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function isSupportedPlaybackRate(value: unknown): value is SupportedPlaybackRate {
  return SUPPORTED_PLAYBACK_RATES.includes(value as SupportedPlaybackRate);
}

function isPreset(value: unknown): value is WorkspaceState["preset"] {
  return value === "pure-spectrum" || value === "spectrum-analysis" || value === "wide-compare";
}

function isActiveDock(value: unknown): value is WorkspaceState["activeDock"] {
  return value === "analysis" || value === "stems" || value === "notes" || value === "compare" || value === "hidden";
}

function normalizeLoopRange(value: unknown, durationMs: number): Pick<WorkspaceState, "loopRange"> {
  if (!isLoopRange(value) || !Number.isFinite(durationMs) || durationMs <= 0) {
    return {};
  }

  const startMs = Math.min(durationMs, Math.max(0, Math.round(value.startMs)));
  const endMs = Math.min(durationMs, Math.max(0, Math.round(value.endMs)));
  if (endMs <= startMs) {
    return {};
  }

  return { loopRange: { startMs, endMs } };
}

function normalizeSpectrogramViewport(
  value: unknown,
  durationMs: number,
  fallback: WorkspaceState["spectrogramViewport"]
) {
  if (!isSpectrogramViewport(value)) {
    return fallback;
  }

  return clampSpectrogramViewport(value, durationMs);
}

function isLoopRange(value: unknown): value is LoopRange {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isFinite((value as LoopRange).startMs) &&
    Number.isFinite((value as LoopRange).endMs)
  );
}

function isSpectrogramViewport(value: unknown): value is NonNullable<WorkspaceState["spectrogramViewport"]> {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isFinite((value as NonNullable<WorkspaceState["spectrogramViewport"]>).startMs) &&
    Number.isFinite((value as NonNullable<WorkspaceState["spectrogramViewport"]>).durationMs)
  );
}
