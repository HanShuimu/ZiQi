import { ipcMain } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppLogger } from "../logging/appLogger.js";
import type { LogEntry } from "../logging/logTypes.js";
import { registerLogHandlers } from "./logHandlers.js";

vi.mock("electron", () => ({
  ipcMain: {
    on: vi.fn()
  }
}));

type RendererLogHandler = (event: unknown, entry: unknown) => void;

afterEach(() => {
  vi.clearAllMocks();
});

describe("log IPC handlers", () => {
  it("appends valid renderer log entries without tracing invalid input", () => {
    const logger = createLogger();
    const handler = getRegisteredHandler(logger);
    const entry: LogEntry = {
      area: "renderer",
      event: "project.open.start",
      message: "Open project command started",
      details: { projectLoaded: false }
    };

    handler({}, entry);

    expect(logger.appendRendererEntry).toHaveBeenCalledOnce();
    expect(logger.appendRendererEntry).toHaveBeenCalledWith(entry);
    expect(logger.trace).not.toHaveBeenCalled();
  });

  it.each([
    ["primitive", "not an entry"],
    ["null", null],
    ["array", []],
    ["missing event", { area: "renderer", message: "Missing event" }],
    ["missing message", { area: "renderer", event: "missing.message" }],
    ["wrong area", { area: "main", event: "wrong.area", message: "Wrong area" }],
    [
      "invalid details array",
      {
        area: "renderer",
        event: "invalid.details",
        message: "Invalid details",
        details: []
      }
    ]
  ])("rejects invalid renderer log entries without throwing: %s", (_name, entry) => {
    const logger = createLogger();
    const handler = getRegisteredHandler(logger);

    expect(() => handler({}, entry)).not.toThrow();

    expect(logger.appendRendererEntry).not.toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledOnce();
    expect(logger.trace).toHaveBeenCalledWith(
      "log.renderer.invalid",
      "Ignored invalid renderer log entry"
    );
  });
});

function getRegisteredHandler(logger: AppLogger): RendererLogHandler {
  registerLogHandlers(logger);

  const handler = vi
    .mocked(ipcMain.on)
    .mock.calls.find(([channel]) => channel === "log:renderer")?.[1];

  expect(handler).toBeTypeOf("function");

  return handler as RendererLogHandler;
}

function createLogger(): AppLogger {
  return {
    logFilePath: "test.log",
    trace: vi.fn(),
    appendRendererEntry: vi.fn()
  };
}
