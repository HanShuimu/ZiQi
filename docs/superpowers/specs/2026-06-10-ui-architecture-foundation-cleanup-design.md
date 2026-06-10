# UI Architecture Foundation Cleanup Design

Date: 2026-06-10

## 1. Purpose

ZiQi's current UI works, but several foundations make iteration expensive:

- the Vite browser entry crashes outside Electron because renderer code assumes `window.ziqiApp` exists;
- renderer TypeScript checking is not a first-class verification step;
- app session state mixes runtime APIs, project state, UI settings, analysis data, and command factories;
- `SpectrogramView` owns too many unrelated responsibilities;
- business UI can still write raw controls and hard-coded visual values instead of using project UI primitives and tokens;
- unused historical workspace surfaces and project fields create product and code ambiguity.

This design tightens those foundations without redesigning the visible workbench.

## 2. Goals

- Make the renderer usable in the normal Vite browser development environment.
- Add reliable renderer type checking to the verification chain.
- Narrow session/runtime/UI settings boundaries.
- Split `SpectrogramView` by model, interaction, and rendering responsibilities while preserving behavior.
- Enforce UI primitives for business controls with lint rules and remove existing production violations in the same implementation.
- Enforce token-first styling for app chrome, controls, status, and skin-owned visuals.
- Clarify or remove stale UI surfaces and legacy workspace concepts.

## 3. Non-Goals

- Do not redesign the main control zone into an audio-software-style console in this project.
- Do not add busy-state or error-state UI in this project; that will be handled in a later design.
- Do not change audio playback service semantics.
- Do not change Electron main/preload filesystem authority.
- Do not redesign the spectrogram visuals or heatmap rendering algorithm.
- Do not introduce a broad generic design system or canvas engine.
- Do not remove persisted project fields in a way that breaks older project files.

## 4. Runtime Boundary

Renderer code should not call `window.ziqiApp` directly from ordinary business or session components. Instead, the app should use a small runtime boundary.

Recommended layout:

```text
src/app/runtime/
  RuntimeProvider.tsx
  RuntimeContext.tsx
  electronRuntime.ts
  devRuntime.ts
  types.ts
```

The runtime contract should cover the existing preload operations:

- user settings;
- menu command subscription;
- audio file selection;
- project save/open/activation;
- renderer logging;
- app version.

Electron runtime uses `window.ziqiApp`. Dev runtime is used when `window.ziqiApp` is absent.

The dev runtime should be intentionally narrow:

- return default user settings;
- provide no-op menu command subscription;
- support app startup and empty-project UI;
- reject or no-op file operations with clear development errors if called.

The dev runtime must not claim filesystem authority or emulate real project save/open behavior.

## 5. Renderer Type Checking

Build verification must include renderer TypeScript checking.

The implementation should add a renderer typecheck entry that works without requiring the Electron config to be `composite`. Acceptable approaches:

- add `tsconfig.renderer.json` for `src/**/*`;
- or adjust project references so `tsc -p tsconfig.json` works cleanly.

Add scripts such as:

```json
{
  "typecheck": "tsc -p tsconfig.renderer.json && tsc -p tsconfig.electron.json"
}
```

`npm run build` should include renderer typecheck or the implementation plan should add a separate required verification command. Existing test files must not pass props that no longer exist on component contracts.

## 6. Session Boundary Cleanup

`AppSessionProvider` currently owns too many responsibilities. The cleanup should narrow boundaries without changing user-visible project behavior.

Recommended ownership:

- runtime provider owns Electron/dev runtime access;
- project session owns project state, project location, analysis overviews, and project commands;
- UI settings owns skin selection and persistence;
- workbench components receive already-composed data and callbacks.

This change should keep import/open/save command behavior intact. Busy and error display should not be redesigned here, but existing command state may remain available for the later busy/error UI design.

## 7. SpectrogramView Split

`SpectrogramView` should become a layout and data wiring component, not the owner of every spectrogram responsibility.

### 7.1 Model Layer

Move pure calculation into testable functions that do not depend on React, DOM, or canvas:

- time grid creation;
- bar grid creation;
- rendered waveform point aggregation;
- spectrogram-to-pitch-energy compatibility conversion;
- viewport-based frame and point filtering where appropriate;
- time, percentage, and pitch lane mapping helpers.

These functions should receive data and return render-ready values.

### 7.2 Interaction Layer

Introduce focused hooks:

- `useSpectrogramViewport` for controlled/uncontrolled viewport, reset key, zoom, pan, and `onViewportChange`;
- `usePitchHover` for pointer state, pointer handlers, pitch/time mapping, and hover reset behavior.

The hooks should make state ownership explicit:

- persisted workspace state stays outside the hooks;
- transient hover state stays inside `usePitchHover`;
- render-derived data stays in pure functions or memoized values.

### 7.3 Rendering Layer

Split rendering into purpose-specific components:

- `SpectrogramHoverStatus`;
- `WaveformStrip`;
- `PitchAxis`;
- `PitchHeatmapCanvas`;
- `SpectrogramOverlayLayer`;
- existing `SpectrogramTimelineNavigator`.

`PitchHeatmapCanvas` should own imperative canvas drawing and only redraw when visible frames or display settings change.

`SpectrogramOverlayLayer` should render overlay visuals such as time grid, bar grid, playback cursor, hover row, and hover time line. Future marker, selection, loop-range, or snap overlays should extend this layer or its children rather than bloating `SpectrogramView`.

### 7.4 Migration Constraints

- Preserve current visual behavior and class names unless a class becomes clearly obsolete.
- Avoid broad DOM layout changes.
- Keep the two-column waveform/axis/canvas/navigator alignment.
- Do not introduce a generic drawing engine.
- Keep analysis data separate from UI display aggregation.

## 8. UI Primitive Enforcement

Business UI must use project UI primitives for controls. This is a hard rule, not a preference.

### 8.1 Prohibited Raw Controls

Production React code in the enforced business UI scope must not render raw JSX controls.

The initial enforced scope is:

- `src/features/**/*`;
- `src/workspaces/**/*`;
- `src/components/**/*`;
- `src/app/**/*`;
- `src/App.tsx`.

Prohibited JSX elements:

- `button`;
- `input`;
- `select`;
- `textarea`.

Allowed locations:

- `src/ui/**/*`;
- `src/skins/**/*`;
- test files;
- Electron main/preload code when it is not rendering React UI.

Allowed raw elements in business UI:

- semantic and layout elements such as `div`, `section`, `main`, `header`, `p`, `span`, `strong`, and headings;
- `canvas` for analysis rendering;
- non-interactive SVG or drawing elements when they are part of visualization.

### 8.2 Required Primitive Set

The implementation should add or complete the smallest primitive set needed to clear current production violations:

- `Button`;
- `IconButton` if icon-only controls are introduced during cleanup;
- `Field`;
- `NumberField`;
- `SliderField`;
- `SegmentedControl`;
- `Toggle` when binary controls exist;
- `Panel`;
- `PanelSection`;
- `Tabs`;
- `ListItem`.

`WorkspaceControlZone` should be migrated so playback rate, bar grid fields, loop buttons, and heatmap display sliders do not use raw `button` or `input`.

### 8.3 Lint Enforcement

Add an ESLint architecture rule, or a restricted syntax rule if sufficient, that fails on raw controls outside allowed directories.

The implementation must not rely on long-term `eslint-disable` comments or broad allowlists. If a rare exception is required, it must be narrow, documented near the exception, and covered by the spec or implementation plan.

## 9. Token Enforcement

Business styling must be token-first for app chrome, controls, status visuals, and skin-owned surfaces.

### 9.1 Token Coverage

Existing skin tokens should be expanded to cover:

- text and muted text;
- app and panel surfaces;
- strong surfaces;
- borders and strong borders;
- accent and strong accent;
- focus ring;
- danger/error;
- success if needed;
- control radius;
- panel radius;
- item radius;
- shadows.

Analysis visualization tokens should cover fixed UI colors around the heatmap:

- playhead;
- hover line;
- time grid;
- bar grid;
- waveform gradient endpoints;
- spectrogram background;
- axis background;
- piano white key;
- piano black key.

Data-driven heatmap color mapping may remain algorithmic and does not need to be skin-tokenized.

### 9.2 Prohibited Hard-Coded Styling

Production CSS outside token files should not introduce hard-coded theme/control/status colors such as:

- `#...`;
- `rgb(...)`;
- `rgba(...)`;
- `hsl(...)`;
- `hsla(...)`.

Allowed locations:

- `src/skins/**/tokens.css`;
- third-party skin adapter boundaries when unavoidable;
- audio visualization algorithms that compute data colors.

The implementation may use a local style lint script if ESLint is not the right tool for CSS scanning. `npm run lint` should run this check.

### 9.3 Migration Requirement

This cleanup should clear all existing production violations in the enforced UI and CSS scopes rather than adding rules with a permanent baseline.

If a temporary migration exception is unavoidable, it must be:

- narrow;
- explicitly named;
- scheduled for removal in the implementation plan;
- not used for raw controls in `WorkspaceControlZone`.

## 10. Historical UI and Workspace Residue

Unused current-workbench components and persisted historical workspace fields should be clarified.

`ProjectSidebar` and `WorkbenchDocks` are not active surfaces in the focused workbench. The implementation should either:

- remove unused component files and exports if no current code imports them;
- or move/mark them as future surfaces with clear documentation.

Persisted fields such as `preset`, `activeDock`, and `gridEnabled` should not be removed if doing so risks older project compatibility. If retained, their current status should be documented as compatibility or future-facing state not consumed by the focused UI.

## 11. Data Flow

Recommended app-level flow:

```text
Electron preload or dev runtime
  -> RuntimeProvider
  -> ProjectSessionProvider and UI settings
  -> App/WorkbenchShell
  -> TranscriptionWorkspace
  -> SpectrogramViewer
  -> SpectrogramView subcomponents
```

Spectrogram flow:

```text
project workspace + analysis overview + playback state
  -> pure model helpers
  -> interaction hooks
  -> focused rendering components
```

Business UI should receive primitive components from `src/ui`. Concrete skins and raw control implementations stay behind `src/ui` and `src/skins`.

## 12. Error Handling

This project does not redesign user-facing busy or error states.

Runtime boundary errors should still be explicit:

- missing Electron APIs should fall back to dev runtime only in browser development;
- dev runtime file operations should fail with clear development errors if called;
- Electron runtime should preserve existing preload error behavior.

Typecheck and lint failures are development-time errors and should fail verification commands.

## 13. Testing Strategy

Automated tests should cover:

- app starts in a browser-like environment without `window.ziqiApp`;
- Electron runtime still delegates to `window.ziqiApp`;
- UI settings load through runtime, not direct global access;
- raw control lint rule rejects business UI controls and allows `src/ui`/`src/skins`;
- style token lint rejects hard-coded colors outside allowed token/visualization boundaries;
- UI primitives pass through common props and adapter behavior;
- `WorkspaceControlZone` behavior remains intact after primitive migration;
- spectrogram pure model helpers cover time grid, bar grid, waveform aggregation, and conversion behavior;
- extracted spectrogram hooks/components preserve current hover, playback cursor, grid, canvas, and navigator behavior.

Verification commands should include:

- renderer typecheck;
- `npm run lint`;
- `npm test`;
- `npm run build`.

Because the app crosses Electron boundaries, a later implementation plan may include an Electron smoke test if runtime boundary changes touch preload/main behavior. At minimum, implementation completion should confirm the production Electron app still exposes `window.ziqiApp` and loads the renderer.

## 14. Acceptance Criteria

The cleanup is complete when:

- Vite browser development starts without a blank screen caused by missing `window.ziqiApp`;
- renderer type checking is a normal verification step;
- session/runtime/UI setting responsibilities are narrower and clearly named;
- `SpectrogramView` is reduced to layout and data wiring;
- spectrogram model, interaction, canvas, overlay, waveform, pitch axis, and hover status responsibilities are independently testable;
- business UI production code has no raw `button`, `input`, `select`, or `textarea` outside allowed primitive/skin boundaries;
- `WorkspaceControlZone` has no raw controls;
- `npm run lint` enforces raw control and token rules;
- production CSS uses tokens for app chrome, controls, status, and fixed analysis UI colors;
- stale workbench UI surfaces are removed or clearly marked;
- persisted legacy workspace fields are either documented or safely retained for compatibility;
- required verification commands pass.
