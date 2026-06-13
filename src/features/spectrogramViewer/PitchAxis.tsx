import { PIANO_KEYS } from "../../services/audio/spectrogram";
import {
  getPitchLaneCssProperties,
  type HeatmapPointerState
} from "./pitchHover";

interface PitchAxisProps {
  pointerState: HeatmapPointerState | null;
}

export function PitchAxis({ pointerState }: PitchAxisProps) {
  return (
    <div className="piano-axis" aria-label="Piano pitch axis">
      {PIANO_KEYS.map((key, index) => {
        const laneStyle = getPitchLaneCssProperties(index);
        const bottomPercent = Number.parseFloat(laneStyle.bottom);
        const isActiveKey = pointerState?.midiNumber === key.midiNumber;

        return (
          <div
            key={key.midiNumber}
            className={
              `${key.isBlackKey ? "piano-key piano-key-black" : "piano-key piano-key-white"}${isActiveKey ? " piano-key-active" : ""}`
            }
            data-bottom-percent={bottomPercent}
            data-log-position={index / (PIANO_KEYS.length - 1)}
            data-testid="piano-key"
            style={laneStyle}
            title={key.name}
          />
        );
      })}
    </div>
  );
}
