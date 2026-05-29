# Unified Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-version unified trace logger that writes every app session to the ZiQi program root `logs/Ziqi-YYYYMMDD-HHMMSS.log` and mirrors entries to the console.

**Architecture:** Electron main creates the log session, owns file writes, and receives renderer log events through IPC. Renderer code uses a small logger facade that mirrors to browser console and forwards entries through `window.ziqiApp.log`. Product flows receive logger dependencies where that keeps tests focused, while Electron file/IPC modules receive the main logger through constructor-style dependencies.

**Tech Stack:** Electron main/preload IPC, Node `fs/promises`, TypeScript, React renderer, Vitest.

---

## File Structure

- Create `electron/platform/logging/logTypes.ts`: shared main-process logging types and serializable detail helpers.
- Create `electron/platform/logging/appLogger.ts`: main-process log session creation, formatting, file append, console mirroring, and renderer-entry ingestion.
- Create `electron/platform/logging/appLogger.test.ts`: unit tests for names, format, directory creation, append behavior, and failure tolerance.
- Create `electron/platform/ipc/logHandlers.ts`: registers `log:renderer` IPC handler.
- Modify `electron/main.ts`: create logger before other startup work; register log IPC; pass logger into project/audio IPC handlers.
- Modify `electron/preload.cts`: expose `window.ziqiApp.log`.
- Modify `src/types/global.d.ts`: add renderer log API shape.
- Create `src/services/logging/rendererLogger.ts`: renderer logger facade and helpers.
- Create `src/services/logging/rendererLogger.test.ts`: unit tests for console mirroring, forwarding, and missing-preload tolerance.
- Modify `electron/platform/ipc/projectFileHandlers.ts`: log project open/save IPC boundaries.
- Modify `electron/platform/ipc/audioFileHandlers.ts`: log audio file selection/read boundaries.
- Modify `electron/platform/projectFiles/projectFiles.ts`: log project file and project audio file reads/writes.
- Modify `src/app/commands/projectCommandTypes.ts`: add a renderer logger dependency.
- Modify `src/app/session/AppSessionProvider.tsx`: provide the renderer logger to project commands and default pitch service.
- Modify `src/app/commands/openProjectCommand.ts`: add ordered stage logs and durations.
- Modify `src/app/commands/importAudioCommand.ts`: add ordered stage logs and durations.
- Modify `src/app/commands/saveProjectCommand.ts`: add save command logs.
- Modify `src/services/audio/browserWaveformService.ts`: log decode/build stages.
- Modify `src/services/audio/browserSpectrogramService.ts`: log decode/build stages.
- Modify `src/services/audio/browserPitchEnergyService.ts`: log decode, engine load, frame progress, and overview build stages.
- Modify focused tests in `src/services/audio/browserPitchEnergyService.test.ts` and `src/App.test.tsx`, or add command-level tests if smaller.

---

### Task 1: Main Logger Core

**Files:**
- Create: `electron/platform/logging/logTypes.ts`
- Create: `electron/platform/logging/appLogger.ts`
- Create: `electron/platform/logging/appLogger.test.ts`

- [ ] **Step 1: Write failing tests for timestamped file names and line formatting**

Add `electron/platform/logging/appLogger.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAppLogger,
  formatLogFileName,
  formatLogLine
} from "./appLogger.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ziqi-logger-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("app logger", () => {
  it("formats the session log file name from local time components", () => {
    expect(formatLogFileName(new Date("2026-05-29T13:03:05.123Z"))).toMatch(
      /^Ziqi-\d{8}-\d{6}\.log$/
    );
  });

  it("formats readable single-line trace entries", () => {
    const line = formatLogLine({
      timestamp: "2026-05-29T21:03:05.123+08:00",
      area: "renderer",
      level: "trace",
      event: "project.open.waveform.end",
      message: "Built waveform overview",
      details: {
        durationMs: 142,
        frameCount: 240,
        filePath: "D:\\Projects\\Demo.ziqiproject\\Demo.ziqi"
      }
    });

    expect(line).toBe(
      '2026-05-29T21:03:05.123+08:00 [renderer] TRACE project.open.waveform.end durationMs=142 frameCount=240 filePath="D:\\\\Projects\\\\Demo.ziqiproject\\\\Demo.ziqi" "Built waveform overview"'
    );
  });
});
```

- [ ] **Step 2: Run the failing logger test**

Run:

```bash
npm test -- electron/platform/logging/appLogger.test.ts
```

Expected: fail because `electron/platform/logging/appLogger.ts` does not exist.

- [ ] **Step 3: Add shared log types**

Create `electron/platform/logging/logTypes.ts`:

```ts
export type LogArea = "main" | "preload" | "renderer";
export type LogLevel = "trace";
export type LogDetailValue = string | number | boolean | null | undefined;
export type LogDetails = Record<string, LogDetailValue>;

export interface LogEntry {
  timestamp?: string;
  area: LogArea;
  level?: LogLevel;
  event: string;
  message: string;
  details?: LogDetails;
}

export interface LogSink {
  trace(message: string): void;
  warn(message: string): void;
}
```

- [ ] **Step 4: Implement file name and line formatting**

Create `electron/platform/logging/appLogger.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import type { LogDetails, LogEntry, LogSink } from "./logTypes.js";

interface AppLoggerOptions {
  programRootPath: string;
  now?: () => Date;
  consoleSink?: LogSink;
}

export interface AppLogger {
  readonly logFilePath: string;
  trace(event: string, message: string, details?: LogDetails): void;
  appendRendererEntry(entry: LogEntry): void;
}

export async function createAppLogger({
  programRootPath,
  now = () => new Date(),
  consoleSink = console
}: AppLoggerOptions): Promise<AppLogger> {
  const logsDirectoryPath = path.join(programRootPath, "logs");
  const logFilePath = path.join(logsDirectoryPath, formatLogFileName(now()));
  let fileLoggingEnabled = true;

  try {
    await fs.mkdir(logsDirectoryPath, { recursive: true });
    await fs.appendFile(logFilePath, "", "utf8");
  } catch (error) {
    fileLoggingEnabled = false;
    consoleSink.warn(formatConsoleWarning(error));
  }

  function append(entry: LogEntry) {
    const line = formatLogLine({
      ...entry,
      timestamp: entry.timestamp ?? formatLocalTimestamp(now()),
      level: entry.level ?? "trace"
    });
    consoleSink.trace(line);

    if (fileLoggingEnabled) {
      void fs.appendFile(logFilePath, `${line}\n`, "utf8").catch((error) => {
        fileLoggingEnabled = false;
        consoleSink.warn(formatConsoleWarning(error));
      });
    }
  }

  return {
    logFilePath,
    trace(event, message, details) {
      append({ area: "main", level: "trace", event, message, details });
    },
    appendRendererEntry(entry) {
      append({ ...entry, area: "renderer", level: "trace" });
    }
  };
}

export function formatLogFileName(date: Date) {
  return `Ziqi-${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}-${pad(date.getHours(), 2)}${pad(date.getMinutes(), 2)}${pad(date.getSeconds(), 2)}.log`;
}

export function formatLogLine(entry: Required<Pick<LogEntry, "area" | "level" | "event" | "message">> & {
  timestamp: string;
  details?: LogDetails;
}) {
  const details = formatDetails(entry.details);
  const prefix = `${entry.timestamp} [${entry.area}] ${entry.level.toUpperCase()} ${entry.event}`;
  return `${prefix}${details ? ` ${details}` : ""} ${JSON.stringify(entry.message)}`;
}

function formatDetails(details?: LogDetails) {
  if (!details) return "";
  return Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatDetailValue(value)}`)
    .join(" ");
}

function formatDetailValue(value: Exclude<LogDetails[string], undefined>) {
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function formatLocalTimestamp(date: Date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}T${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}.${pad(date.getMilliseconds(), 3)}${sign}${pad(Math.floor(absoluteOffset / 60), 2)}:${pad(absoluteOffset % 60, 2)}`;
}

function pad(value: number, length: number) {
  return String(value).padStart(length, "0");
}

function formatConsoleWarning(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `ZiQi logging file output failed: ${message}`;
}
```

- [ ] **Step 5: Add failing tests for directory creation, append, and file failure tolerance**

Extend `electron/platform/logging/appLogger.test.ts`:

```ts
  it("creates a program-root logs directory and appends trace entries", async () => {
    const consoleSink = { trace: vi.fn(), warn: vi.fn() };
    const logger = await createAppLogger({
      programRootPath: tempDir,
      now: () => new Date("2026-05-29T13:03:05.123Z"),
      consoleSink
    });

    logger.trace("app.start", "Application startup began", { version: "0.1.0" });
    await vi.waitFor(async () => {
      await expect(fs.readFile(logger.logFilePath, "utf8")).resolves.toContain("app.start");
    });

    expect(path.dirname(logger.logFilePath)).toBe(path.join(tempDir, "logs"));
    expect(consoleSink.trace).toHaveBeenCalledWith(expect.stringContaining("app.start"));
  });

  it("keeps console logging when file logging cannot be initialized", async () => {
    const consoleSink = { trace: vi.fn(), warn: vi.fn() };
    const blockedRoot = path.join(tempDir, "blocked");
    await fs.writeFile(blockedRoot, "not a directory", "utf8");

    const logger = await createAppLogger({
      programRootPath: blockedRoot,
      consoleSink
    });
    logger.trace("app.start", "Application startup began");

    expect(consoleSink.warn).toHaveBeenCalledWith(
      expect.stringContaining("ZiQi logging file output failed")
    );
    expect(consoleSink.trace).toHaveBeenCalledWith(expect.stringContaining("app.start"));
  });
```

- [ ] **Step 6: Run logger tests**

Run:

```bash
npm test -- electron/platform/logging/appLogger.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add electron/platform/logging/logTypes.ts electron/platform/logging/appLogger.ts electron/platform/logging/appLogger.test.ts
git commit -m "Add application logger core"
```

---

### Task 2: Wire Main Startup, Preload, and Renderer Log IPC

**Files:**
- Create: `electron/platform/ipc/logHandlers.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.cts`
- Modify: `src/types/global.d.ts`
- Test: `electron/platform/logging/appLogger.test.ts`

- [ ] **Step 1: Add renderer-entry ingestion test**

Extend `electron/platform/logging/appLogger.test.ts`:

```ts
  it("appends renderer entries to the same log file", async () => {
    const consoleSink = { trace: vi.fn(), warn: vi.fn() };
    const logger = await createAppLogger({ programRootPath: tempDir, consoleSink });

    logger.appendRendererEntry({
      area: "renderer",
      level: "trace",
      event: "project.open.start",
      message: "Open project command started",
      details: { projectLoaded: false }
    });

    await vi.waitFor(async () => {
      const contents = await fs.readFile(logger.logFilePath, "utf8");
      expect(contents).toContain("[renderer] TRACE project.open.start");
      expect(contents).toContain("projectLoaded=false");
    });
  });
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
npm test -- electron/platform/logging/appLogger.test.ts
```

Expected: pass after Task 1, proving the main logger can ingest renderer entries.

- [ ] **Step 3: Add IPC registration**

Create `electron/platform/ipc/logHandlers.ts`:

```ts
import { ipcMain } from "electron";
import type { AppLogger } from "../logging/appLogger.js";
import type { LogEntry } from "../logging/logTypes.js";

export function registerLogHandlers(logger: AppLogger): void {
  ipcMain.on("log:renderer", (_event, entry) => {
    if (isRendererLogEntry(entry)) {
      logger.appendRendererEntry(entry);
    } else {
      logger.trace("log.renderer.invalid", "Ignored invalid renderer log entry");
    }
  });
}

function isRendererLogEntry(value: unknown): value is LogEntry {
  return (
    isRecord(value) &&
    value.area === "renderer" &&
    typeof value.event === "string" &&
    typeof value.message === "string" &&
    (!("details" in value) || value.details === undefined || isRecord(value.details))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 4: Create the logger at startup**

Modify `electron/main.ts`:

```ts
import { createAppLogger, type AppLogger } from "./platform/logging/appLogger.js";
import { registerLogHandlers } from "./platform/ipc/logHandlers.js";
```

Add near existing module state:

```ts
let appLogger: AppLogger | null = null;
```

Inside `app.whenReady().then(async () => { ... })`, before user settings are read:

```ts
  const programRootPath = path.resolve(__dirname, "..");
  appLogger = await createAppLogger({ programRootPath });
  appLogger.trace("app.start", "ZiQi startup began", {
    programRootPath,
    rendererDevUrl: rendererDevUrl ?? null
  });
```

After each registration call, add concise trace logs:

```ts
  registerLogHandlers(appLogger);
  appLogger.trace("ipc.log.registered", "Registered renderer log IPC handler");
```

At the end of startup after `createWindow()`:

```ts
  appLogger.trace("app.ready", "ZiQi startup completed");
```

- [ ] **Step 5: Expose renderer logging through preload**

Modify `electron/preload.cts`:

```ts
type RendererLogEntry = {
  area: "renderer";
  level?: "trace";
  event: string;
  message: string;
  details?: Record<string, string | number | boolean | null | undefined>;
};
```

Add to `api`:

```ts
  log: (entry: RendererLogEntry) => {
    ipcRenderer.send("log:renderer", entry);
  },
```

- [ ] **Step 6: Update renderer global type**

Modify `src/types/global.d.ts`:

```ts
export type RendererLogEntry = {
  area: "renderer";
  level?: "trace";
  event: string;
  message: string;
  details?: Record<string, string | number | boolean | null | undefined>;
};
```

Add to `Window["ziqiApp"]`:

```ts
      log(entry: RendererLogEntry): void;
```

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git add electron/main.ts electron/preload.cts electron/platform/ipc/logHandlers.ts src/types/global.d.ts electron/platform/logging/appLogger.test.ts
git commit -m "Wire application logger across Electron"
```

---

### Task 3: Renderer Logger Facade

**Files:**
- Create: `src/services/logging/rendererLogger.ts`
- Create: `src/services/logging/rendererLogger.test.ts`

- [ ] **Step 1: Write failing renderer logger tests**

Create `src/services/logging/rendererLogger.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRendererLogger } from "./rendererLogger";

describe("renderer logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mirrors trace logs to console and forwards them to preload", () => {
    const consoleSink = { trace: vi.fn(), warn: vi.fn() };
    const app = { log: vi.fn() };
    const logger = createRendererLogger({
      app,
      consoleSink,
      now: () => new Date("2026-05-29T13:03:05.123Z")
    });

    logger.trace("project.open.start", "Open project command started", {
      projectLoaded: false
    });

    expect(consoleSink.trace).toHaveBeenCalledWith(
      expect.stringContaining("[renderer] TRACE project.open.start")
    );
    expect(app.log).toHaveBeenCalledWith({
      area: "renderer",
      level: "trace",
      event: "project.open.start",
      message: "Open project command started",
      details: { projectLoaded: false }
    });
  });

  it("keeps console logging when preload logging is unavailable", () => {
    const consoleSink = { trace: vi.fn(), warn: vi.fn() };
    const logger = createRendererLogger({ app: undefined, consoleSink });

    logger.trace("project.open.start", "Open project command started");

    expect(consoleSink.trace).toHaveBeenCalledWith(
      expect.stringContaining("project.open.start")
    );
  });
});
```

- [ ] **Step 2: Run failing renderer logger tests**

Run:

```bash
npm test -- src/services/logging/rendererLogger.test.ts
```

Expected: fail because `rendererLogger.ts` does not exist.

- [ ] **Step 3: Implement renderer logger**

Create `src/services/logging/rendererLogger.ts`:

```ts
import type { RendererLogEntry } from "../../types/global";

export type RendererLogDetails = NonNullable<RendererLogEntry["details"]>;

export interface RendererLogger {
  trace(event: string, message: string, details?: RendererLogDetails): void;
}

interface RendererLoggerOptions {
  app?: Pick<Window["ziqiApp"], "log">;
  consoleSink?: Pick<Console, "trace" | "warn">;
  now?: () => Date;
}

export function createRendererLogger({
  app = typeof window === "undefined" ? undefined : window.ziqiApp,
  consoleSink = console,
  now = () => new Date()
}: RendererLoggerOptions = {}): RendererLogger {
  return {
    trace(event, message, details) {
      const entry: RendererLogEntry = {
        area: "renderer",
        level: "trace",
        event,
        message,
        details
      };
      consoleSink.trace(formatRendererLogLine(entry, now()));
      try {
        app?.log(entry);
      } catch (error) {
        const warning = error instanceof Error ? error.message : String(error);
        consoleSink.warn(`ZiQi renderer log forwarding failed: ${warning}`);
      }
    }
  };
}

export const rendererLogger = createRendererLogger();

function formatRendererLogLine(entry: RendererLogEntry, date: Date) {
  const details = Object.entries(entry.details ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${typeof value === "string" ? JSON.stringify(value) : String(value)}`)
    .join(" ");
  const prefix = `${date.toISOString()} [renderer] TRACE ${entry.event}`;
  return `${prefix}${details ? ` ${details}` : ""} ${JSON.stringify(entry.message)}`;
}
```

- [ ] **Step 4: Run renderer logger tests**

Run:

```bash
npm test -- src/services/logging/rendererLogger.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add src/services/logging/rendererLogger.ts src/services/logging/rendererLogger.test.ts
git commit -m "Add renderer logger facade"
```

---

### Task 4: Main-Process Project and Audio File Logging

**Files:**
- Modify: `electron/platform/ipc/projectFileHandlers.ts`
- Modify: `electron/platform/ipc/audioFileHandlers.ts`
- Modify: `electron/platform/projectFiles/projectFiles.ts`
- Test: `electron/platform/projectFiles/projectFiles.test.ts`

- [ ] **Step 1: Add project file logger dependency tests**

Extend `electron/platform/projectFiles/projectFiles.test.ts` with focused log assertions:

```ts
  it("logs project file and audio reads when opening a project", async () => {
    const sourceAudioPath = path.join(tempDir, "demo track.wav");
    await fs.writeFile(sourceAudioPath, Buffer.from([8, 7, 6, 5]));
    const saved = await saveNewProject({
      parentDirectoryPath: tempDir,
      project: {
        ...project,
        sourceAudio: {
          ...project.sourceAudio,
          filePath: sourceAudioPath
        }
      }
    });
    const logger = { trace: vi.fn() };

    await openProjectFromFile(saved.projectFilePath, { logger });

    expect(logger.trace).toHaveBeenCalledWith(
      "project.file.read.start",
      "Reading project file",
      { projectFilePath: saved.projectFilePath }
    );
    expect(logger.trace).toHaveBeenCalledWith(
      "project.audio.read.end",
      "Read project audio file",
      expect.objectContaining({ byteLength: 4 })
    );
  });
```

Add `vi` to the existing import:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
```

- [ ] **Step 2: Run focused project file tests**

Run:

```bash
npm test -- electron/platform/projectFiles/projectFiles.test.ts
```

Expected: fail because `openProjectFromFile` does not accept logger options.

- [ ] **Step 3: Add optional logger dependency to project file functions**

Modify `electron/platform/projectFiles/projectFiles.ts`:

```ts
interface ProjectFileLogger {
  trace(event: string, message: string, details?: Record<string, string | number | boolean | null | undefined>): void;
}

interface ProjectFileOperationOptions {
  logger?: ProjectFileLogger;
}
```

Change signatures:

```ts
export async function saveNewProject({
  parentDirectoryPath,
  project
}: SaveNewProjectOptions, options: ProjectFileOperationOptions = {}): Promise<SaveProjectResult> {
```

```ts
export async function saveExistingProject({
  project,
  projectFilePath,
  projectRootPath
}: SaveExistingProjectOptions, options: ProjectFileOperationOptions = {}): Promise<SaveProjectResult> {
```

```ts
export async function openProjectFromFile(
  projectFilePath: string,
  options: ProjectFileOperationOptions = {}
): Promise<OpenProjectResult> {
```

Add trace calls around reads and writes:

```ts
  options.logger?.trace("project.file.read.start", "Reading project file", { projectFilePath });
```

```ts
  options.logger?.trace("project.file.read.end", "Read project file", { projectFilePath });
```

```ts
  options.logger?.trace("project.audio.read.start", "Reading project audio file", { audioPath });
```

```ts
  options.logger?.trace("project.audio.read.end", "Read project audio file", {
    audioPath,
    byteLength: audioFile.byteLength
  });
```

- [ ] **Step 4: Pass logger from IPC handlers**

Modify `ProjectFileHandlerDependencies` in `electron/platform/ipc/projectFileHandlers.ts`:

```ts
  logger: {
    trace(event: string, message: string, details?: Record<string, string | number | boolean | null | undefined>): void;
  };
```

Add traces around dialogs and IPC operations:

```ts
    dependencies.logger.trace("ipc.project.open.start", "Project open IPC started");
```

```ts
      dependencies.logger.trace("ipc.project.open.cancel", "Project open dialog canceled");
```

Pass logger:

```ts
    const openedProject = await openProjectFromFile(result.filePaths[0], {
      logger: dependencies.logger
    });
```

Apply the same pattern to save and activate-opened paths with events:

- `ipc.project.save.start`
- `ipc.project.save.cancel`
- `ipc.project.save.end`
- `ipc.project.activateOpened.start`
- `ipc.project.activateOpened.end`

- [ ] **Step 5: Pass logger into project IPC registration**

Modify `electron/main.ts`:

```ts
  registerProjectFileHandlers({
    getCurrentProjectLocation: () => currentProjectLocation,
    trustedImportedAudioPaths,
    updateCurrentProjectLocation,
    logger: appLogger
  });
```

- [ ] **Step 6: Add audio file IPC logging**

Modify `AudioFileHandlerDependencies` in `electron/platform/ipc/audioFileHandlers.ts`:

```ts
  logger: {
    trace(event: string, message: string, details?: Record<string, string | number | boolean | null | undefined>): void;
  };
```

Add events:

- `ipc.audio.select.start`
- `ipc.audio.select.cancel`
- `ipc.audio.read.start`
- `ipc.audio.read.end`
- `ipc.audio.read.fail`

Use details:

```ts
{ filePath }
{ filePath, byteLength: file.byteLength }
```

Modify `electron/main.ts`:

```ts
  registerAudioFileHandlers({ trustedImportedAudioPaths, logger: appLogger });
```

- [ ] **Step 7: Run focused tests and build**

Run:

```bash
npm test -- electron/platform/projectFiles/projectFiles.test.ts
npm run build
```

Expected: tests and build pass.

- [ ] **Step 8: Commit Task 4**

Run:

```bash
git add electron/main.ts electron/platform/ipc/projectFileHandlers.ts electron/platform/ipc/audioFileHandlers.ts electron/platform/projectFiles/projectFiles.ts electron/platform/projectFiles/projectFiles.test.ts
git commit -m "Log Electron project and audio file operations"
```

---

### Task 5: Renderer Project Command Stage Logging

**Files:**
- Modify: `src/app/commands/projectCommandTypes.ts`
- Modify: `src/app/session/AppSessionProvider.tsx`
- Modify: `src/app/commands/openProjectCommand.ts`
- Modify: `src/app/commands/importAudioCommand.ts`
- Modify: `src/app/commands/saveProjectCommand.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Add App test setup log mock**

Modify the `window.ziqiApp` test object in `src/App.test.tsx`:

```ts
        log: vi.fn(),
```

- [ ] **Step 2: Add a failing open-project logging assertion**

Add a focused test near existing open project tests in `src/App.test.tsx`:

```ts
  it("logs ordered stages when opening a project", async () => {
    const openedAudioData = new ArrayBuffer(8);
    window.ziqiApp.openProject = vi.fn().mockResolvedValue({
      audioData: openedAudioData,
      project: createProjectSummary("audio/demo track.wav"),
      projectFilePath: "D:\\ZiQi Projects\\Demo\\project.ziqi",
      projectRootPath: "D:\\ZiQi Projects\\Demo"
    });
    const waveformService = {
      buildOverviewFromAudioData: vi.fn().mockResolvedValue(createWaveformOverview())
    };
    renderApp({ waveformService });

    menuCommandListener?.("open-project");

    await waitFor(() => {
      expect(screen.getByText("demo track")).toBeTruthy();
    });
    expect(window.ziqiApp.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "project.open.start",
        message: "Open project command started"
      })
    );
    expect(window.ziqiApp.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "project.open.pitchHeatmap.end",
        message: "Built project pitch heatmap overview"
      })
    );
    expect(window.ziqiApp.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "project.open.end",
        message: "Open project command completed"
      })
    );
  });
```

- [ ] **Step 3: Run the failing App test**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: fail because no renderer logger is wired into commands.

- [ ] **Step 4: Add logger dependency to project commands**

Modify `src/app/commands/projectCommandTypes.ts`:

```ts
import type { RendererLogger } from "../../services/logging/rendererLogger";
```

Add to `ProjectCommandDependencies`:

```ts
  logger: RendererLogger;
```

Modify `src/app/session/AppSessionProvider.tsx`:

```ts
import { rendererLogger } from "../../services/logging/rendererLogger";
```

Pass into `createProjectCommands`:

```ts
        logger: rendererLogger,
```

- [ ] **Step 5: Add trace logs to open project command**

Modify `src/app/commands/openProjectCommand.ts` to destructure `logger`.

At command start:

```ts
    const commandStartedAt = performance.now();
    logger.trace("project.open.start", "Open project command started", {
      hadExistingProject: project !== null
    });
```

Around each awaited stage, add `stageStartedAt` and end logs:

```ts
      const nativeOpenStartedAt = performance.now();
      const openedProject = await window.ziqiApp.openProject();
      logger.trace("project.open.native.end", "Native project open completed", {
        durationMs: Math.round(performance.now() - nativeOpenStartedAt),
        canceled: openedProject === null
      });
```

Use event names:

- `project.open.objectUrl.created`
- `project.open.waveform.start`
- `project.open.waveform.end`
- `project.open.spectrogram.start`
- `project.open.spectrogram.end`
- `project.open.pitchHeatmap.start`
- `project.open.pitchHeatmap.end`
- `project.open.playbackSource.start`
- `project.open.playbackSource.end`
- `project.open.playbackState.end`
- `project.open.activate.end`
- `project.open.stateCommitted`
- `project.open.rollback.start`
- `project.open.rollback.end`
- `project.open.fail`
- `project.open.end`

For failures:

```ts
      logger.trace("project.open.fail", "Open project command failed", {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
```

In `finally`:

```ts
      logger.trace("project.open.end", "Open project command completed", {
        durationMs: Math.round(performance.now() - commandStartedAt)
      });
```

- [ ] **Step 6: Add trace logs to import audio command**

Modify `src/app/commands/importAudioCommand.ts` to destructure `logger`.

Use event names:

- `audio.import.start`
- `audio.import.nativeSelect.end`
- `audio.import.objectUrl.created`
- `audio.import.waveform.start`
- `audio.import.waveform.end`
- `audio.import.spectrogram.start`
- `audio.import.spectrogram.end`
- `audio.import.pitchHeatmap.start`
- `audio.import.pitchHeatmap.end`
- `audio.import.playbackSource.start`
- `audio.import.playbackSource.end`
- `audio.import.stateCommitted`
- `audio.import.fail`
- `audio.import.end`

Use details such as:

```ts
{
  durationMs: Math.round(performance.now() - stageStartedAt),
  byteLength: selectedFile.audioData.byteLength
}
```

- [ ] **Step 7: Add trace logs to save command**

Modify `src/app/commands/saveProjectCommand.ts` to destructure `logger`.

Use events:

- `project.save.skipNoProject`
- `project.save.start`
- `project.save.native.end`
- `project.save.cancel`
- `project.save.stateCommitted`
- `project.save.fail`
- `project.save.end`

- [ ] **Step 8: Run App tests**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: pass.

- [ ] **Step 9: Commit Task 5**

Run:

```bash
git add src/App.test.tsx src/app/commands/projectCommandTypes.ts src/app/session/AppSessionProvider.tsx src/app/commands/openProjectCommand.ts src/app/commands/importAudioCommand.ts src/app/commands/saveProjectCommand.ts
git commit -m "Log renderer project command stages"
```

---

### Task 6: Audio Analysis Service Logging and Pitch Progress

**Files:**
- Modify: `src/services/audio/browserWaveformService.ts`
- Modify: `src/services/audio/browserSpectrogramService.ts`
- Modify: `src/services/audio/browserPitchEnergyService.ts`
- Test: `src/services/audio/browserPitchEnergyService.test.ts`

- [ ] **Step 1: Add pitch progress logging test**

Extend `src/services/audio/browserPitchEnergyService.test.ts`:

```ts
  it("logs pitch heatmap progress while building frames", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const decodeAudioData = vi.fn().mockResolvedValue(new FakeAudioBuffer());
    const analyzeFrame = vi.fn<PitchEnergyEngine["analyzeFrame"]>(() => new Array(88).fill(0));
    const logger = { trace: vi.fn() };

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: vi.fn(function () {
        return { close, decodeAudioData };
      })
    });

    const service = createBrowserPitchEnergyService({
      loadEngine: async () => ({ analyzeFrame }),
      logger
    });

    await service.buildOverviewFromAudioData(new ArrayBuffer(8), { framesPerSecond: 4 });

    expect(logger.trace).toHaveBeenCalledWith(
      "pitchHeatmap.progress",
      "Analyzed pitch heatmap frame",
      expect.objectContaining({ frameIndex: 1, frameCount: 4 })
    );
    expect(logger.trace).toHaveBeenCalledWith(
      "pitchHeatmap.progress",
      "Analyzed pitch heatmap frame",
      expect.objectContaining({ frameIndex: 4, frameCount: 4 })
    );
  });
```

- [ ] **Step 2: Run the failing pitch test**

Run:

```bash
npm test -- src/services/audio/browserPitchEnergyService.test.ts
```

Expected: fail because the pitch service does not accept a logger dependency.

- [ ] **Step 3: Add logger dependency type to pitch service**

Modify `src/services/audio/browserPitchEnergyService.ts`:

```ts
import { rendererLogger, type RendererLogger } from "../logging/rendererLogger";
```

Change dependencies:

```ts
interface BrowserPitchEnergyServiceDependencies {
  loadEngine?: () => Promise<PitchEnergyEngine>;
  logger?: RendererLogger;
}
```

Change default:

```ts
export function createBrowserPitchEnergyService({
  loadEngine = loadEssentiaPitchEnergyEngine,
  logger = rendererLogger
}: BrowserPitchEnergyServiceDependencies = {}): PitchEnergyService {
```

- [ ] **Step 4: Log decode, engine load, and overview stages**

In `buildOverviewFromAudioData`:

```ts
      const decodeStartedAt = performance.now();
      logger.trace("pitchHeatmap.decode.start", "Decoding audio for pitch heatmap", {
        byteLength: audioData.byteLength
      });
```

After decode:

```ts
        logger.trace("pitchHeatmap.decode.end", "Decoded audio for pitch heatmap", {
          durationMs: Math.round(performance.now() - decodeStartedAt),
          audioDurationMs: Math.round(decodedAudio.duration * 1000),
          sampleRate: decodedAudio.sampleRate,
          channelCount: decodedAudio.numberOfChannels
        });
```

Before and after engine load:

```ts
      logger.trace("pitchHeatmap.engine.load.start", "Loading pitch analysis engine");
```

```ts
      logger.trace("pitchHeatmap.engine.load.end", "Loaded pitch analysis engine", {
        durationMs: Math.round(performance.now() - engineStartedAt)
      });
```

Before and after overview creation:

```ts
      logger.trace("pitchHeatmap.overview.start", "Building pitch heatmap overview", {
        framesPerSecond
      });
```

```ts
      logger.trace("pitchHeatmap.overview.end", "Built pitch heatmap overview", {
        durationMs: Math.round(performance.now() - overviewStartedAt),
        frameCount: overview.frames.length
      });
```

- [ ] **Step 5: Add progress callback through pure overview builder**

Modify `PitchEnergyBuildOptions`:

```ts
  onProgress?: (progress: { frameIndex: number; frameCount: number }) => void;
```

When creating frames in `createPitchEnergyOverviewFromBuffer`, replace `Array.from` with a loop:

```ts
  const frames = [];
  for (let index = 0; index < frameCount; index += 1) {
    const centerSample = Math.round((index + 0.5) * hopSamples);
    const frame = extractCenteredFrame(monoSamples, centerSample, SPECTRUM_CQ_FRAME_SIZE);
    frames.push(createPitchEnergyFrame({
      startMs: Math.round((index / options.framesPerSecond) * 1000),
      endMs: Math.min(durationMs, Math.round(((index + 1) / options.framesPerSecond) * 1000)),
      energies: engine.analyzeFrame(frame, buffer.sampleRate)
    }));
    options.onProgress?.({ frameIndex: index + 1, frameCount });
  }
```

Return `frames`.

When calling it from the browser service:

```ts
        onProgress: createPitchProgressLogger(logger)
```

Add helper:

```ts
function createPitchProgressLogger(logger: RendererLogger) {
  return ({ frameIndex, frameCount }: { frameIndex: number; frameCount: number }) => {
    if (frameIndex === 1 || frameIndex === frameCount || frameIndex % 24 === 0) {
      logger.trace("pitchHeatmap.progress", "Analyzed pitch heatmap frame", {
        frameIndex,
        frameCount,
        percent: frameCount === 0 ? 100 : Math.round((frameIndex / frameCount) * 100)
      });
    }
  };
}
```

- [ ] **Step 6: Add waveform and spectrogram service logging**

Modify `src/services/audio/browserWaveformService.ts`:

```ts
import { rendererLogger, type RendererLogger } from "../logging/rendererLogger";
```

Add optional dependency:

```ts
export function createBrowserWaveformService(logger: RendererLogger = rendererLogger): WaveformService {
```

Log:

- `waveform.decode.start`
- `waveform.decode.end`
- `waveform.overview.start`
- `waveform.overview.end`
- `waveform.fail`

Modify `src/services/audio/browserSpectrogramService.ts` with the same pattern and events:

- `spectrogram.decode.start`
- `spectrogram.decode.end`
- `spectrogram.overview.start`
- `spectrogram.overview.end`
- `spectrogram.fail`

- [ ] **Step 7: Provide logger to default services**

Modify `src/app/session/AppSessionProvider.tsx`:

```ts
  const activeWaveformService = useMemo(
    () => waveformService ?? createBrowserWaveformService(rendererLogger),
    [waveformService]
  );
```

Apply the same pattern for spectrogram and pitch services.

- [ ] **Step 8: Run audio tests**

Run:

```bash
npm test -- src/services/audio/browserPitchEnergyService.test.ts src/services/audio/browserWaveformService.test.ts src/services/audio/browserSpectrogramService.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit Task 6**

Run:

```bash
git add src/services/audio/browserPitchEnergyService.ts src/services/audio/browserPitchEnergyService.test.ts src/services/audio/browserWaveformService.ts src/services/audio/browserSpectrogramService.ts src/app/session/AppSessionProvider.tsx
git commit -m "Log audio analysis stages"
```

---

### Task 7: Verification and Real Runtime Smoke

**Files:**
- No planned product file changes.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm test -- electron/platform/logging/appLogger.test.ts src/services/logging/rendererLogger.test.ts electron/platform/projectFiles/projectFiles.test.ts src/services/audio/browserPitchEnergyService.test.ts src/App.test.tsx
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: full suite passes.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: build passes. Existing Vite warnings from Essentia browser externals and chunk size can remain if unchanged.

- [ ] **Step 4: Start Electron and verify log creation**

Run:

```powershell
$electron = 'D:\WORKSPACE\ZiQi\.worktrees\pitch-heatmap-analysis\node_modules\.bin\electron.cmd'
$args = @('--remote-debugging-port=9226', 'dist-electron\main.js')
$proc = Start-Process -FilePath $electron -ArgumentList $args -WorkingDirectory 'D:\WORKSPACE\ZiQi\.worktrees\pitch-heatmap-analysis' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5
Get-ChildItem -Path 'D:\WORKSPACE\ZiQi\.worktrees\pitch-heatmap-analysis\logs' -Filter 'Ziqi-*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
$proc.CloseMainWindow()
```

Expected: command prints a path under `D:\WORKSPACE\ZiQi\.worktrees\pitch-heatmap-analysis\logs\Ziqi-*.log`.

- [ ] **Step 5: Inspect the newest log file**

Run:

```powershell
$log = Get-ChildItem -Path 'D:\WORKSPACE\ZiQi\.worktrees\pitch-heatmap-analysis\logs' -Filter 'Ziqi-*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Get-Content -Path $log.FullName -Tail 40
```

Expected: output contains `app.start`, `ipc.log.registered`, and `app.ready`.

- [ ] **Step 6: Finish verification**

If Steps 1-5 pass and `git status --short` is clean, verification is complete. If any verification step fails, return to the task that introduced that behavior, make the smallest fix there, rerun the failed verification command, and commit the exact files touched by that fix with a message that names the stabilized area.

---

## Self-Review

- Spec coverage: Tasks 1-3 implement unified main/preload/renderer logging, startup file creation, console mirroring, trace level, and renderer forwarding. Tasks 4-6 cover startup-adjacent IPC, project open/save, audio import, analysis stages, and pitch progress. Task 7 verifies tests, build, Electron startup, and root `logs/` creation.
- Placeholder scan: The plan contains concrete file paths, event names, commands, and expected results. It does not contain open placeholders.
- Type consistency: `LogEntry`, `RendererLogEntry`, `RendererLogger`, and `AppLogger` names are introduced before later tasks use them. The first-version level is consistently `trace`.
