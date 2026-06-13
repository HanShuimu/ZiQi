import { useCallback, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type {
  PitchEnergyOverview,
  PitchHeatmapDisplaySettings,
  SpectrogramOverview,
  WaveformOverview
} from "../../core/audio/types";
import {
  DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
  PITCH_HEATMAP_MIN_HEIGHT_PX
} from "../../core/audio/pitchHeatmap";
import {
  isTimeInsideViewport,
  panSpectrogramViewport,
  timeToViewportPercent,
  zoomSpectrogramViewport
} from "../../core/spectrogramViewport";
import type { SpectrogramViewport } from "../../core/spectrogramViewport";
import {
  filterPitchEnergyFramesForViewport,
  filterWaveformPointsForViewport
} from "./spectrogramViewport";
import { SpectrogramTimelineNavigator } from "../../capabilities/timelineViewport";
import {
  createBarGridLines,
  createTimeGridLines,
  getRenderedWaveformPoints
} from "./spectrogramModel";
import { convertSpectrogramToPitchEnergy } from "./pitchEnergyAdapter";
import { PitchAxis } from "./PitchAxis";
import { PitchHeatmapCanvas } from "./PitchHeatmapCanvas";
import { SpectrogramHoverStatus } from "./SpectrogramHoverStatus";
import { SpectrogramOverlayLayer } from "./SpectrogramOverlayLayer";
import { WaveformStrip } from "./WaveformStrip";
import { usePitchHover } from "./usePitchHover";
import { useSpectrogramViewport } from "./useSpectrogramViewport";

const SPECTROGRAM_VIEW_STYLE = {
  "--spectrogram-display-height": `${PITCH_HEATMAP_MIN_HEIGHT_PX}px`
} as CSSProperties;

function getViewportResetKey(durationMs: number, pitchEnergyOverview: PitchEnergyOverview | null | undefined) {
  return `${durationMs}:${pitchEnergyOverview?.durationMs ?? "none"}`;
}

interface SpectrogramViewProps {
  beatOffsetMs?: number;
  beatsPerBar?: number;
  bpm?: number;
  currentTimeMs: number;
  durationMs: number;
  loopRange: { startMs: number; endMs: number } | undefined;
  pitchEnergyOverview?: PitchEnergyOverview | null | undefined;
  pitchHeatmapDisplay?: PitchHeatmapDisplaySettings;
  spectrogramOverview?: SpectrogramOverview | null | undefined;
  viewport?: SpectrogramViewport;
  waveformOverview: WaveformOverview | null | undefined;
  onSeek: (timeMs: number) => Promise<void> | void;
  onViewportChange: (viewport: SpectrogramViewport) => void;
}

export function SpectrogramView({
  beatOffsetMs = 0,
  beatsPerBar = 4,
  bpm = 120,
  currentTimeMs,
  durationMs,
  loopRange,
  pitchEnergyOverview,
  pitchHeatmapDisplay = DEFAULT_PITCH_HEATMAP_DISPLAY_SETTINGS,
  spectrogramOverview,
  viewport: controlledViewport,
  waveformOverview,
  onSeek,
  onViewportChange
}: SpectrogramViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePitchEnergyOverview = pitchEnergyOverview ?? convertSpectrogramToPitchEnergy(spectrogramOverview);
  const viewportResetKey = getViewportResetKey(durationMs, activePitchEnergyOverview);
  const { activeViewport, updateViewport } = useSpectrogramViewport({
    controlledViewport,
    durationMs,
    onViewportChange,
    resetKey: viewportResetKey
  });

  const visibleWaveformPoints = useMemo(
    () => filterWaveformPointsForViewport(waveformOverview, activeViewport),
    [activeViewport, waveformOverview]
  );
  const renderedWaveformPoints = useMemo(
    () => getRenderedWaveformPoints(visibleWaveformPoints),
    [visibleWaveformPoints]
  );
  const isPlaybackVisible = isTimeInsideViewport(currentTimeMs, activeViewport);
  const progressPercent = isPlaybackVisible ? timeToViewportPercent(currentTimeMs, activeViewport) : 0;
  const timeGridLines = useMemo(() => createTimeGridLines(activeViewport), [activeViewport]);
  const barGridLines = useMemo(
    () => createBarGridLines(activeViewport, { beatOffsetMs, beatsPerBar, bpm }),
    [activeViewport, beatOffsetMs, beatsPerBar, bpm]
  );
  const hasPitchFrames =
    activePitchEnergyOverview !== null &&
    activePitchEnergyOverview !== undefined &&
    activePitchEnergyOverview.frames.length > 0;

  const visibleFrames = useMemo(
    () =>
      hasPitchFrames
        ? filterPitchEnergyFramesForViewport(activePitchEnergyOverview, activeViewport)
        : [],
    [hasPitchFrames, activePitchEnergyOverview, activeViewport]
  );
  const {
    handleSpectrogramPointerLeave,
    handleSpectrogramPointerMove,
    pointerState
  } = usePitchHover({
    activeViewport,
    canvasRef,
    hasPitchFrames
  });
  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  function handleSpectrogramWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (durationMs <= 0) {
      return;
    }

    if (event.ctrlKey) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      const anchorRatio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0.5;

      updateViewport(
        zoomSpectrogramViewport({
          viewport: activeViewport,
          totalDurationMs: durationMs,
          anchorRatio,
          deltaY: event.deltaY
        })
      );
      return;
    }

    if (event.deltaX !== 0) {
      event.preventDefault();
      updateViewport(
        panSpectrogramViewport({
          viewport: activeViewport,
          totalDurationMs: durationMs,
          direction: Math.sign(event.deltaX)
        })
      );
    }
  }

  return (
    <div className="spectrogram-view" style={SPECTROGRAM_VIEW_STYLE}>
      <SpectrogramHoverStatus pointerState={pointerState} />
      <div className="spectrogram-time-grid">
        <div className="spectrogram-axis-spacer" />
        <WaveformStrip
          isPlaybackVisible={isPlaybackVisible}
          progressPercent={progressPercent}
          renderedWaveformPoints={renderedWaveformPoints}
        />

        <div className="spectrogram-body">
          <PitchAxis pointerState={pointerState} />

          <div
            className="spectrogram-canvas-frame"
            onPointerLeave={handleSpectrogramPointerLeave}
            onPointerMove={handleSpectrogramPointerMove}
            onWheel={handleSpectrogramWheel}
          >
            <PitchHeatmapCanvas
              hasPitchFrames={hasPitchFrames}
              onCanvasReady={handleCanvasReady}
              pitchHeatmapDisplay={pitchHeatmapDisplay}
              visibleFrames={visibleFrames}
            />
            {!hasPitchFrames ? (
              <div className="spectrogram-empty">Generating pitch heatmap...</div>
            ) : null}
            <SpectrogramOverlayLayer
              barGridLines={barGridLines}
              isPlaybackVisible={isPlaybackVisible}
              pointerState={pointerState}
              progressPercent={progressPercent}
              timeGridLines={timeGridLines}
            />
          </div>
        </div>

        <div className="spectrogram-axis-spacer" />
        <div className="spectrogram-navigator-row">
          <SpectrogramTimelineNavigator
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            hoverTimeMs={pointerState?.timeMs}
            loopRange={loopRange}
            onSeek={onSeek}
            onViewportChange={updateViewport}
            viewport={activeViewport}
          />
        </div>
      </div>
    </div>
  );
}
