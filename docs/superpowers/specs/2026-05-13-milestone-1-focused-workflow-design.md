# Milestone 1 Focused Workflow Design

Date: 2026-05-13

## 1. Purpose

Milestone 1 should close a small, real transcription workflow instead of trying to finish every `wavetone-compatible core` feature.

The target workflow is:

1. Import or open a real audio project.
2. Inspect waveform and spectrogram.
3. Seek to a useful passage.
4. Play, pause, and resume from the current position.
5. Slow down or speed up playback without changing pitch.
6. Set one loop range for repeated listening.
7. Save the project.
8. Reopen it and continue from the saved basic work state.

This milestone is successful when the main workspace is already useful without providers, stems, LLM analysis, beat grids, EQ, or marker editing.

## 2. Current Baseline

The project already has:

- Electron, React, TypeScript, and Vite application structure.
- Native File menu commands for importing audio, opening projects, and saving projects.
- Main/preload ownership of local file access.
- Local audio import that passes audio bytes into the renderer.
- Project folder save/open with `.ziqi` metadata and an `audio/` copy.
- Waveform and static spectrogram generation from real audio bytes.
- `HTMLAudioElement`-backed playback with play, pause, seek, playback rate, and loop range service methods.
- A spectrogram-centered workspace with timeline navigation.

Milestone 1 should finish the missing user-facing controls and the minimal persistence needed for that workflow.

## 3. Scope

### 3.1 Playback Rate Control

The spectrogram timeline control area should expose playback speed as a direct user control.

Supported rates for Milestone 1:

- `0.5x`
- `0.75x`
- `1x`
- `1.25x`
- `1.5x`

Changing the rate should:

- call the existing playback service rate method;
- keep pitch preservation enabled through the existing media element behavior;
- update the app's project workspace state;
- keep the displayed rate in sync with the playback service.

Freeform numeric rate entry is out of scope for this milestone.

### 3.2 Single Loop Range

The timeline should support one active loop range.

Milestone 1 only needs a single loop range because the goal is repeated listening to the current difficult passage, not a full annotation system.

The UI should allow the user to:

- set the loop start from the current playback position;
- set the loop end from the current playback position;
- clear the loop range;
- see that a loop range is active.

The playback service should remain responsible for jumping back to the loop start during playback.

Multiple named loops, loop lists, marker conversion, and note-taking are out of scope.

### 3.3 Minimal Workspace Persistence

The project workspace state should persist only the state needed to resume the Milestone 1 listening workflow:

- `playbackRate`
- `loopRange`
- spectrogram viewport start and duration

On audio import, these values should start from defaults:

- playback rate `1`
- no loop range
- default spectrogram viewport for the audio duration

On project open, the renderer should restore these values into the playback service and spectrogram view after audio is loaded successfully.

The saved playback position is intentionally out of scope for Milestone 1. Reopened projects may start at `0ms`; the important restored state is speed, loop range, and viewport.

### 3.4 Electron Runtime Verification

Milestone 1 cannot be considered complete from jsdom tests alone. It needs a real Electron smoke test because the workflow crosses main, preload, renderer, file dialogs, object URLs, media playback, and project persistence.

Manual smoke acceptance:

1. Launch the built Electron app.
2. Import a real audio file.
3. Confirm waveform and spectrogram render.
4. Play, pause, and seek.
5. Change playback speed and confirm playback continues at the selected rate.
6. Set a loop start and end, then confirm playback jumps back to the loop start.
7. Save the project.
8. Reopen the project.
9. Confirm waveform and spectrogram regenerate from project-local audio.
10. Confirm playback rate, loop range, and spectrogram viewport restore.

## 4. Out of Scope

The following remain outside this focused Milestone 1:

- BPM grid, time signature, and beat offset alignment.
- Left/right channel display modes.
- Harmonic reference lines.
- EQ or frequency-band processing.
- Marker and note editing.
- Derived audio asset workflows.
- Provider runtime.
- Stem separation.
- Analysis providers.
- LLM-assisted analysis.

These features belong to later milestones once the basic listening loop is dependable.

## 5. Data Model

`WorkspaceState` should gain the smallest shape needed for this milestone.

Conceptually:

```ts
interface WorkspaceState {
  preset: "pure-spectrum" | "spectrum-analysis" | "wide-compare";
  activeDock: "analysis" | "stems" | "notes" | "compare" | "hidden";
  gridEnabled: boolean;
  bpm: number;
  beatOffsetMs: number;
  playbackRate: number;
  loopRange?: {
    startMs: number;
    endMs: number;
  };
  spectrogramViewport?: {
    startMs: number;
    durationMs: number;
  };
}
```

Validation should stay conservative:

- playback rate must be one of the supported Milestone 1 rates;
- loop range must have finite non-negative values and `endMs > startMs`;
- viewport values must be finite, non-negative, and clamped to the current audio duration when restored.

If an opened project lacks these newer fields, the app should fall back to defaults.

## 6. Component Responsibilities

### 6.1 App

`App` owns project state and should be the bridge between saved workspace data and runtime services.

It should:

- create default workspace state on import;
- restore playback rate and loop range after opening a project and loading audio;
- receive workspace updates from the workbench;
- save the latest project state through the existing project save IPC.

### 6.2 WorkbenchShell

`WorkbenchShell` should coordinate playback controls and workspace updates.

It should:

- render the active project;
- read playback state from `audioFacade.playback`;
- call playback service methods for play, pause, seek, rate, and loop changes;
- report workspace changes upward instead of mutating project data internally.

### 6.3 SpectrogramView

`SpectrogramView` should own the visual timeline interactions.

It should:

- display waveform and spectrogram for the active viewport;
- expose playback rate controls in the timeline area;
- expose loop set/clear controls;
- render the active loop range in the timeline;
- report viewport changes so they can be persisted.

The view should not know about Electron project files or saving.

## 7. Error Handling

Playback rate changes should show the existing user-facing error channel if the playback service rejects.

Loop range setting should prevent invalid state in the UI where possible:

- setting an end before or equal to the start should not create a loop;
- clearing should always be available when a loop exists;
- opened project loop ranges outside the audio duration should be ignored or clamped safely.

Project open should not activate partially restored runtime state if audio loading or spectrogram generation fails. Existing pending-project behavior should remain intact.

## 8. Testing Strategy

Focused automated tests should cover:

- creating imported projects with default playback rate, no loop, and default viewport;
- saving workspace updates after playback rate changes;
- restoring playback rate and loop range on project open;
- `SpectrogramView` rendering rate controls and invoking the rate handler;
- loop start, loop end, clear controls, and loop range display;
- viewport changes being reported for persistence;
- legacy project data without loop or viewport fields falling back to defaults.

Real Electron smoke should verify the end-to-end workflow in section 3.4.

## 9. Acceptance Criteria

Milestone 1 is complete when:

- a user can import real audio and see waveform plus spectrogram;
- playback, pause, and seek work in the main workspace;
- playback rate can be changed from the UI and remains pitch-preserving;
- one loop range can be set, used, and cleared;
- playback rate, loop range, and spectrogram viewport save into the project;
- reopening the project restores those workspace values after audio is loaded;
- automated tests pass;
- a real Electron smoke test confirms the main/preload/renderer workflow.

