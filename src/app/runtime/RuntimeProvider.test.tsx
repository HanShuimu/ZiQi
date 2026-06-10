import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_SETTINGS } from "../../core/userSettings/types";
import { RuntimeProvider, useAppRuntime } from ".";

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
      } satisfies Window["ziqiApp"]
    });

    render(
      <RuntimeProvider>
        <RuntimeProbe />
      </RuntimeProvider>
    );

    expect(screen.getByText("electron")).toBeTruthy();
  });
});
