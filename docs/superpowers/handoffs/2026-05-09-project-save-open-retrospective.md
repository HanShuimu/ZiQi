# Project Save/Open Retrospective

Date: 2026-05-09

## What We Built

The project save/open work added the first folder-based project loop for ZiQi:

- A `.ziqiproject` folder contains one `.ziqi` JSON project file.
- The source audio is copied into the project folder under `audio/`.
- The `.ziqi` file stores recoverable project state, not waveform data or runtime audio buffers.
- Opening a project reads the `.ziqi` file and project-local audio, then renderer rebuilds waveform data from audio bytes.
- Workbench commands expose `Open Project` and `Save Project`.

This moved the app from a single import session toward a real project workflow without adding provider flows, recent projects, automatic save, or waveform persistence.

## Design Decisions That Held Up

The folder project format stayed useful throughout implementation. Keeping `.ziqi` as JSON made project state easy to inspect while still giving the project a product-specific entry file.

Not saving waveform data was also the right first-version decision. Waveform data is currently cheap enough to regenerate and is derived from source audio. Persisting it now would introduce cache invalidation questions before the product needs that complexity.

The `audio/` source copy is important because saved projects should not depend on the user's original download or music-library path.

## Issues Caught During Review

Review found several boundary problems that were not obvious in the first implementation:

- Renderer-provided file paths cannot authorize main-process filesystem reads. Main must only copy audio paths selected through trusted Electron dialogs or validated project state.
- Main should not commit an opened project location before renderer successfully activates the project. Otherwise, renderer can keep showing the old project while main trusts the new save target.
- Project location fields such as `projectFilePath` and `projectRootPath` must be all-or-none and must match main-owned authorization state.
- Project save IPC needs a full project-shape guard before writing `.ziqi`; checking only `sourceAudio.filePath` is not enough.
- Windows path forms such as drive-relative paths, backslash traversal, and colon-containing segments need explicit rejection in project-relative paths.
- Object URLs need cleanup on replacement, failure, and component unmount.

These review findings reinforced that Electron project work is less about writing JSON and more about controlling authority and commit points across processes.

## Test Cases Added Late

Several tests were added after review exposed missing edges:

- Invalid `.ziqi` payloads and malformed project shapes.
- Project-relative path escape attempts.
- Failed first save cleanup.
- Existing project save path authorization.
- Save cancel and save failure preserving current project state.
- Open cancel and open failure preserving current project and playback URL.
- Opening a project rebuilding waveform from returned audio bytes.
- Importing a new audio file after opening a project clearing the old project location.
- Object URL cleanup on unmount.
- Activation failure preserving the previous visible project.

The strongest pattern was that failure-path tests mattered as much as success-path tests.

## Process Notes

Subagent-driven development worked well for this task because implementation and review benefited from separate attention. Implementers quickly followed the plan, while reviewers caught cross-boundary risks that the first implementation missed.

The cost was extra coordination and occasional tool limits. For high-risk Electron boundary work, the review loop was worth it. For smaller UI-only changes, the same level of subagent review may be heavier than necessary.

The written spec and plan were useful, but the implementation still revealed edge cases that belonged in review rather than initial design. Future plans for Electron file access should explicitly include attacker-style renderer inputs and main/renderer state desynchronization scenarios.

## Follow-Up Risks

The project save/open implementation still has areas worth revisiting later:

- There is no dedicated Electron IPC integration test harness yet. Main-process authorization is covered by helper tests, renderer tests, code review, and smoke checks, but not by direct IPC tests.
- The current main-process project authorization model assumes a single app window and one active project. Multi-window support would require per-window project authorization state.
- The app does not yet have automatic save, recent projects, or dirty-state indicators.
- The `.ziqi` schema does not yet include future migration support beyond `schemaVersion`.
- Manual end-to-end validation should remain part of project IO changes because system file dialogs and real local files are involved.
