import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockProjectSummary } from "../../core/project/mockProject";
import { DEFAULT_USER_SETTINGS } from "../../core/userSettings/types";
import type { ZiqiPreloadApi } from "../../types/global";
import { RuntimeProvider, useAppRuntime } from ".";
import type { AppRuntime } from ".";

function RuntimeProbe() {
  const runtime = useAppRuntime();

  return <div>{runtime.kind}</div>;
}

function SettingsProbe({ onSettings }: { onSettings: (settings: unknown) => void }) {
  const runtime = useAppRuntime();

  useEffect(() => {
    void runtime.getUserSettings().then(onSettings);
  }, [runtime, onSettings]);

  return <div>{runtime.kind}</div>;
}

function RuntimeCaptureProbe({ onRuntime }: { onRuntime: (runtime: AppRuntime) => void }) {
  const runtime = useAppRuntime();

  useEffect(() => {
    onRuntime(runtime);
  }, [runtime, onRuntime]);

  return null;
}

describe("RuntimeProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provides the dev runtime when the Electron preload API is absent", async () => {
    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: undefined
    });
    const onSettings = vi.fn();

    render(
      <RuntimeProvider>
        <SettingsProbe onSettings={onSettings} />
      </RuntimeProvider>
    );

    expect(screen.getByText("dev")).toBeTruthy();
    await waitFor(() => {
      expect(onSettings).toHaveBeenCalledWith(DEFAULT_USER_SETTINGS);
    });
  });

  it("provides the Electron runtime when the Electron preload API is present", () => {
    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: {
        activateOpenedProject: vi.fn().mockResolvedValue(undefined),
        getVersion: vi.fn().mockResolvedValue("test-version"),
        log: vi.fn(),
        openProject: vi.fn().mockResolvedValue(null),
        saveProject: vi.fn().mockResolvedValue(null),
        selectAudioFile: vi.fn().mockResolvedValue(null),
        onMenuCommand: vi.fn(() => () => {}),
        getUserSettings: vi.fn().mockResolvedValue(DEFAULT_USER_SETTINGS),
        updateUserSettings: vi.fn().mockResolvedValue(DEFAULT_USER_SETTINGS)
      } satisfies ZiqiPreloadApi
    });

    render(
      <RuntimeProvider>
        <RuntimeProbe />
      </RuntimeProvider>
    );

    expect(screen.getByText("electron")).toBeTruthy();
  });

  it("rejects Electron-only operations in the dev runtime with clear messages", async () => {
    Object.defineProperty(window, "ziqiApp", {
      configurable: true,
      value: undefined
    });
    const onRuntime = vi.fn<(runtime: AppRuntime) => void>();

    render(
      <RuntimeProvider>
        <RuntimeCaptureProbe onRuntime={onRuntime} />
      </RuntimeProvider>
    );

    await waitFor(() => {
      expect(onRuntime).toHaveBeenCalledOnce();
    });
    const devRuntime = onRuntime.mock.calls[0][0];

    await expect(devRuntime.selectAudioFile()).rejects.toThrow(
      "Audio import is available only in the Electron runtime."
    );
    await expect(devRuntime.openProject()).rejects.toThrow(
      "Project open is available only in the Electron runtime."
    );
    await expect(devRuntime.saveProject({
      project: createMockProjectSummary()
    })).rejects.toThrow("Project save is available only in the Electron runtime.");
    await expect(devRuntime.activateOpenedProject({
      projectFilePath: "project.ziqi.json",
      projectRootPath: "project"
    })).rejects.toThrow("Project activation is available only in the Electron runtime.");
  });
});
