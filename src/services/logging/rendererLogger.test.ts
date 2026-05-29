import { describe, expect, it, vi } from "vitest";
import { createRendererLogger } from "./rendererLogger";
import type { RendererLogEntry } from "../../types/global";

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
