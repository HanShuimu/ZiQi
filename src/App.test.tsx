import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

class FakeAudioElement {
  currentTime = 0;
  duration = 12;
  playbackRate = 1;
  preservesPitch = false;
  src = "";

  async play() {}

  pause() {}

  load() {}
}

describe("App local audio import", () => {
  beforeEach(() => {
    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: {
        getVersion: vi.fn().mockResolvedValue("test-version"),
        selectAudioFile: vi.fn().mockResolvedValue({
          filePath: "D:\\Music Library\\demo track.wav"
        })
      }
    });

    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: FakeAudioElement
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates a project and shows waveform data after importing audio", async () => {
    const waveformService = {
      buildOverview: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [
          { startMs: 0, endMs: 20, peak: 0.2 },
          { startMs: 20, endMs: 40, peak: 0.8 }
        ]
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(screen.getByLabelText("Audio waveform")).toBeTruthy();
    expect(waveformService.buildOverview).toHaveBeenCalledWith(
      "file:///D:/Music%20Library/demo%20track.wav"
    );
  });

  it("does nothing when file selection is canceled", async () => {
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverview: vi.fn()
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(waveformService.buildOverview).not.toHaveBeenCalled();
  });

  it("shows a stable error when waveform decoding fails", async () => {
    const waveformService = {
      buildOverview: vi.fn().mockRejectedValue(new Error("Failed to decode audio waveform."))
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to decode audio waveform.")).toBeTruthy();
    });
    expect(screen.getByText("No project loaded")).toBeTruthy();
  });
});
