# Electron Project Boundaries

## Purpose

This note captures long-term boundaries for ZiQi features that combine Electron, project files, local audio files, and renderer-side audio workflows. It is intended to be referenced by future specs and plans before changing project save/open behavior, preload IPC, local file access, or audio object URL lifecycle.

Keep this document focused on durable architecture rules. Task-specific execution history belongs in retrospectives or handoff notes.

## Local Filesystem Authority

Electron main is the authority for local filesystem access. Renderer-provided paths are project metadata, not permission to read, copy, overwrite, or delete local files.

When renderer needs main to touch a local file, main should rely on one of these trusted sources:

- A file or directory selected through an Electron system dialog.
- A path already loaded from a trusted project file and validated against its project root.
- A main-owned token or pending state that was created from one of the above sources.

Renderer should not be able to grant new filesystem access by mutating a path string inside project state.

## Project Save/Open State Model

Project save/open crosses three state owners:

- Electron main owns filesystem authorization and project file IO.
- Renderer owns UI state, waveform state, and object URLs.
- The project file owns persisted project state.

Do not commit cross-boundary project state in main until renderer has successfully activated the project. For project open flows, prefer a pending state:

1. Main reads and validates the `.ziqi` file.
2. Main reads the project audio bytes.
3. Main returns the project data and audio bytes to renderer as a pending open result.
4. Renderer rebuilds waveform data, loads playback media, seeks to a safe position, and updates UI state.
5. Renderer calls an activation IPC.
6. Main commits the opened project location as the current authorized save target.

If renderer activation fails, main should keep the previous project authorization.

## Renderer Activation Pattern

Renderer activation should be treated as a commit point. State changes that must stay synchronized across main and renderer should happen only after all preconditions succeed.

For project open, renderer should complete these steps before activating the opened project in main:

- Create a playback object URL from returned audio bytes.
- Rebuild waveform data from returned audio bytes.
- Load the audio facade with the playback URL.
- Seek playback to a known safe position.
- Commit React project and waveform state.
- Tell main that the opened project is active.

If any step fails, renderer should preserve the previous visible project and playback state where possible.

## Audio Data Ownership

Audio binary data has explicit ownership boundaries:

- Main may read audio bytes from trusted local files.
- Renderer may create playback blobs and pass independent buffers to Web Audio.
- Web Audio APIs may consume or detach buffers, so playback blobs should be created before handing audio data to APIs that can mutate buffer lifecycle.

Project files should not persist raw renderer `ArrayBuffer` values, blob URLs, object URLs, or decoded browser audio objects.

## Object URL Lifecycle

Renderer-created object URLs are runtime resources. They must be released when no longer active.

Required cleanup points:

- A new import or open succeeds and replaces the active playback URL.
- An import or open fails after creating a new playback URL.
- The app component unmounts.

Failure cleanup should not revoke the previous active playback URL when the visible project is preserved.

## What Project Files Should Not Store

The `.ziqi` project file should store recoverable project state, not transient runtime data.

Do not store:

- Waveform overview data unless a future performance requirement explicitly adds a cache design.
- `ArrayBuffer` audio data.
- Blob URLs or object URLs.
- Browser media element state.
- Renderer-only temporary paths or tokens.

The project folder may store source audio copies and future durable artifacts. Generated artifacts should be indexed explicitly and validated relative to the project root.

## Verification Expectations

Changes to Electron main/preload/renderer boundaries need more than renderer unit tests.

Minimum verification:

- Unit tests for pure project file parsing, path validation, and error behavior.
- Renderer tests for cancel, failure, and state-preservation paths.
- Production build with Electron preload compiled.
- Real Electron smoke test confirming expected `window.ziqiApp` APIs exist in the renderer.

If environment limits prevent a real Electron smoke test, record that limitation in the final task summary and keep the remaining risk visible.
