import { afterEach, describe, expect, it, vi } from "vitest";
import { createRendererLogger } from "./rendererLogger";
import type { RendererLogEntry, ZiqiPreloadApi } from "../../types/global";

afterEach(() => {
  vi.restoreAllMocks();
  delete window.ziqiApp;
});

describe("createRendererLogger", () => {
  const fixedDate = new Date("2026-05-29T12:34:56.789Z");

  it("mirrors trace logs to console and forwards renderer entries to the app", () => {
    const log = vi.fn<(entry: RendererLogEntry) => void>();
    const consoleSink = {
      trace: vi.fn(),
      warn: vi.fn()
    };
    const logger = createRendererLogger({
      app: { log },
      consoleSink,
      now: () => fixedDate
    });

    logger.trace("project.open.start", "Open project command started", {
      projectLoaded: false
    });

    expect(consoleSink.trace).toHaveBeenCalledWith(
      expect.stringContaining("[renderer] TRACE project.open.start")
    );
    expect(log).toHaveBeenCalledWith({
      area: "renderer",
      level: "trace",
      event: "project.open.start",
      message: "Open project command started",
      details: {
        projectLoaded: false
      }
    });
  });

  it("still mirrors trace logs when the app bridge is missing", () => {
    const consoleSink = {
      trace: vi.fn(),
      warn: vi.fn()
    };
    const logger = createRendererLogger({
      app: undefined,
      consoleSink,
      now: () => fixedDate
    });

    expect(() => {
      logger.trace("project.open.start", "Open project command started");
    }).not.toThrow();

    expect(consoleSink.trace).toHaveBeenCalledWith(
      expect.stringContaining("[renderer] TRACE project.open.start")
    );
  });

  it("warns without throwing when forwarding to the app bridge fails", () => {
    const consoleSink = {
      trace: vi.fn(),
      warn: vi.fn()
    };
    const logger = createRendererLogger({
      app: {
        log: () => {
          throw new Error("bridge unavailable");
        }
      },
      consoleSink,
      now: () => fixedDate
    });

    expect(() => {
      logger.trace("project.open.start", "Open project command started");
    }).not.toThrow();

    expect(consoleSink.warn).toHaveBeenCalledWith(
      "ZiQi renderer log forwarding failed: bridge unavailable"
    );
  });

  it("warns only once when forwarding to the app bridge fails repeatedly", () => {
    const consoleSink = {
      trace: vi.fn(),
      warn: vi.fn()
    };
    const logger = createRendererLogger({
      app: {
        log: () => {
          throw new Error("bridge unavailable");
        }
      },
      consoleSink,
      now: () => fixedDate
    });

    logger.trace("project.open.start", "Open project command started");
    logger.trace("project.open.start", "Open project command started");

    expect(consoleSink.warn).toHaveBeenCalledTimes(1);
    expect(consoleSink.warn).toHaveBeenCalledWith(
      "ZiQi renderer log forwarding failed: bridge unavailable"
    );
  });

  it("keeps console trace output on one line when details strings contain newlines", () => {
    const consoleSink = {
      trace: vi.fn(),
      warn: vi.fn()
    };
    const logger = createRendererLogger({
      consoleSink,
      now: () => fixedDate
    });

    logger.trace("project.open.start", "Open project command started", {
      note: "first line\nsecond line"
    });

    const [line] = consoleSink.trace.mock.calls[0];

    expect(line).toContain('"first line\\nsecond line"');
    expect(line).not.toContain("first line\nsecond line");
  });
});

describe("rendererLogger", () => {
  it("reads window.ziqiApp lazily after module import", async () => {
    vi.resetModules();
    vi.spyOn(console, "trace").mockImplementation(() => undefined);
    const { rendererLogger } = await import("./rendererLogger");
    const log = vi.fn<(entry: RendererLogEntry) => void>();

    window.ziqiApp = { log } as unknown as ZiqiPreloadApi;

    rendererLogger.trace("project.open.start", "Open project command started");

    expect(log).toHaveBeenCalledWith({
      area: "renderer",
      level: "trace",
      event: "project.open.start",
      message: "Open project command started"
    });
  });
});
