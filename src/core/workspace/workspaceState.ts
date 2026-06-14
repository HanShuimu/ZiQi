import { clampSpectrogramViewport, createDefaultSpectrogramViewport } from "../../core/spectrogramViewport";
import type { WorkspaceState } from "../project/types";
import { normalizeSelectedTimeRange } from "./selectedTimeRange";

export const SUPPORTED_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;
type SupportedPlaybackRate = (typeof SUPPORTED_PLAYBACK_RATES)[number];

// Keep these compatibility defaults stable for older project payloads even
// when the focused workbench does not render docks or preset controls.
const DEFAULT_WORKSPACE_BASE = {
  preset: "pure-spectrum",
  activeDock: "analysis",
  gridEnabled: true,
  beatsPerBar: 4,
  bpm: 120,
  beatOffsetMs: 0,
  playbackRate: 1,
  loopEnabled: false
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
  const selectedTimeRange = normalizeSelectedTimeRange(workspace.selectedTimeRange, durationMs);
  const loopEnabled = selectedTimeRange
    ? typeof workspace.loopEnabled === "boolean" && workspace.loopEnabled
    : false;

  return {
    preset: isPreset(workspace.preset) ? workspace.preset : defaultWorkspace.preset,
    activeDock: isActiveDock(workspace.activeDock) ? workspace.activeDock : defaultWorkspace.activeDock,
    gridEnabled: typeof workspace.gridEnabled === "boolean" ? workspace.gridEnabled : defaultWorkspace.gridEnabled,
    beatsPerBar: positiveIntegerOrDefault(workspace.beatsPerBar, defaultWorkspace.beatsPerBar),
    bpm: positiveIntegerOrDefault(workspace.bpm, defaultWorkspace.bpm),
    beatOffsetMs: finiteIntegerOrDefault(workspace.beatOffsetMs, defaultWorkspace.beatOffsetMs),
    playbackRate: isSupportedPlaybackRate(workspace.playbackRate)
      ? workspace.playbackRate
      : defaultWorkspace.playbackRate,
    selectedTimeRange,
    loopEnabled,
    spectrogramViewport: normalizeSpectrogramViewport(
      workspace.spectrogramViewport,
      durationMs,
      defaultWorkspace.spectrogramViewport
    )
  };
}

function positiveIntegerOrDefault(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const roundedValue = Math.round(value);
  return roundedValue > 0 ? roundedValue : fallback;
}

function finiteIntegerOrDefault(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.round(value);
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

function isSpectrogramViewport(value: unknown): value is NonNullable<WorkspaceState["spectrogramViewport"]> {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isFinite((value as NonNullable<WorkspaceState["spectrogramViewport"]>).startMs) &&
    Number.isFinite((value as NonNullable<WorkspaceState["spectrogramViewport"]>).durationMs)
  );
}
