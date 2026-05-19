import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { SpectrogramOverview, WaveformOverview } from "./domain/audio/types";
import type { ProjectSummary } from "./domain/project/types";

class FakeAudioElement {
  static instances: FakeAudioElement[] = [];
  static currentTimeWrites = 0;
  static throwOnCurrentTimeWrite: number | null = null;

  duration = 12;
  playbackRate = 1;
  preservesPitch = false;
  src = "";
  private currentTimeValue = 0;

  constructor() {
    FakeAudioElement.instances.push(this);
  }

  get currentTime() {
    return this.currentTimeValue;
  }

  set currentTime(time: number) {
    FakeAudioElement.currentTimeWrites += 1;
    if (FakeAudioElement.throwOnCurrentTimeWrite === FakeAudioElement.currentTimeWrites) {
      throw new Error("Failed to seek audio.");
    }
    this.currentTimeValue = time;
  }

  async play() {}

  pause() {}

  load() {}
}

let menuCommandListener:
  | ((
      command:
        | "open-project"
        | "save-project"
        | "import-audio"
        | "set-skin-default"
        | "set-skin-animal-island"
    ) => void)
  | null;

describe("App local audio import", () => {
  beforeEach(() => {
    menuCommandListener = null;
    FakeAudioElement.instances = [];
    FakeAudioElement.currentTimeWrites = 0;
    FakeAudioElement.throwOnCurrentTimeWrite = null;
    const audioData = new ArrayBuffer(8);
    let objectUrlIndex = 0;

    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: {
        activateOpenedProject: vi.fn().mockResolvedValue(undefined),
        getVersion: vi.fn().mockResolvedValue("test-version"),
        openProject: vi.fn().mockResolvedValue(null),
        saveProject: vi.fn().mockResolvedValue(null),
        selectAudioFile: vi.fn().mockResolvedValue({
          audioData,
          filePath: "D:\\Music Library\\demo track.wav"
        }),
        onMenuCommand: vi.fn((listener) => {
          menuCommandListener = listener;
          return () => {
            if (menuCommandListener === listener) {
              menuCommandListener = null;
            }
          };
        }),
        getUserSettings: vi.fn().mockResolvedValue({ uiSkin: "default" }),
        updateUserSettings: vi.fn().mockResolvedValue({ uiSkin: "default" })
      }
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        objectUrlIndex += 1;
        return `blob:audio-${objectUrlIndex}`;
      })
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });

    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: FakeAudioElement
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: ""
      }))
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates a project and shows waveform data after importing audio", async () => {
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [
          { startMs: 0, endMs: 20, peak: 0.2 },
          { startMs: 20, endMs: 40, peak: 0.8 }
        ]
      })
    };
    const spectrogramService = createSpectrogramService();
    renderApp({ waveformService, spectrogramService });

    menuCommandListener?.("import-audio");

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(screen.getByLabelText("Audio waveform overview")).toBeTruthy();
    expect(screen.getByLabelText("Audio spectrogram")).toBeTruthy();
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenCalledWith(audioData);
    const [spectrogramAudioData] = spectrogramService.buildOverviewFromAudioData.mock.calls[0];
    expect(spectrogramAudioData).toBeInstanceOf(ArrayBuffer);
    expect(spectrogramAudioData).not.toBe(audioData);
    expect(spectrogramAudioData.byteLength).toBe(audioData.byteLength);
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
  });

  it("revokes the current playback URL after a successful import unmounts", async () => {
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    const { unmount } = renderApp({ waveformService });

    menuCommandListener?.("import-audio");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audio-1");
  });

  it("creates the playback blob before waveform decoding can detach the audio data", async () => {
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockImplementation(async (receivedAudioData) => {
        structuredClone(receivedAudioData, { transfer: [receivedAudioData] });
        return {
          pointsPerSecond: 50,
          durationMs: 12_000,
          points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
        };
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ size: 8 }));
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
  });

  it("does nothing when file selection is canceled", async () => {
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverviewFromAudioData: vi.fn()
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");

    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(waveformService.buildOverviewFromAudioData).not.toHaveBeenCalled();
  });

  it("shows a stable error when selected file bytes cannot be loaded", async () => {
    window.ziqiApp.selectAudioFile = vi
      .fn()
      .mockRejectedValue(new Error("Failed to load audio file."));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn()
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");

    await waitFor(() => {
      expect(screen.getByText("Failed to load audio file.")).toBeTruthy();
    });
    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(waveformService.buildOverviewFromAudioData).not.toHaveBeenCalled();
    expect(FakeAudioElement.instances[0].src).toBe("");
  });

  it("shows a stable error when waveform decoding fails", async () => {
    const waveformService = {
      buildOverviewFromAudioData: vi
        .fn()
        .mockRejectedValue(new Error("Failed to decode audio waveform."))
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");

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
        audioData: firstAudioData,
        filePath: "D:\\Music Library\\demo track.wav"
      })
      .mockResolvedValueOnce({
        audioData: secondAudioData,
        filePath: "D:\\Music Library\\broken track.wav"
      });
    const waveformService = {
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
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenLastCalledWith(firstAudioData);

    menuCommandListener?.("import-audio");

    await waitFor(() => {
      expect(screen.getByText("Failed to decode audio waveform.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenLastCalledWith(secondAudioData);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audio-2");
  });

  it("keeps the current project and shows a stable error when spectrogram generation fails", async () => {
    const firstAudioData = new ArrayBuffer(8);
    const secondAudioData = new ArrayBuffer(16);
    window.ziqiApp.selectAudioFile = vi
      .fn()
      .mockResolvedValueOnce({
        audioData: firstAudioData,
        filePath: "D:\\Music Library\\demo track.wav"
      })
      .mockResolvedValueOnce({
        audioData: secondAudioData,
        filePath: "D:\\Music Library\\broken track.wav"
      });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue(createWaveformOverview())
    };
    const spectrogramService = createSpectrogramService({
      buildOverviewFromAudioData: vi
        .fn()
        .mockResolvedValueOnce(createSpectrogramOverview())
        .mockRejectedValueOnce(new Error("Failed to generate spectrogram."))
    });
    renderApp({ waveformService, spectrogramService });

    menuCommandListener?.("import-audio");

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");

    menuCommandListener?.("import-audio");

    await waitFor(() => {
      expect(screen.getByText("Failed to generate spectrogram.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenLastCalledWith(secondAudioData);
    const [spectrogramAudioData] = spectrogramService.buildOverviewFromAudioData.mock.calls[1];
    expect(spectrogramAudioData).toBeInstanceOf(ArrayBuffer);
    expect(spectrogramAudioData).not.toBe(secondAudioData);
    expect(spectrogramAudioData.byteLength).toBe(secondAudioData.byteLength);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audio-2");
  });

  it("keeps the current project and shows a stable error when a later selected file cannot be loaded", async () => {
    const firstAudioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi
      .fn()
      .mockResolvedValueOnce({
        audioData: firstAudioData,
        filePath: "D:\\Music Library\\demo track.wav"
      })
      .mockRejectedValueOnce(new Error("Failed to load audio file."));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [
          { startMs: 0, endMs: 20, peak: 0.2 },
          { startMs: 20, endMs: 40, peak: 0.8 }
        ]
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");

    menuCommandListener?.("import-audio");

    await waitFor(() => {
      expect(screen.getByText("Failed to load audio file.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenCalledOnce();
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
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.2 }]
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");

    await waitFor(() => {
      expect(screen.getByText("Failed to load audio file.")).toBeTruthy();
    });
    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audio-1");
  });

  it("saves an imported project and updates it to project audio path", async () => {
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    window.ziqiApp.saveProject = vi.fn().mockImplementation(async (request) => ({
      project: {
        ...request.project,
        sourceAudio: {
          ...request.project.sourceAudio,
          filePath: "audio/demo track.wav"
        }
      },
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    }));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    menuCommandListener?.("save-project");

    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledOnce();
    });
    expect(window.ziqiApp.saveProject).toHaveBeenCalledWith({
      project: expect.objectContaining({
        sourceAudio: expect.objectContaining({
          filePath: "D:\\Music Library\\demo track.wav"
        })
      })
    });
  });

  it("keeps the imported project unchanged when save is canceled", async () => {
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    window.ziqiApp.saveProject = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    menuCommandListener?.("save-project");
    menuCommandListener?.("save-project");

    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(screen.queryByText("Failed to save project.")).toBeNull();
    expect(window.ziqiApp.saveProject).toHaveBeenNthCalledWith(1, {
      project: expect.objectContaining({
        sourceAudio: expect.objectContaining({
          filePath: "D:\\Music Library\\demo track.wav"
        })
      })
    });
    expect(window.ziqiApp.saveProject).toHaveBeenNthCalledWith(2, {
      project: expect.objectContaining({
        sourceAudio: expect.objectContaining({
          filePath: "D:\\Music Library\\demo track.wav"
        })
      })
    });
  });

  it("saves an already saved project using existing location", async () => {
    const openedAudioData = new ArrayBuffer(8);
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: createProjectSummary("audio/demo track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
    window.ziqiApp.saveProject = vi.fn().mockImplementation(async (request) => ({
      project: request.project,
      projectFilePath: request.projectFilePath,
      projectRootPath: request.projectRootPath
    }));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("open-project");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    menuCommandListener?.("save-project");

    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledOnce();
    });
    expect(window.ziqiApp.saveProject).toHaveBeenCalledWith({
      project: expect.objectContaining({
        sourceAudio: expect.objectContaining({
          filePath: "audio/demo track.wav"
        })
      }),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
  });

  it("keeps the opened project and existing location when save fails", async () => {
    const openedAudioData = new ArrayBuffer(8);
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: createProjectSummary("audio/demo track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
    window.ziqiApp.saveProject = vi
      .fn()
      .mockRejectedValue(new Error("Failed to write project."));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("open-project");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    menuCommandListener?.("save-project");
    await waitFor(() => {
      expect(screen.getByText("Failed to write project.")).toBeTruthy();
    });

    menuCommandListener?.("save-project");
    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(window.ziqiApp.saveProject).toHaveBeenNthCalledWith(2, {
      project: expect.objectContaining({
        sourceAudio: expect.objectContaining({
          filePath: "audio/demo track.wav"
        })
      }),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
  });

  it("drops the opened project location when importing new audio before saving", async () => {
    const openedAudioData = new ArrayBuffer(8);
    const importedAudioData = new ArrayBuffer(16);
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: createProjectSummary("audio/demo track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData: importedAudioData,
      filePath: "D:\\Music Library\\fresh take.wav"
    });
    window.ziqiApp.saveProject = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("open-project");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    menuCommandListener?.("import-audio");
    await waitFor(() => {
      expect(screen.getByText("fresh take")).toBeTruthy();
    });

    menuCommandListener?.("save-project");
    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledOnce();
    });
    expect(window.ziqiApp.saveProject).toHaveBeenCalledWith({
      project: expect.objectContaining({
        sourceAudio: expect.objectContaining({
          filePath: "D:\\Music Library\\fresh take.wav"
        })
      })
    });
  });

  it("opens a saved project and rebuilds waveform data from project audio bytes", async () => {
    const openedAudioData = new ArrayBuffer(16);
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: createProjectSummary("audio/demo track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("open-project");

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenCalledWith(openedAudioData);
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(screen.getByLabelText("Audio waveform overview")).toBeTruthy();
    expect(screen.getByLabelText("Audio spectrogram")).toBeTruthy();
    expect(window.ziqiApp.activateOpenedProject).toHaveBeenCalledWith({
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
  });

  it("open cancel does nothing", async () => {
    window.ziqiApp.openProject = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverviewFromAudioData: vi.fn()
    };
    renderApp({ waveformService });

    menuCommandListener?.("open-project");

    expect(screen.getByText("No project loaded")).toBeTruthy();
    expect(waveformService.buildOverviewFromAudioData).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("open failure keeps current project and current playback URL, shows error", async () => {
    const importedAudioData = new ArrayBuffer(8);
    const openedAudioData = new ArrayBuffer(16);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData: importedAudioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: createProjectSummary("audio/broken track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Broken\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Broken"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi
        .fn()
        .mockResolvedValueOnce({
          pointsPerSecond: 50,
          durationMs: 12_000,
          points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
        })
        .mockRejectedValueOnce(new Error("Failed to decode project audio."))
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");

    menuCommandListener?.("open-project");

    await waitFor(() => {
      expect(screen.getByText("Failed to decode project audio.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(waveformService.buildOverviewFromAudioData).toHaveBeenLastCalledWith(openedAudioData);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audio-2");
    expect(window.ziqiApp.activateOpenedProject).not.toHaveBeenCalled();
  });

  it("keeps saving to the current project location when opening another project fails", async () => {
    const firstOpenedAudioData = new ArrayBuffer(8);
    const secondOpenedAudioData = new ArrayBuffer(16);
    window.ziqiApp.openProject = vi
      .fn()
      .mockResolvedValueOnce({
        audioData: firstOpenedAudioData,
        project: createProjectSummary("audio/demo track.wav"),
        projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
        projectRootPath: "D:\\ZiQi Projects\\Demo"
      })
      .mockResolvedValueOnce({
        audioData: secondOpenedAudioData,
        project: createProjectSummary("audio/broken track.wav"),
        projectFilePath: "D:\\ZiQi Projects\\Broken\\project.ziqi.json",
        projectRootPath: "D:\\ZiQi Projects\\Broken"
      });
    window.ziqiApp.saveProject = vi.fn().mockImplementation(async (request) => ({
      project: request.project,
      projectFilePath: request.projectFilePath,
      projectRootPath: request.projectRootPath
    }));
    const waveformService = {
      buildOverviewFromAudioData: vi
        .fn()
        .mockResolvedValueOnce({
          pointsPerSecond: 50,
          durationMs: 12_000,
          points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
        })
        .mockRejectedValueOnce(new Error("Failed to decode project audio."))
    };
    renderApp({ waveformService });

    menuCommandListener?.("open-project");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    menuCommandListener?.("open-project");
    await waitFor(() => {
      expect(screen.getByText("Failed to decode project audio.")).toBeTruthy();
    });

    menuCommandListener?.("save-project");
    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledOnce();
    });
    expect(window.ziqiApp.activateOpenedProject).toHaveBeenCalledTimes(1);
    expect(window.ziqiApp.saveProject).toHaveBeenCalledWith({
      project: expect.objectContaining({
        sourceAudio: expect.objectContaining({
          filePath: "audio/demo track.wav"
        })
      }),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
  });

  it("keeps the current project and location when opened project spectrogram generation fails", async () => {
    const firstOpenedAudioData = new ArrayBuffer(8);
    const secondOpenedAudioData = new ArrayBuffer(16);
    window.ziqiApp.openProject = vi
      .fn()
      .mockResolvedValueOnce({
        audioData: firstOpenedAudioData,
        project: createProjectSummary("audio/demo track.wav"),
        projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
        projectRootPath: "D:\\ZiQi Projects\\Demo"
      })
      .mockResolvedValueOnce({
        audioData: secondOpenedAudioData,
        project: createProjectSummary("audio/broken track.wav"),
        projectFilePath: "D:\\ZiQi Projects\\Broken\\project.ziqi.json",
        projectRootPath: "D:\\ZiQi Projects\\Broken"
      });
    window.ziqiApp.saveProject = vi.fn().mockImplementation(async (request) => ({
      project: request.project,
      projectFilePath: request.projectFilePath,
      projectRootPath: request.projectRootPath
    }));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue(createWaveformOverview())
    };
    const spectrogramService = createSpectrogramService({
      buildOverviewFromAudioData: vi
        .fn()
        .mockResolvedValueOnce(createSpectrogramOverview())
        .mockRejectedValueOnce(new Error("Failed to generate spectrogram."))
    });
    renderApp({ waveformService, spectrogramService });

    menuCommandListener?.("open-project");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    menuCommandListener?.("open-project");
    await waitFor(() => {
      expect(screen.getByText("Failed to generate spectrogram.")).toBeTruthy();
    });

    menuCommandListener?.("save-project");
    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledOnce();
    });
    expect(window.ziqiApp.activateOpenedProject).toHaveBeenCalledTimes(1);
    expect(window.ziqiApp.saveProject).toHaveBeenCalledWith({
      project: expect.objectContaining({
        sourceAudio: expect.objectContaining({
          filePath: "audio/demo track.wav"
        })
      }),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
  });

  it("keeps the current project and restores playback URL when open seek fails after source load", async () => {
    const importedAudioData = new ArrayBuffer(8);
    const openedAudioData = new ArrayBuffer(16);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData: importedAudioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: createProjectSummary("audio/broken track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Broken\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Broken"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");

    FakeAudioElement.throwOnCurrentTimeWrite = 2;
    menuCommandListener?.("open-project");

    await waitFor(() => {
      expect(screen.getByText("Failed to seek audio.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audio-2");
  });

  it("keeps the current project location and restores playback URL when opened project activation fails", async () => {
    const firstOpenedAudioData = new ArrayBuffer(8);
    const secondOpenedAudioData = new ArrayBuffer(16);
    window.ziqiApp.openProject = vi
      .fn()
      .mockResolvedValueOnce({
        audioData: firstOpenedAudioData,
        project: createProjectSummary("audio/demo track.wav"),
        projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
        projectRootPath: "D:\\ZiQi Projects\\Demo"
      })
      .mockResolvedValueOnce({
        audioData: secondOpenedAudioData,
        project: createProjectSummary("audio/broken track.wav"),
        projectFilePath: "D:\\ZiQi Projects\\Broken\\project.ziqi.json",
        projectRootPath: "D:\\ZiQi Projects\\Broken"
      });
    window.ziqiApp.activateOpenedProject = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error("Failed to open project."));
    window.ziqiApp.saveProject = vi.fn().mockImplementation(async (request) => ({
      project: request.project,
      projectFilePath: request.projectFilePath,
      projectRootPath: request.projectRootPath
    }));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("open-project");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");

    menuCommandListener?.("open-project");

    await waitFor(() => {
      expect(screen.getByText("Failed to open project.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audio-2");

    menuCommandListener?.("save-project");
    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledOnce();
    });
    expect(window.ziqiApp.saveProject).toHaveBeenCalledWith({
      project: expect.objectContaining({
        sourceAudio: expect.objectContaining({
          filePath: "audio/demo track.wav"
        })
      }),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
  });

  it("keeps the current project and playback URL when open project rejects", async () => {
    const importedAudioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData: importedAudioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    window.ziqiApp.openProject = vi.fn().mockRejectedValue(new Error("Failed to read project."));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue({
        pointsPerSecond: 50,
        durationMs: 12_000,
        points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
      })
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");

    menuCommandListener?.("open-project");

    await waitFor(() => {
      expect(screen.getByText("Failed to read project.")).toBeTruthy();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(FakeAudioElement.instances[0].src).toBe("blob:audio-1");
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:audio-1");
  });

  it("saves the current imported project path after a later import decode failure", async () => {
    const firstAudioData = new ArrayBuffer(8);
    const secondAudioData = new ArrayBuffer(16);
    window.ziqiApp.selectAudioFile = vi
      .fn()
      .mockResolvedValueOnce({
        audioData: firstAudioData,
        filePath: "D:\\Music Library\\demo track.wav"
      })
      .mockResolvedValueOnce({
        audioData: secondAudioData,
        filePath: "D:\\Music Library\\broken track.wav"
      });
    window.ziqiApp.saveProject = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverviewFromAudioData: vi
        .fn()
        .mockResolvedValueOnce({
          pointsPerSecond: 50,
          durationMs: 12_000,
          points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
        })
        .mockRejectedValueOnce(new Error("Failed to decode audio waveform."))
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    menuCommandListener?.("import-audio");
    await waitFor(() => {
      expect(screen.getByText("Failed to decode audio waveform.")).toBeTruthy();
    });

    menuCommandListener?.("save-project");
    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledOnce();
    });
    expect(screen.getByText("demo track")).toBeTruthy();
    expect(window.ziqiApp.saveProject).toHaveBeenCalledWith({
      project: expect.objectContaining({
        sourceAudio: expect.objectContaining({
          filePath: "D:\\Music Library\\demo track.wav"
        })
      })
    });
  });

  it("imports audio from the native menu command", async () => {
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue(createWaveformOverview())
    };

    renderApp({ waveformService });

    menuCommandListener?.("import-audio");

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(window.ziqiApp.selectAudioFile).toHaveBeenCalledOnce();
  });

  it("opens and saves projects from native menu commands", async () => {
    const openedAudioData = new ArrayBuffer(8);
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: createProjectSummary("audio/demo track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi.json",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
    window.ziqiApp.saveProject = vi.fn().mockImplementation(async (request) => ({
      project: request.project,
      projectFilePath: request.projectFilePath,
      projectRootPath: request.projectRootPath
    }));
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue(createWaveformOverview())
    };

    renderApp({ waveformService });

    menuCommandListener?.("open-project");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    menuCommandListener?.("save-project");

    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledOnce();
    });
  });

  it("saves focused workspace changes after playback rate updates", async () => {
    const audioData = new ArrayBuffer(8);
    window.ziqiApp.selectAudioFile = vi.fn().mockResolvedValue({
      audioData,
      filePath: "D:\\Music Library\\demo track.wav"
    });
    window.ziqiApp.saveProject = vi.fn().mockResolvedValue(null);
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue(createWaveformOverview())
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    await userEvent.click(screen.getByRole("button", { name: "0.75x" }));
    menuCommandListener?.("save-project");

    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledWith(expect.objectContaining({
        project: expect.objectContaining({
          workspace: expect.objectContaining({
            playbackRate: 0.75,
            spectrogramViewport: {
              startMs: 0,
              durationMs: 10_000
            }
          })
        })
      }));
    });
  });

  it("creates imported projects with no loop range and default playback rate", async () => {
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue(createWaveformOverview())
    };
    renderApp({ waveformService });

    menuCommandListener?.("import-audio");
    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    menuCommandListener?.("save-project");

    await waitFor(() => {
      expect(window.ziqiApp.saveProject).toHaveBeenCalledWith(expect.objectContaining({
        project: expect.objectContaining({
          workspace: expect.not.objectContaining({
            loopRange: expect.anything()
          })
        })
      }));
    });
  });

  it("initializes the UI skin from user settings", async () => {
    window.ziqiApp.getUserSettings = vi.fn().mockResolvedValue({ uiSkin: "animal-island" });

    renderApp({});

    await waitFor(() => {
      expect(document.querySelector('[data-skin="animal-island"]')).toBeTruthy();
    });
  });

  it("persists skin changes from native menu commands", async () => {
    window.ziqiApp.updateUserSettings = vi.fn().mockResolvedValue({ uiSkin: "animal-island" });

    renderApp({});

    menuCommandListener?.("set-skin-animal-island");

    await waitFor(() => {
      expect(window.ziqiApp.updateUserSettings).toHaveBeenCalledWith({
        uiSkin: "animal-island"
      });
    });
    expect(document.querySelector('[data-skin="animal-island"]')).toBeTruthy();
  });

  it("restores focused workspace playback state after opening a project", async () => {
    const openedAudioData = new ArrayBuffer(8);
    const openedProject = createProjectSummary("audio/demo track.wav");
    openedProject.workspace = {
      ...openedProject.workspace,
      playbackRate: 0.75,
      loopRange: {
        startMs: 1_000,
        endMs: 4_000
      },
      spectrogramViewport: {
        startMs: 2_000,
        durationMs: 5_000
      }
    };
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: openedProject,
      projectFilePath: "D:\\Projects\\demo.ziqiproject\\demo.ziqi",
      projectRootPath: "D:\\Projects\\demo.ziqiproject"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue(createWaveformOverview())
    };
    renderApp({ waveformService });

    menuCommandListener?.("open-project");

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });

    expect(FakeAudioElement.instances[0].playbackRate).toBe(0.75);
    expect(screen.getByText("Loop 0:01-0:04")).toBeTruthy();
    expect(screen.getByText("0:02-0:07")).toBeTruthy();
  });
});

function renderApp(props: Parameters<typeof App>[0]) {
  return render(<App spectrogramService={createSpectrogramService()} {...props} />);
}

function createWaveformOverview(): WaveformOverview {
  return {
    pointsPerSecond: 50,
    durationMs: 12_000,
    points: [{ startMs: 0, endMs: 20, peak: 0.8 }]
  };
}

function createSpectrogramOverview(): SpectrogramOverview {
  return {
    durationMs: 12_000,
    framesPerSecond: 24,
    minFrequencyHz: 27.5,
    maxFrequencyHz: 4186,
    binsPerFrame: 4,
    frames: [
      { startMs: 0, endMs: 42, magnitudes: [0, 0.25, 0.5, 1] },
      { startMs: 42, endMs: 84, magnitudes: [1, 0.5, 0.25, 0] }
    ]
  };
}

function createSpectrogramService(overrides?: {
  buildOverviewFromAudioData?: ReturnType<typeof vi.fn>;
}) {
  return {
    buildOverviewFromAudioData:
      overrides?.buildOverviewFromAudioData ?? vi.fn().mockResolvedValue(createSpectrogramOverview())
  };
}

function createProjectSummary(filePath: string): ProjectSummary {
  return {
    id: "project-demo",
    name: "demo track",
    sourceAudio: {
      id: "source-demo",
      name: "demo track.wav",
      durationMs: 12_000,
      sampleRate: 0,
      channelCount: 2,
      filePath
    },
    assets: [],
    analysisRuns: [],
    annotations: [],
    workspace: {
      preset: "spectrum-analysis",
      activeDock: "analysis",
      gridEnabled: true,
      bpm: 120,
      beatOffsetMs: 0,
      playbackRate: 1
    }
  };
}
