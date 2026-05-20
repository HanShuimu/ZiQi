# Long-Term Architecture and First Lint Boundary Design

## Status

Approved direction for design documentation. Implementation has not started.

## Goal

ZiQi is still early enough for a deliberate architecture reset. The current prototype already proves the important runtime capabilities: local audio import, project save/open, playback, waveform, spectrogram rendering, Electron menus, user settings, and UI skins.

The next architecture should make long-term parallel development practical. Different people should be able to own desktop platform work, audio services, project data, spectrogram interaction, annotations, stems, analysis, UI primitives, and skins without constantly editing the same central files.

The first implementation step should add a lightweight lint boundary. It should guide imports toward the target architecture without requiring the full refactor to happen in one commit.

## Non-Goals

- Do not redesign the app UI as part of this architecture work.
- Do not add new product features.
- Do not rewrite audio algorithms only for style.
- Do not enforce every future boundary in the first lint pass.
- Do not introduce a large toolchain if a small lint setup can verify the first boundary.

## Assumptions

- A one-time architecture refactor is appropriate because the project is still early.
- Existing prototype behavior should continue working during the migration.
- The renderer must keep Electron filesystem authority behind the preload/main boundary.
- Shared project state should be centralized through app session APIs, not a feature-to-feature dependency.
- Common reusable behavior should live in capabilities, core, services, or ui rather than in a concrete feature.

## Target Source Layout

```text
src/
  app/
  core/
  services/
  capabilities/
  features/
  workspaces/
  ui/
  skins/

electron/
  platform/
```

## Layer Responsibilities

### Core

`src/core` owns pure domain models and rules. It may contain project schema, audio metadata, timeline ranges, workspace state, annotations, analysis runs, assets, and settings types.

Core must not depend on React, Electron, DOM, Web Audio, browser globals, or concrete service implementations.

### Services

`src/services` owns replaceable side-effect capabilities and adapters. Examples include audio import clients, waveform services, spectrogram services, playback services, project persistence clients, and settings clients.

Services may depend on core. They should expose interfaces that allow future implementations such as workers, native modules, or remote services.

### Capabilities

`src/capabilities` owns reusable partial product abilities. Examples include timeline viewport handling, time range selection, playhead synchronization, audio region interaction, and inspector panel behavior.

Capabilities are not full user features. They can be composed by multiple features.

### Features

`src/features` owns complete user-facing feature slices. Examples include project import/save/open, spectrogram viewer, playback controls, annotation editor, stem manager, analysis runs, and skin switcher.

Features may depend on capabilities, app session APIs, core, services, and ui. Concrete features should not depend on other concrete features by default.

### Workspaces

`src/workspaces` owns product work areas that compose multiple features. The first workspace is the transcription workbench. It decides which features appear in the main area, side rail, dock panels, and command surfaces.

### App

`src/app` owns application composition: providers, app session, menu command routing, global commands, dependency wiring, runtime error surfaces, and workspace selection.

`App.tsx` should become a composition root rather than a business workflow container.

### UI

`src/ui` owns project UI primitives and provider contracts. It should not contain product-specific business behavior.

### Skins

`src/skins` owns skin adapters and design tokens. Business components should use `src/ui` primitives and should not import concrete skin packages directly.

### Electron Platform

`electron/platform` owns desktop platform modules: IPC handlers, menus, project file IO, settings storage, custom protocol handling, and local filesystem authority.

`electron/main.ts` should become startup and registration code.

## Dependency Rules

The target dependency direction is:

```text
features/*      -> capabilities/*, app/session, core/*, services/*, ui/*
capabilities/*  -> core/*, services/*, ui/*
workspaces/*    -> features/*, capabilities/*, app/session, ui/*
app/*           -> workspaces/*, services/*, core/*, ui/*
services/*      -> core/*
core/*          -> no React / Electron / DOM / browser runtime
skins/*         -> ui contracts
electron/*      -> platform code + shared IPC contract
```

Concrete feature-to-feature imports are disallowed by default. If multiple features need the same implementation, move that implementation to the narrowest correct shared layer:

- Domain type or pure rule: `core`
- Side-effect capability: `services`
- Reusable interaction ability: `capabilities`
- Current project state or command orchestration: `app/session` or `app/commands`
- Project UI expression: `ui`

An exception may be made for a feature's explicit public component, but it should be treated as a design review point. If it gains multiple consumers, prefer extracting the common part into `capabilities`.

## First Lint Boundary

The first lint implementation should be intentionally small. Its job is to prevent the most harmful dependency drift while the directory migration is still in progress.

Recommended first rules:

1. Add a project lint command.
2. Enforce TypeScript and React syntax linting for `src` and `electron`.
3. Prevent `src/core` from importing React, Electron, DOM-facing renderer modules, or service implementations.
4. Prevent `src/services` from importing concrete features, workspaces, or app composition modules.
5. Prevent `src/capabilities` from importing concrete features or workspaces.
6. Prevent `src/features/*` from importing another concrete `src/features/*` module except through an explicit reviewed public API if the first lint tool can represent that cleanly.
7. Prevent business code from importing concrete skins or third-party skin libraries directly.

Rules that are useful but can wait:

- Full TypeScript project references.
- Strict import alias migration.
- Exhaustive layer ownership checks.
- Generated dependency graphs in CI.
- CODEOWNERS-style ownership automation.

## Migration Strategy

The refactor should happen in phases:

1. Establish lint and architecture documentation.
2. Move pure domain types and functions into `src/core`.
3. Move browser and Electron-facing side-effect adapters into `src/services` and `electron/platform`.
4. Extract app session and app commands from `App.tsx`.
5. Split the current workbench into `src/workspaces/transcription`.
6. Extract spectrogram, playback, project panels, and dock panels into features.
7. Extract reusable timeline and range interaction behavior into capabilities.
8. Tighten lint rules once the target structure exists.

Each phase should preserve behavior and keep verification concrete.

## Verification Expectations

For the lint phase:

- `npm run lint` exits `0`.
- `npm run build` exits `0`.
- Existing tests still pass, or any unrelated existing failures are documented.

For later Electron boundary changes:

- Unit tests cover pure parsing, path validation, and IPC request validation.
- Renderer tests cover failure and state-preservation paths.
- Production build succeeds.
- A real Electron smoke test verifies expected `window.ziqiApp` APIs exist in the renderer.

## Open Design Decision

The first lint setup should prefer low-friction enforcement. A reasonable first pass is ESLint with import restriction rules. TypeScript project references can be introduced later if import boundaries keep drifting or build-time isolation becomes valuable.
