# AGENTS.md

使用中文与用户交流。

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Superpowers Approval Gates

**Brainstorming and writing-plans have hard user approval gates. Do not skip them.**

When `superpowers:brainstorming` is used:
- Stay in brainstorming only: explore context, ask clarifying questions one at a time, propose approaches, and present the design.
- Do not write code, scaffold files, invoke implementation skills, or start implementation work during brainstorming.
- Stop after presenting the design and wait for explicit user approval.
- Only after the user approves the design, write the design spec.
- After writing the spec, stop again and ask the user to review and approve it.
- Only after the user approves the written spec, invoke `superpowers:writing-plans`.

When `superpowers:writing-plans` is used:
- Write the implementation plan and run the plan self-review only.
- Do not start implementation, modify product code, or invoke execution skills while writing the plan.
- After the plan is complete, stop and ask the user whether to execute it.
- Present the available execution options and wait for explicit user approval.
- Only after the user approves execution, invoke the chosen execution workflow such as `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

## 6. Project-Specific Audio/Electron Principles

**Cross-boundary behavior must be verified in the real runtime.**

- Electron preload/main/renderer boundaries need a real app smoke test before being treated as working. At minimum, verify exposed APIs such as `window.ziqiApp` exist in the running Electron renderer.
- The renderer should not depend on direct local file path reads for audio playback or analysis. Use Electron main/preload as the controlled local-file boundary, and treat file paths as project metadata in the renderer.
- Audio binary data ownership must be explicit. Browser audio APIs such as `decodeAudioData` may consume or detach buffers, so create independent data views or playback blobs before handing data to APIs that may mutate lifecycle state.
- Keep analysis data separate from UI rendering samples. Waveform analysis should produce stable time-based data; the UI may aggregate for display, but display size should not force re-analysis or change source analysis values.
- Playback services should coordinate real media elements, not simulate browser playback. Only write `currentTime` for explicit seek or loop jumps; normal playback time should be read from the media element and synchronized into app state.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
