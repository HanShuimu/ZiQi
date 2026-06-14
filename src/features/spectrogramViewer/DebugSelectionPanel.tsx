import type {
  PitchEnergyFrame,
  PitchEnergyOverview,
  SpectrogramFrame,
  SpectrogramOverview
} from "../../core/audio/types";
import type { ProjectSummary, SelectedTimeRange } from "../../core/project/types";
import { Button, Panel } from "../../ui";
import { describeSelectedRangeForLlm } from "./selectedRangeSummary";

interface DebugSelectionPanelProps {
  isOpen: boolean;
  project: ProjectSummary | null;
  pitchEnergyOverview?: PitchEnergyOverview | null;
  spectrogramOverview?: SpectrogramOverview | null;
  onClose: () => void;
}

export function DebugSelectionPanel({
  isOpen,
  project,
  pitchEnergyOverview,
  spectrogramOverview,
  onClose
}: DebugSelectionPanelProps) {
  if (!isOpen) {
    return null;
  }

  const selectedTimeRange = project?.workspace.selectedTimeRange;
  const rangeLabel = selectedTimeRange ? formatRangeLabel(selectedTimeRange) : null;
  const hasAnalysis = selectedTimeRange
    ? hasOverlappingFrames(pitchEnergyOverview?.frames ?? [], selectedTimeRange) ||
      hasOverlappingFrames(spectrogramOverview?.frames ?? [], selectedTimeRange)
    : false;
  const description =
    project && selectedTimeRange && hasAnalysis
      ? describeSelectedRangeForLlm({
          projectName: project.name,
          audioName: project.sourceAudio.name,
          selectedTimeRange,
          beatSettings: {
            bpm: project.workspace.bpm,
            beatsPerBar: project.workspace.beatsPerBar,
            beatOffsetMs: project.workspace.beatOffsetMs
          },
          pitchEnergyOverview,
          spectrogramOverview
        })
      : null;
  const jsonText = description ? JSON.stringify(description.json, null, 2) : null;
  const status = getStatusText({ project, selectedTimeRange, hasAnalysis, rangeLabel });

  return (
    <Panel className="debug-selection-panel">
      <div className="debug-selection-header">
        <div>
          <div className="section-label">Debug Selection</div>
          <p className="debug-selection-status">{status}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      {rangeLabel && status !== `Selected range ${rangeLabel}` ? (
        <p className="debug-selection-range">{rangeLabel}</p>
      ) : null}
      {description && jsonText ? (
        <>
          <div className="debug-selection-actions">
            <Button size="sm" onClick={() => copyText(description.text)}>
              Copy Text
            </Button>
            <Button size="sm" onClick={() => copyText(jsonText)}>
              Copy JSON
            </Button>
          </div>
          <div className="debug-selection-output">
            <section>
              <h3>Natural Language</h3>
              <p>{description.text}</p>
            </section>
            <section>
              <h3>Structured JSON</h3>
              <pre>{jsonText}</pre>
            </section>
          </div>
        </>
      ) : null}
    </Panel>
  );
}

function getStatusText({
  project,
  selectedTimeRange,
  hasAnalysis,
  rangeLabel
}: {
  project: ProjectSummary | null;
  selectedTimeRange: SelectedTimeRange | undefined;
  hasAnalysis: boolean;
  rangeLabel: string | null;
}) {
  if (!project) {
    return "Please open a project first.";
  }

  if (!selectedTimeRange) {
    return "Please select a time range first.";
  }

  if (!hasAnalysis) {
    return "analysis unavailable";
  }

  return `Selected range ${rangeLabel}`;
}

function hasOverlappingFrames(
  frames: Array<Pick<PitchEnergyFrame | SpectrogramFrame, "startMs" | "endMs">>,
  selectedTimeRange: SelectedTimeRange
) {
  return frames.some(
    (frame) =>
      frame.endMs > selectedTimeRange.startMs && frame.startMs < selectedTimeRange.endMs
  );
}

function formatRangeLabel(selectedTimeRange: SelectedTimeRange) {
  return `${formatSeconds(selectedTimeRange.startMs)}-${formatSeconds(selectedTimeRange.endMs)}`;
}

function formatSeconds(timeMs: number) {
  return (timeMs / 1000).toFixed(3);
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value).catch(() => {});
}
