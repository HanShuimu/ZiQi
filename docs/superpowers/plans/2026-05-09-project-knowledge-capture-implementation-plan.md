# Project Knowledge Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create focused documentation that captures long-term Electron project boundary principles and the project save/open retrospective without expanding `AGENTS.md`.

**Architecture:** Keep durable architectural guidance separate from time-bound execution notes. Add one stable architecture document under `docs/architecture/` and one retrospective under `docs/superpowers/handoffs/`; do not modify product code or `AGENTS.md`.

**Tech Stack:** Markdown documentation, existing `docs/` tree, PowerShell verification commands.

---

## File Structure

- Create `docs/architecture/electron-project-boundaries.md`
  - Long-term architecture guidance for Electron main/preload/renderer project boundaries.
  - Should be reusable by future specs and plans.
  - Should not mention specific commit hashes or task execution logs.

- Create `docs/superpowers/handoffs/2026-05-09-project-save-open-retrospective.md`
  - Time-bound retrospective for the project save/open implementation.
  - Records what was built, what reviews caught, late tests, process notes, and follow-up risks.
  - May mention concrete issues found during review, but should not become an implementation plan.

- Do not modify `AGENTS.md`.
- Do not modify product code.

---

## Task 1: Add Electron Project Boundary Architecture Note

**Files:**
- Create: `docs/architecture/electron-project-boundaries.md`

- [ ] **Step 1: Create the architecture directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path 'docs\architecture'
```

Expected: directory exists at `docs/architecture`.

- [ ] **Step 2: Create the architecture note**

Create `docs/architecture/electron-project-boundaries.md` with exactly this content:

```md
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
```

- [ ] **Step 3: Verify the architecture note stays focused**

Run:

```powershell
Select-String -Path 'docs\architecture\electron-project-boundaries.md' -Pattern 'commit|PR|Task 1|Task 2|TODO|TBD'
```

Expected:

- No `TODO` or `TBD` matches.
- No `Task 1` or `Task 2` matches.
- `commit` may appear only in architectural phrases such as "commit point" or "commits the opened project location".

- [ ] **Step 4: Commit Task 1**

Run:

```powershell
git add -- 'docs/architecture/electron-project-boundaries.md'
git commit -m "Add Electron project boundary architecture note"
```

---

## Task 2: Add Project Save/Open Retrospective

**Files:**
- Create: `docs/superpowers/handoffs/2026-05-09-project-save-open-retrospective.md`

- [ ] **Step 1: Create the retrospective**

Create `docs/superpowers/handoffs/2026-05-09-project-save-open-retrospective.md` with exactly this content:

```md
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
```

- [ ] **Step 2: Verify the retrospective stays retrospective**

Run:

```powershell
Select-String -Path 'docs\superpowers\handoffs\2026-05-09-project-save-open-retrospective.md' -Pattern 'TODO|TBD|must implement|Step 1|Step 2'
```

Expected:

- No `TODO` or `TBD` matches.
- No imperative implementation checklist language.

- [ ] **Step 3: Verify `AGENTS.md` was not modified**

Run:

```powershell
git diff -- AGENTS.md
```

Expected: no output.

- [ ] **Step 4: Commit Task 2**

Run:

```powershell
git add -- 'docs/superpowers/handoffs/2026-05-09-project-save-open-retrospective.md'
git commit -m "Add project save open retrospective"
```

---

## Task 3: Final Documentation Verification

**Files:**
- Verify only.

- [ ] **Step 1: List created documentation**

Run:

```powershell
Get-ChildItem -Recurse -File -LiteralPath 'docs\architecture','docs\superpowers\handoffs' | Select-Object FullName
```

Expected output includes:

- `docs\architecture\electron-project-boundaries.md`
- `docs\superpowers\handoffs\2026-05-09-project-save-open-retrospective.md`

- [ ] **Step 2: Check repository status**

Run:

```powershell
git status --short --branch
```

Expected: clean working tree after the two documentation commits.

- [ ] **Step 3: Summarize verification**

Report:

- `AGENTS.md` unchanged.
- Architecture document added.
- Retrospective document added.
- No product code changed.

---

## Self-Review

### Spec Coverage

- `AGENTS.md` remains unchanged: covered by Task 2 Step 3 and Task 3 summary.
- Long-term architecture principles: covered by Task 1.
- Time-bound retrospective: covered by Task 2.
- No product code changes: file structure limits tasks to docs.
- Focused documents, not plans or product requirements: covered by Task 1 Step 3 and Task 2 Step 2.

### Placeholder Scan

The plan contains no deferred placeholders. The only occurrences of `TODO` and `TBD` appear inside verification commands that check the generated documents do not contain those terms.

### Type Consistency

This is documentation-only work. File paths and document titles are consistent across the plan:

- `docs/architecture/electron-project-boundaries.md`
- `docs/superpowers/handoffs/2026-05-09-project-save-open-retrospective.md`
