# Lint Warning And Electron Smoke Cleanup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `npm run lint` from 17 warnings to 0 warnings and complete a real Electron smoke verification for the current architecture.

**Architecture:** Fix true React hook issues in source code, configure intentional adapter exceptions in ESLint, and add a repeatable Electron smoke procedure that verifies the preload bridge in the running renderer.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Vitest, ESLint flat config, Electron 37.

---

## Current Evidence

Fresh verification before this plan:

- `npm run lint` exits `0` with `17 warnings` and `0 errors`.
- `npm test` exits `0` with `20` test files and `149` tests passing.
- `npm run build` exits `0`.
- `git status --short` is clean.

Current warning groups:

- `src/app/session/AppSessionProvider.tsx`
  - `react-hooks/exhaustive-deps` warning for cleanup reading `activePlaybackUrl.current`.
- `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx`
  - conditional `useRef`.
  - ref write during render.
- `src/features/spectrogramViewer/SpectrogramView.tsx`
  - synchronous setState in effect.
  - missing dependencies in canvas draw effect.
- `src/features/spectrogramViewer/SpectrogramViewer.tsx`
  - missing dependency for `handlePlaybackToggle`.
- `src/skins/default/adapter.tsx` and `src/skins/animalIsland/adapter.tsx`
  - fast refresh warnings because adapter files intentionally export adapter objects and component implementations together.
- `src/ui/types.ts`
  - empty `BackgroundProps` interface.

## File Structure

- Modify: `src/app/session/AppSessionProvider.tsx`
  - Capture playback URL ref inside cleanup to satisfy React hooks lint.
- Modify: `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx`
  - Call hooks before early return and update callback ref in an effect.
- Modify: `src/features/spectrogramViewer/SpectrogramView.tsx`
  - Remove avoidable setState-in-effect warning and complete canvas effect dependencies.
- Modify: `src/features/spectrogramViewer/SpectrogramViewer.tsx`
  - Stabilize playback handlers with `useCallback` or restructure the keyboard effect.
- Modify: `src/ui/types.ts`
  - Replace empty interface with a type alias that expresses no props.
- Modify: `eslint.config.js`
  - Configure `react-refresh/only-export-components` off for skin adapter files only.
- No planned product behavior changes.

## Task 1: Fix Session And Timeline Hook Warnings

**Files:**
- Modify: `src/app/session/AppSessionProvider.tsx`
- Modify: `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx`

- [ ] **Step 1: Fix AppSessionProvider cleanup ref access**

In `src/app/session/AppSessionProvider.tsx`, replace:

```ts
  useEffect(() => {
    return () => {
      if (activePlaybackUrl.current) {
        URL.revokeObjectURL(activePlaybackUrl.current);
      }
    };
  }, []);
```

with:

```ts
  useEffect(() => {
    const playbackUrlRef = activePlaybackUrl;

    return () => {
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
      }
    };
  }, []);
```

Expected behavior: unmount still revokes the active playback URL.

- [ ] **Step 2: Fix SpectrogramTimelineNavigator hook order and ref write**

In `src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx`, change the React import:

```ts
import { useRef } from "react";
```

to:

```ts
import { useEffect, useRef } from "react";
```

Move this block:

```ts
  if (durationMs <= 0 || viewport.durationMs <= 0) {
    return null;
  }

  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
```

to this shape:

```ts
  const onViewportChangeRef = useRef(onViewportChange);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  if (durationMs <= 0 || viewport.durationMs <= 0) {
    return null;
  }
```

This keeps the hook order stable and moves the ref write out of render.

- [ ] **Step 3: Run focused tests**

Run:

```powershell
npm test -- src/App.test.tsx src/capabilities/timelineViewport/SpectrogramTimelineNavigator.test.tsx
```

Expected: command exits `0`.

- [ ] **Step 4: Run lint**

Run:

```powershell
npm run lint
```

Expected: the warnings for `AppSessionProvider.tsx` and `SpectrogramTimelineNavigator.tsx` are gone. Other warning groups may remain.

- [ ] **Step 5: Commit session and timeline hook cleanup**

Run:

```powershell
git add -- src/app/session/AppSessionProvider.tsx src/capabilities/timelineViewport/SpectrogramTimelineNavigator.tsx
git commit -m "Fix session and timeline hook warnings"
```

Expected: commit succeeds with only these two source files.

## Task 2: Fix Spectrogram Hook Warnings

**Files:**
- Modify: `src/features/spectrogramViewer/SpectrogramView.tsx`
- Modify: `src/features/spectrogramViewer/SpectrogramViewer.tsx`

- [ ] **Step 1: Replace sync setState effect with derived viewport key reset**

In `src/features/spectrogramViewer/SpectrogramView.tsx`, add a helper near the constants:

```ts
function getViewportResetKey(durationMs: number, spectrogramOverview: SpectrogramOverview | null | undefined) {
  return `${durationMs}:${spectrogramOverview?.durationMs ?? "none"}`;
}
```

Change the React state setup from:

```ts
  const [internalViewport, setInternalViewport] = useState(() =>
    controlledViewport ?? createDefaultSpectrogramViewport(durationMs)
  );
  const activeViewport = controlledViewport ?? internalViewport;
```

to:

```ts
  const viewportResetKey = getViewportResetKey(durationMs, spectrogramOverview);
  const [internalViewportState, setInternalViewportState] = useState(() => ({
    resetKey: viewportResetKey,
    viewport: createDefaultSpectrogramViewport(durationMs)
  }));
  const internalViewport =
    internalViewportState.resetKey === viewportResetKey
      ? internalViewportState.viewport
      : createDefaultSpectrogramViewport(durationMs);
  const activeViewport = controlledViewport ?? internalViewport;
```

Change `updateViewport` from:

```ts
    if (!controlledViewport) {
      setInternalViewport(nextViewport);
    }
```

to:

```ts
    if (!controlledViewport) {
      setInternalViewportState({
        resetKey: viewportResetKey,
        viewport: nextViewport
      });
    }
```

Delete this effect entirely:

```ts
  useEffect(() => {
    if (controlledViewport) {
      return;
    }
    setInternalViewport((prev) => {
      const next = createDefaultSpectrogramViewport(durationMs);
      if (prev.startMs === next.startMs && prev.durationMs === next.durationMs) {
        return prev;
      }
      return next;
    });
  }, [durationMs, spectrogramOverview, controlledViewport]);
```

Expected behavior: uncontrolled viewport still resets when the loaded spectrogram/duration changes, but no state update happens inside an effect.

- [ ] **Step 2: Complete canvas draw effect dependencies**

In `src/features/spectrogramViewer/SpectrogramView.tsx`, change the canvas draw effect dependency array from:

```ts
  }, [visibleFrames]);
```

to:

```ts
  }, [hasSpectrogramFrames, spectrogramOverview, visibleFrames]);
```

Expected behavior: drawing updates when frame data or bin count changes.

- [ ] **Step 3: Stabilize SpectrogramViewer keyboard handler**

In `src/features/spectrogramViewer/SpectrogramViewer.tsx`, change the React import:

```ts
import { useEffect, useState } from "react";
```

to:

```ts
import { useCallback, useEffect, useState } from "react";
```

Wrap `handlePlaybackToggle` with `useCallback`:

```ts
  const handlePlaybackToggle = useCallback(async () => {
    if (playbackState.isPlaying) {
      await audioFacade.playback.pause();
    } else {
      await audioFacade.playback.play(playbackState.currentTimeMs);
    }

    setPlaybackState(audioFacade.playback.getState());
  }, [audioFacade, playbackState.currentTimeMs, playbackState.isPlaying]);
```

Remove the old `async function handlePlaybackToggle() { ... }`.

Change the keyboard effect dependency array from:

```ts
  }, [project, playbackState, audioFacade]);
```

to:

```ts
  }, [handlePlaybackToggle]);
```

Expected behavior: spacebar playback shortcut still toggles playback.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- src/features/spectrogramViewer src/components/WorkbenchShell.test.tsx
```

Expected: command exits `0`.

- [ ] **Step 5: Run lint**

Run:

```powershell
npm run lint
```

Expected: the warnings for `SpectrogramView.tsx` and `SpectrogramViewer.tsx` are gone. Skin adapter and `ui/types.ts` warnings may remain.

- [ ] **Step 6: Commit spectrogram hook cleanup**

Run:

```powershell
git add -- src/features/spectrogramViewer/SpectrogramView.tsx src/features/spectrogramViewer/SpectrogramViewer.tsx
git commit -m "Fix spectrogram hook warnings"
```

Expected: commit succeeds with only these two source files.

## Task 3: Clean Intentional Adapter And UI Type Warnings

**Files:**
- Modify: `eslint.config.js`
- Modify: `src/ui/types.ts`

- [ ] **Step 1: Disable fast refresh rule for skin adapter files**

In `eslint.config.js`, add this config object before the final `electron/platform` block:

```js
  {
    files: ["src/skins/**/adapter.tsx"],
    rules: {
      "react-refresh/only-export-components": "off"
    }
  },
```

Rationale: skin adapter files intentionally export an adapter object and local component implementations as one skin boundary. Splitting them only to satisfy fast refresh would add ceremony without improving ownership.

- [ ] **Step 2: Replace empty BackgroundProps interface**

In `src/ui/types.ts`, replace:

```ts
export interface BackgroundProps {}
```

with:

```ts
export type BackgroundProps = Record<string, never>;
```

Expected behavior: `Background` still receives no props, but lint no longer sees an empty interface.

- [ ] **Step 3: Run UI and skin tests**

Run:

```powershell
npm test -- src/ui src/skins src/App.test.tsx
```

Expected: command exits `0`.

- [ ] **Step 4: Run lint**

Run:

```powershell
npm run lint
```

Expected:

```text
0 errors
0 warnings
```

- [ ] **Step 5: Commit adapter and UI lint cleanup**

Run:

```powershell
git add -- eslint.config.js src/ui/types.ts
git commit -m "Clean adapter and UI lint warnings"
```

Expected: commit succeeds with only lint config and UI type changes.

## Task 4: Full Verification

**Files:**
- No planned file changes.

- [ ] **Step 1: Run lint**

Run:

```powershell
npm run lint
```

Expected:

```text
0 errors
0 warnings
```

- [ ] **Step 2: Run tests**

Run:

```powershell
npm test
```

Expected: command exits `0`.

- [ ] **Step 3: Run build**

Run:

```powershell
npm run build
```

Expected: command exits `0`.

- [ ] **Step 4: Inspect git status**

Run:

```powershell
git status --short
```

Expected: no output.

## Task 5: Electron Smoke Verification

**Files:**
- No planned source changes.

- [ ] **Step 1: Ensure production build exists**

Run:

```powershell
npm run build
```

Expected: command exits `0`.

- [ ] **Step 2: Start Electron with remote debugging**

Run:

```powershell
$electron = 'D:\WORKSPACE\ZiQi\node_modules\.bin\electron.cmd'
$args = @('--remote-debugging-port=9222', 'dist-electron\main.js')
$proc = Start-Process -FilePath $electron -ArgumentList $args -WorkingDirectory 'D:\WORKSPACE\ZiQi' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5
try {
  Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9222/json' -TimeoutSec 5 | Select-Object -ExpandProperty Content
} finally {
  Stop-Process -Id $proc.Id -Force
}
```

Expected: output is JSON containing at least one Electron renderer target.

- [ ] **Step 3: Verify preload bridge in renderer**

Use the available browser or remote debugging workflow to evaluate:

```js
({
  hasBridge: Boolean(window.ziqiApp),
  getVersion: typeof window.ziqiApp?.getVersion,
  openProject: typeof window.ziqiApp?.openProject,
  saveProject: typeof window.ziqiApp?.saveProject,
  onMenuCommand: typeof window.ziqiApp?.onMenuCommand
})
```

Expected:

```js
{
  hasBridge: true,
  getVersion: "function",
  openProject: "function",
  saveProject: "function",
  onMenuCommand: "function"
}
```

If the environment cannot launch Electron or cannot attach to the renderer, record the exact limitation in the final summary. Do not claim Electron smoke passed without runtime evidence.

## Completion Criteria

This cleanup is complete when:

- `npm run lint` exits `0` with no warnings.
- `npm test` exits `0`.
- `npm run build` exits `0`.
- Electron smoke either verifies `window.ziqiApp` in the renderer or has a clearly documented environment blocker.
- `git status --short` is clean.

## Self-Review

- Spec coverage: The plan covers all current lint warning groups and the remaining Electron runtime verification gap.
- Scope control: The plan avoids product behavior changes. Code changes are limited to hook correctness, lint configuration for intentional adapter files, and a no-props type cleanup.
- Completeness scan: No unfinished markers, vague filler steps, or missing verification commands remain.
