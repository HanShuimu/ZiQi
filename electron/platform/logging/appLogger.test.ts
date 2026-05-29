import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppLogger, formatLogFileName, formatLogLine } from "./appLogger.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ziqi-logger-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("app logger", () => {
  it("formats log file names with a Ziqi timestamp", () => {
    expect(formatLogFileName(new Date("2026-05-29T13:03:05.123Z"))).toMatch(
      /^Ziqi-\d{8}-\d{6}\.log$/
    );
  });

  it("formats log entries as a single escaped line", () => {
    expect(
      formatLogLine({
        timestamp: "2026-05-29T21:03:05.123+08:00",
        area: "renderer",
        level: "trace",
        event: "pitch.sample",
        message: 'quoted "message"',
        details: {
          name: 'lead "vocal"',
          count: 2,
          enabled: true,
          empty: null,
          skipped: undefined
        }
      })
    ).toBe(
      '2026-05-29T21:03:05.123+08:00 [renderer] TRACE pitch.sample name="lead \\"vocal\\"" count=2 enabled=true empty=null "quoted \\"message\\""'
    );
  });

  it("creates a logs file and mirrors trace entries to the console", async () => {
    const consoleSink = {
      trace: vi.fn(),
      warn: vi.fn()
    };
    const logger = await createAppLogger({
      programRootPath: tempDir,
      now: () => new Date("2026-05-29T13:03:05.123Z"),
      consoleSink
    });

    logger.trace("logger.started", "Logger started", { source: "main" });

    expect(path.dirname(logger.logFilePath)).toBe(path.join(tempDir, "logs"));
    expect(path.basename(logger.logFilePath)).toMatch(/^Ziqi-\d{8}-\d{6}\.log$/);
    expect(consoleSink.trace).toHaveBeenCalledOnce();
    expect(consoleSink.warn).not.toHaveBeenCalled();
    await expect(fs.readFile(logger.logFilePath, "utf8")).resolves.toContain(
      '[main] TRACE logger.started source="main" "Logger started"\n'
    );
  });

  it("keeps console logging when file initialization fails", async () => {
    const programRootPath = path.join(tempDir, "program-root-file");
    await fs.writeFile(programRootPath, "not a directory", "utf8");
    const consoleSink = {
      trace: vi.fn(),
      warn: vi.fn()
    };
    const logger = await createAppLogger({
      programRootPath,
      now: () => new Date("2026-05-29T13:03:05.123Z"),
      consoleSink
    });

    logger.trace("logger.started", "Logger started");

    expect(consoleSink.warn).toHaveBeenCalledOnce();
    expect(consoleSink.trace).toHaveBeenCalledOnce();
  });
});
