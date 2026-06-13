import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSettings } from "../../core/userSettings/types";
import { RuntimeProvider } from "../runtime";
import { UiSettingsProvider } from "./UiSettingsProvider";
import { useUiSettings } from "./useUiSettings";

function Probe() {
  const { changeSkin, settingsError, uiSkin } = useUiSettings();

  return (
    <>
      <div data-testid="ui-skin">{uiSkin}</div>
      {settingsError ? <div role="alert">{settingsError}</div> : null}
      <button type="button" onClick={() => void changeSkin("default")}>
        Use Default
      </button>
      <button type="button" onClick={() => void changeSkin("animal-island")}>
        Use Animal Island
      </button>
    </>
  );
}

describe("UiSettingsProvider", () => {
  beforeEach(() => {
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
        getUserSettings: vi.fn().mockResolvedValue({ uiSkin: "animal-island" }),
        updateUserSettings: vi.fn().mockResolvedValue({ uiSkin: "default" })
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads the UI skin and persists skin changes", async () => {
    render(
      <RuntimeProvider>
        <UiSettingsProvider>
          <Probe />
        </UiSettingsProvider>
      </RuntimeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("ui-skin").textContent).toBe("animal-island");
    });
    expect(window.ziqiApp!.getUserSettings).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Use Default" }));

    await waitFor(() => {
      expect(screen.getByTestId("ui-skin").textContent).toBe("default");
    });
    expect(window.ziqiApp!.updateUserSettings).toHaveBeenCalledWith({
      uiSkin: "default"
    });
  });

  it("shows settings errors when loading user settings fails", async () => {
    window.ziqiApp!.getUserSettings = vi
      .fn()
      .mockRejectedValue(new Error("Failed to load user settings."));

    renderUiSettings();

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Failed to load user settings.");
    });
    expect(screen.getByTestId("ui-skin").textContent).toBe("default");
  });

  it("keeps a saved skin when the initial load resolves later", async () => {
    const loadSettings = createDeferred<UserSettings>();
    window.ziqiApp!.getUserSettings = vi.fn().mockReturnValue(loadSettings.promise);
    window.ziqiApp!.updateUserSettings = vi
      .fn()
      .mockResolvedValue({ uiSkin: "animal-island" });

    renderUiSettings();

    await userEvent.click(screen.getByRole("button", { name: "Use Animal Island" }));
    await waitFor(() => {
      expect(screen.getByTestId("ui-skin").textContent).toBe("animal-island");
    });

    await act(async () => {
      loadSettings.resolve({ uiSkin: "default" });
      await loadSettings.promise;
    });

    expect(screen.getByTestId("ui-skin").textContent).toBe("animal-island");
  });

  it("ignores older skin update responses that resolve after a later change", async () => {
    const firstUpdate = createDeferred<UserSettings>();
    const secondUpdate = createDeferred<UserSettings>();
    window.ziqiApp!.getUserSettings = vi.fn().mockResolvedValue({ uiSkin: "default" });
    window.ziqiApp!.updateUserSettings = vi
      .fn()
      .mockReturnValueOnce(firstUpdate.promise)
      .mockReturnValueOnce(secondUpdate.promise);

    renderUiSettings();

    await userEvent.click(screen.getByRole("button", { name: "Use Animal Island" }));
    await userEvent.click(screen.getByRole("button", { name: "Use Default" }));

    await act(async () => {
      secondUpdate.resolve({ uiSkin: "default" });
      await secondUpdate.promise;
    });
    expect(screen.getByTestId("ui-skin").textContent).toBe("default");

    await act(async () => {
      firstUpdate.resolve({ uiSkin: "animal-island" });
      await firstUpdate.promise;
    });

    expect(screen.getByTestId("ui-skin").textContent).toBe("default");
  });
});

function renderUiSettings() {
  return render(
    <RuntimeProvider>
      <UiSettingsProvider>
        <Probe />
      </UiSettingsProvider>
    </RuntimeProvider>
  );
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}
