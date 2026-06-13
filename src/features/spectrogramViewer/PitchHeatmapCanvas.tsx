import { useCallback, useEffect, useRef } from "react";
import type {
  PitchEnergyOverview,
  PitchHeatmapDisplaySettings
} from "../../core/audio/types";
import {
  PITCH_HEATMAP_MIN_HEIGHT_PX,
  PITCH_HEATMAP_MIN_LANE_HEIGHT_PX,
  PITCH_HEATMAP_NOTE_COUNT,
  mapPitchEnergyToDisplayValue
} from "../../core/audio/pitchHeatmap";
import { magnitudeToSpectrogramColor } from "../../services/audio/spectrogram";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = PITCH_HEATMAP_MIN_HEIGHT_PX;

interface PitchHeatmapCanvasProps {
  hasPitchFrames: boolean;
  pitchHeatmapDisplay: PitchHeatmapDisplaySettings;
  visibleFrames: PitchEnergyOverview["frames"];
  onCanvasReady(canvas: HTMLCanvasElement | null): void;
}

export function PitchHeatmapCanvas({
  hasPitchFrames,
  pitchHeatmapDisplay,
  visibleFrames,
  onCanvasReady
}: PitchHeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      canvasRef.current = canvas;
      onCanvasReady(canvas);
    },
    [onCanvasReady]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !hasPitchFrames) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgb(0, 0, 0)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const renderedColumnCount = Math.min(canvas.width, visibleFrames.length);
    if (renderedColumnCount <= 0) {
      return;
    }

    const frameWidth = canvas.width / renderedColumnCount;
    const laneHeight = PITCH_HEATMAP_MIN_LANE_HEIGHT_PX;

    for (let columnIndex = 0; columnIndex < renderedColumnCount; columnIndex += 1) {
      const startFrameIndex = Math.floor(
        (columnIndex * visibleFrames.length) / renderedColumnCount
      );
      const endFrameIndex = Math.max(
        startFrameIndex + 1,
        Math.floor(((columnIndex + 1) * visibleFrames.length) / renderedColumnCount)
      );

      for (let pitchIndex = 0; pitchIndex < PITCH_HEATMAP_NOTE_COUNT; pitchIndex += 1) {
        const energy = getMaxEnergyForColumn(
          visibleFrames,
          startFrameIndex,
          endFrameIndex,
          pitchIndex
        );
        const displayValue = mapPitchEnergyToDisplayValue(energy, pitchHeatmapDisplay);
        context.fillStyle = magnitudeToSpectrogramColor(displayValue);
        context.fillRect(
          columnIndex * frameWidth,
          canvas.height - (pitchIndex + 1) * laneHeight,
          Math.ceil(frameWidth),
          laneHeight
        );
      }
    }
  }, [hasPitchFrames, pitchHeatmapDisplay, visibleFrames]);

  return (
    <canvas
      aria-label="Pitch heatmap"
      className="spectrogram-canvas"
      height={CANVAS_HEIGHT}
      ref={handleCanvasRef}
      role="img"
      width={CANVAS_WIDTH}
    />
  );
}

function getMaxEnergyForColumn(
  frames: PitchEnergyOverview["frames"],
  startFrameIndex: number,
  endFrameIndex: number,
  pitchIndex: number
) {
  let maxEnergy = 0;

  for (let frameIndex = startFrameIndex; frameIndex < endFrameIndex; frameIndex += 1) {
    maxEnergy = Math.max(maxEnergy, frames[frameIndex]?.energies[pitchIndex] ?? 0);
  }

  return maxEnergy;
}
