# Unified Logging Design

Date: 2026-05-29

## 1. Purpose

ZiQi currently has no unified application logging. Most failures are converted into user-facing messages, and long-running actions such as opening a project can appear stuck because there is no stage-by-stage visibility.

This design adds a first-version logging foundation for the Electron app. Each program start creates one log file under the ZiQi program root `logs/` directory and mirrors the same log entries to the console.

## 2. Goals

- Create a unified logging capability for Electron main, preload, and renderer code.
- Create a log file on every program start.
- Write logs to the ZiQi program root `logs/` directory, not the opened music project directory.
- Name log files as `Ziqi-YYYYMMDD-HHMMSS.log`.
- Mirror every log entry to the console.
- Use structured, readable text lines with timestamp, process area, level, event name, message, and optional details.
- Set the first-version effective log level to `trace`.
- Add logs to startup, IPC boundaries, project open, audio import, save project, audio analysis, and playback resource loading points.
- Make long-running project open and import paths observable enough to identify where time is spent.

## 3. Non-Goals

- Do not add user-facing log settings in the first version.
- Do not add `npm start` logging parameters in the first version.
- Do not implement dynamic log-level selection yet.
- Do not add log rotation, compression, deletion, upload, or a UI log viewer.
- Do not write logs inside `.ziqiproject` folders or `.ziqi` files.
- Do not change audio analysis precision or behavior while adding logs.

## 4. Recommended Approach

Implement a small internal logger with a shared event shape and environment-specific sinks.

Electron main owns the application log session:

- determine the program root;
- create `<programRoot>/logs/` if needed;
- create `Ziqi-YYYYMMDD-HHMMSS.log` once during startup;
- write main-process log entries directly to the file and console;
- expose a renderer logging IPC endpoint.

The renderer uses a logger facade that writes to console and forwards entries to main through preload. Main appends forwarded renderer entries to the same session log file.

The first version should always emit `trace` and above. Because `trace` is the lowest level for this design, no filtering is needed yet. Later log-level configuration can be added without changing call sites.

## 5. Log Format

Each log line should be a single line:

```text
2026-05-29T21:03:05.123+08:00 [renderer] TRACE project.open.waveform.end durationMs=142 frameCount=240 "Built waveform overview"
```

Fields:

- timestamp: local ISO-like timestamp with timezone offset;
- area: `main`, `preload`, or `renderer`;
- level: first version uses `TRACE`, with helpers available for future levels;
- event: stable dot-separated event name;
- details: flattened key-value pairs for searchable facts;
- message: short human-readable summary.

Details should stay small and safe. Log file paths, project names, durations, counts, and error names/messages are acceptable. Audio binary data, decoded samples, and full project JSON are not logged.

## 6. Architecture

Add a main-process logger module under `electron/platform/logging/`.

Responsibilities:

- create and hold the current log session;
- append log entries to the session file;
- mirror entries to console;
- safely serialize errors and details;
- avoid throwing logging errors back into product flows.

Add a renderer logger module under `src/services/logging/`.

Responsibilities:

- provide a small typed API for renderer call sites;
- write to browser console;
- forward entries to `window.ziqiApp.log`;
- continue silently if the preload API is unavailable.

Extend preload with:

```ts
log(entry: RendererLogEntry): void
```

The preload method should send the entry over IPC without exposing Node filesystem access to the renderer.

## 7. Logging Coverage

Main process:

- app startup begin/end;
- user settings read;
- protocol registration;
- IPC handler registration;
- BrowserWindow creation and load target;
- project open dialog start/cancel/selected;
- project file read start/end/failure;
- project audio read start/end/failure;
- project save start/end/failure;
- audio file selection and audio file read;
- renderer log IPC receipt failures.

Renderer:

- command start/cancel/end/failure for open project and import audio;
- object URL creation and cleanup;
- waveform analysis start/end/failure;
- existing spectrogram overview start/end/failure while it remains in the flow;
- pitch heatmap decode start/end/failure;
- pitch engine load start/end/failure;
- pitch heatmap frame analysis progress for long analysis runs;
- playback source load start/end/failure;
- project state commit.

Pitch heatmap progress should be throttled so the log remains useful. A reasonable first rule is to log the first frame, last frame, and then periodic progress at a stable interval or frame stride.

## 8. Error Handling

Logging must never be the reason a project open or import fails.

If file logging fails:

- keep console logging alive;
- emit one console warning from main;
- continue app startup.

If renderer-to-main log forwarding fails:

- keep renderer console logging alive;
- do not surface a user-facing error.

Product errors should keep their current user-facing messages, but the logs should include the underlying error message where available.

## 9. Testing

Unit tests should cover:

- log file name formatting;
- log line formatting;
- safe serialization of errors and details;
- main logger creates `logs/` and appends entries;
- renderer logger forwards entries and tolerates missing preload API;
- open project command emits ordered stage logs in the success path;
- open project command emits failure logs before setting the user-facing error;
- pitch heatmap service emits progress logs without changing analysis output.

Existing tests for project open, import, audio analysis, and build should continue to pass.

## 10. Success Criteria

- Starting the app creates `logs/Ziqi-YYYYMMDD-HHMMSS.log` in the ZiQi program root.
- Log entries appear both in the console and the session log file.
- Opening a project produces enough stage logs to identify the slow step.
- Long pitch heatmap analysis produces progress logs.
- Logging failures do not block startup, project open, import, save, playback, or analysis.
- No logs are written into opened music project folders.
