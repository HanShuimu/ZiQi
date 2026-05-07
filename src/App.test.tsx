import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

class FakeAudioElement {
  static instances: FakeAudioElement[] = [];

  currentTime = 0;
  duration = 12;
  playbackRate = 1;
  preservesPitch = false;
  src = "";

  constructor() {
    FakeAudioElement.instances.push(this);
  }

  async play() {}

  pause() {}

  load() {}
}

describe("App local audio import", () => {
  beforeEach(() => {
    FakeAudioElement.instances = [];
    const audioData = new ArrayBuffer(8);

    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: {
        getVersion: vi.fn().mockResolvedValue("test-version"),
        readAudioFile: vi.fn().mockResolvedValue(audioData),
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
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.readAudioFile = vi.fn().mockResolvedValue(audioData);
    const waveformService = {
      buildOverview: vi.fn(),
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
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
    expect(window.ziqiApp.readAudioFile).toHaveBeenCalledWith(
      "D:\\Music Library\\demo track.wav"
    );
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenCalledWith(audioData);
    expect(waveformService.buildOverview).not.toHaveBeenCalled();
  });

  it("does nothing when file selection is canceled", async () => {
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverview: vi.fn(),
      buildOverviewFromAudioData: vi.fn()
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(window.ziqiApp.readAudioFile).not.toHaveBeenCalled();
    expect(waveformService.buildOverviewFromAudioData).not.toHaveBeenCalled();
  });

  it("shows a stable error when waveform decoding fails", async () => {
    const waveformService = {
      buildOverview: vi.fn(),
      buildOverviewFromAudioData: vi
        .fn()
        .mockRejectedValue(new Error("Failed to decode audio waveform."))
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to decode audio waveform.")).toBeTruthy();
    });
    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("");
  });

  it("keeps the current project and shows a stable error when a later import fails", async () => {
    const firstAudioData = new ArrayBuffer(8);
    const secondAudioData = new ArrayBuffer(16);
    window.ziqiApp.selectAudioFile = vi
      .fn()
      .mockResolvedValueOnce({
        filePath: "D:\\Music Library\\demo track.wav"
      })
      .mockResolvedValueOnce({
        filePath: "D:\\Music Library\\broken track.wav"
      });
    window.ziqiApp.readAudioFile = vi
      .fn()
      .mockResolvedValueOnce(firstAudioData)
      .mockResolvedValueOnce(secondAudioData);
    const waveformService = {
      buildOverview: vi.fn(),
      buildOverviewFromAudioData: vi
        .fn()
        .mockResolvedValueOnce({
          pointsPerSecond: 50,
          durationMs: 12_000,
          points: [
            { startMs: 0, endMs: 20, peak: 0.2 },
            { startMs: 20, endMs: 40, peak: 0.8 }
          ]
        })
        .mockRejectedValueOnce(new Error("Failed to decode audio waveform."))
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(FakeAudioElement.instances[0].src).toBe(
      "file:///D:/Music%20Library/demo%20track.wav"
    );
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenLastCalledWith(firstAudioData);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to decode audio waveform.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe(
      "file:///D:/Music%20Library/demo%20track.wav"
    );
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenLastCalledWith(secondAudioData);
  });

  it("keeps the current project and shows a stable error when media loading fails", async () => {
    class ErrorLoadingAudioElement extends FakeAudioElement {
      override duration = Number.NaN;
      private listeners = new Map<string, Set<() => void>>();

      addEventListener(type: string, listener: () => void) {
        const listeners = this.listeners.get(type) ?? new Set<() => void>();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(type: string, listener: () => void) {
        this.listeners.get(type)?.delete(listener);
      }

      override load() {
        queueMicrotask(() => {
          for (const listener of this.listeners.get("error") ?? []) {
            listener();
          }
        });
      }
    }

    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: ErrorLoadingAudioElement
    });
    const waveformService = {
      buildOverview: vi.fn(),
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.2 }]
      })
    };
    const user = userEvent.setup();

    render(<App waveformService={waveformService} />);

    await user.click(screen.getAllByRole("button", { name: "Import Audio" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to load audio file.")).toBeTruthy();
    });
    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("");
  });
});
