# Focused Workbench Cleanup Design

Date: 2026-05-20

## 1. Purpose

The current workbench gives too much first-screen space to areas that do not yet serve the core listening and spectrum workflow. The left `ProjectSidebar` and bottom `WorkbenchDocks` currently expose project assets, annotations, analysis runs, stems, notes, compare, and hidden tabs, but those areas are either not useful yet or are placeholders for later workflows.

This design focuses the workbench on one useful Milestone 1 experience:

1. Confirm which project and source audio are open.
2. Inspect waveform and spectrogram.
3. Play, pause, seek, change speed, and manage one loop range.
4. Keep waveform, spectrogram, playhead, loop range, and navigator visually aligned.
5. Preserve existing workspace persistence for playback rate, loop range, and spectrogram viewport.

The goal is UI cleanup and layout clarification, not new audio-analysis capability.

## 2. Current Problems

### 2.1 Left Rail Has No Current Core Use

The left `ProjectSidebar` shows project metadata, assets, and annotations. In the current workflow, assets and annotations are not actively editable or required for basic listening. Keeping this rail visible makes the application feel broader than the implemented experience.

### 2.2 Bottom Docks Are Mostly Future Surface

The bottom `WorkbenchDocks` show Analysis, Stems, Notes, Compare, and Hidden tabs. Analysis and stems are not ready as active workflows, notes are placeholder text, and compare/hidden do not improve the current task. This creates visual noise and implies capabilities that are not available.

### 2.3 Controls Need a Clear Home

The existing playback, rate, and loop controls should remain available, and the control area needs room for future workspace tools. A thin row of buttons below the spectrum will not scale well.

### 2.4 Waveform and Spectrum Are Misaligned

The spectrogram has a left piano axis, while the waveform spans a different horizontal area. This causes the waveform, spectrogram playhead, and navigator to feel visually offset even when they represent the same time.

### 2.5 Navigator Combines Two Concepts

The bottom navigator currently places the playback position and the visible viewport on one track. The playhead and viewport thumb can overlap, making both status and interaction less clear.

### 2.6 Playhead Contrast Is Too Low

The current brown playhead line is not clear enough on the black spectrogram background. The playhead should stand out from the spectrum, waveform, and loop highlight.

## 3. Scope

### 3.1 In Scope

- Remove the visible left `ProjectSidebar` from the loaded-project workbench.
- Remove the visible bottom `WorkbenchDocks` from the loaded-project workbench.
- Show minimal project context in the topbar.
- Keep the `Primary Workspace` as the single loaded-project workspace area.
- Move playback, speed, loop, and future workspace controls into an independent grouped control zone above the waveform.
- Align waveform, spectrogram, and navigator by using a shared two-column grid:
  - fixed left axis column;
  - flexible right time-canvas column.
- Keep the left column as blank alignment space for waveform and navigator rows, and as the piano axis for the spectrogram row.
- Split the navigator into two tracks:
  - playback progress track;
  - viewport range track.
- Change the playhead color to a high-contrast blue/cyan treatment that remains visible on the black spectrogram.
- Keep existing playback, playback-rate, loop, seek, and viewport behavior.
- Update tests to match the focused layout.

### 3.2 Out of Scope

- Building a full startup page.
- Adding recent projects, save-state badges, or autosave UI.
- Implementing new analysis providers, stems, notes, compare, marker editing, or asset workflows.
- Removing project data model fields for assets, annotations, analysis runs, or workspace preset.
- Changing Electron file menu behavior.
- Changing playback service semantics.
- Adding a new preferences panel or skin behavior.

## 4. Topbar Design

The loaded-project topbar should carry only enough information to identify the current work context.

Show:

- project name as the primary title;
- source audio file name as secondary text;
- source audio duration;
- source audio channel count;
- source audio sample rate.

Do not show:

- workspace preset;
- assets count;
- annotation count;
- analysis status;
- provider status;
- command buttons.

The topbar should remain informational. File-level actions continue to belong in the native Electron menu.

When no project is loaded, the existing simple empty state should remain: "No project loaded" plus a prompt to use the File menu to import audio or open a project. Do not add a large import button or full startup page in this cleanup.

## 5. Primary Workspace Layout

With the left rail and bottom docks removed, the loaded-project workbench becomes a single-column page:

```text
Topbar

Primary Workspace
  Header: Raw Spectrum
  Grouped Control Zone
  Time-Aligned Spectrum Area
    left axis column | waveform row
    piano axis       | spectrogram canvas
    left spacer      | navigator rows
```

The primary workspace should remain the dominant surface on the page. The spectrum is still the central object, but controls are elevated into a real workspace control zone because this area will gain more capabilities later.

## 6. Grouped Control Zone

The control zone should sit inside the `Primary Workspace`, above the waveform overview.

It should be grouped by purpose, not forced into a single fixed row or a permanent two-line layout. The layout may wrap responsively, but the conceptual groups should remain clear:

- Playback: play/pause and current time / duration.
- Speed: supported playback-rate options.
- Loop: set loop start, set loop end, clear loop, and active loop summary.
- Future tools: reserved area for later workspace controls when they become real.

This design keeps the existing control capabilities and gives future controls a predictable home without recreating the removed docks as placeholder UI.

## 7. Time Alignment Model

The waveform, spectrogram, playhead, loop range, and navigator should share the same horizontal time column.

Use a two-column grid:

```text
52px left column | minmax(0, 1fr) time column
```

Rows:

- Waveform row: left column is blank, right column is waveform.
- Spectrogram row: left column is the piano axis, right column is the spectrogram canvas.
- Navigator row: left column is blank, right column contains the navigator tracks.

Do not put `wave`, `time`, or `nav` labels in the left column. The left column exists for alignment and the piano axis only. Removing those labels keeps the UI cleaner and avoids drawing attention away from the audio view.

All time-based rendering should use the right time column:

- waveform playhead;
- spectrogram playhead;
- loop-range overlay;
- playback progress track;
- viewport range track.

## 8. Playhead Styling

The playhead should use a high-contrast blue/cyan color instead of brown.

Recommended treatment:

- Spectrogram playhead: bright cyan/blue line with a subtle glow or light outline for black-background visibility.
- Waveform playhead: same hue, slightly more restrained so it does not overpower the waveform.
- Navigator playhead: same hue, simple line.

The playhead must remain visually distinct from:

- warm waveform colors;
- orange loop-range overlays;
- viewport thumb styling;
- white or bright spectrogram content.

## 9. Dual-Track Navigator

The navigator should separate playback progress from viewport range.

Use two stacked tracks in the right time column:

```text
Playback progress track
Viewport range track
```

Playback progress track:

- shows the current playback position;
- may support click-to-seek if the current component already supports seeking through the navigator.

Viewport range track:

- shows the current visible spectrogram viewport;
- supports existing viewport drag/change behavior.

This avoids putting the playhead through the viewport thumb, reduces visual conflict, and keeps interaction targets distinct.

## 10. Component Responsibilities

### 10.1 WorkbenchShell

`WorkbenchShell` remains responsible for:

- rendering the empty-project state;
- rendering the loaded-project topbar;
- passing project, audio facade, waveform overview, spectrogram overview, and workspace update callbacks into the transcription workspace.

For loaded projects, the topbar should use project-specific display values rather than the generic `Transcription Workbench` title as the main content.

### 10.2 TranscriptionWorkspace

`TranscriptionWorkspace` should become a single-workspace layout.

It should:

- render the main spectrum workspace;
- stop rendering `ProjectSidebar`;
- stop rendering `WorkbenchDocks`.

Whether the unused component files are deleted immediately can be decided during implementation. The design requirement is that these surfaces are no longer part of the focused workbench UI.

### 10.3 SpectrogramViewer

`SpectrogramViewer` should continue coordinating runtime behavior:

- read playback state from the audio facade;
- call playback service methods for play, pause, seek, rate changes, and loop changes;
- report workspace patches upward for persistence.

It should pass control props into the grouped control zone and visual props into the spectrogram view.

### 10.4 WorkspaceControlZone

A dedicated control-zone component should be introduced or extracted if it keeps the implementation clearer.

It should:

- render playback, speed, and loop groups;
- receive current playback and loop state as props;
- call the existing handlers supplied by `SpectrogramViewer`;
- avoid owning project persistence or playback service access directly.

This keeps future workspace tools from bloating `SpectrogramView`.

### 10.5 SpectrogramView

`SpectrogramView` should focus on visual time rendering:

- waveform overview;
- piano axis;
- spectrogram canvas;
- playhead and loop overlays;
- dual-track timeline navigator;
- viewport interactions.

It should not directly save project data and should not know about Electron project files.

## 11. Data Flow

Playback state flow:

```text
audioFacade.playback
  -> SpectrogramViewer local playbackState
  -> WorkspaceControlZone and SpectrogramView
```

User control flow:

```text
WorkspaceControlZone or SpectrogramView interaction
  -> handler supplied by SpectrogramViewer
  -> audioFacade.playback method
  -> refreshed playbackState
  -> onWorkspaceChange when persistent workspace state changes
```

Persistent workspace updates remain limited to existing Milestone 1 state:

- `playbackRate`;
- `loopRange`;
- `spectrogramViewport`.

## 12. Error Handling

Import errors should continue to use the existing `importError` display path.

Playback, rate, seek, or loop operations should not create a separate optimistic UI state. The visible controls and playhead should continue to reflect the playback service state after operations complete.

Invalid loop creation should remain guarded:

- a loop end at or before the start should not create a loop;
- clearing an existing loop should always return to no active loop;
- restored loop state should remain subject to existing project/open validation.

If spectrogram data is still being generated or unavailable, the spectrum area should keep the existing empty/generating state behavior.

## 13. Testing Strategy

Component tests should verify:

- loaded-project workbench no longer renders `ProjectSidebar` content such as Assets and Annotations;
- loaded-project workbench no longer renders dock tabs such as Analysis, Stems, Notes, Compare, or Hidden;
- topbar shows project name, source audio name, duration, channel count, and sample rate;
- topbar does not show workspace preset;
- grouped control zone renders above the waveform;
- existing play/pause behavior still calls the playback service;
- playback rate controls still call `setPlaybackRate` and report `onWorkspaceChange`;
- loop controls still set and clear loop ranges;
- waveform, spectrogram, and navigator rows share the aligned two-column layout;
- spectrogram playhead uses the new high-contrast playhead styling;
- navigator renders separate playback and viewport tracks;
- viewport changes still report `spectrogramViewport`.

Verification commands should include:

- `npm test`;
- `npm run build`.

Because this is an Electron audio workflow, implementation completion also requires a real Electron smoke test:

1. Build and launch the Electron app.
2. Confirm `window.ziqiApp` exists in the renderer.
3. Import or open a real audio project.
4. Confirm the focused workbench has no left rail or docks.
5. Confirm topbar metadata is correct.
6. Confirm waveform and spectrogram are aligned against the same time column.
7. Play, pause, seek, change speed, set/clear loop.
8. Confirm the cyan/blue playhead is visible on the spectrogram.
9. Confirm the navigator has separate playback and viewport tracks.
10. Save and reopen the project, confirming rate, loop, and viewport restore.

## 14. Acceptance Criteria

The cleanup is complete when:

- the loaded-project workbench uses a single focused primary workspace;
- `ProjectSidebar` and `WorkbenchDocks` are not visible in the focused workbench;
- the topbar shows only minimal project/audio context and does not show preset;
- playback, speed, loop, seek, and viewport behavior remain available;
- the grouped control zone sits above the waveform and is structured for future tools;
- waveform, spectrogram, playhead, loop range, and navigator align in the same right-side time column;
- the left column is blank for waveform and navigator rows and contains the piano axis for the spectrogram row;
- the playhead is clearly visible against the black spectrogram background;
- the navigator separates playback progress from viewport range;
- automated tests pass;
- build passes;
- Electron smoke verifies the real runtime workflow.
