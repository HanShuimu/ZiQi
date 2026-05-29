# Multiresolution Pitch Heatmap Design

## Goal

Replace the current per-frame Essentia `SpectrumCQ` pitch heatmap path with a first-load analysis pipeline that can produce a semitone-separated 88-key pitch heatmap in roughly tens of seconds for a full song.

The first target track is about 225 seconds long. The desired default analysis density is 100 frames per second. The result must keep adjacent semitones visually distinct instead of blending multiple neighboring notes into the same color lane.

## Non-Goals

- Do not depend on analysis cache for first-load performance.
- Do not add Worker execution in this first phase.
- Do not change the saved `.ziqi` project format for analysis artifacts.
- Do not redesign the heatmap renderer or control panel beyond what is required to consume the improved analysis data.
- Do not keep Essentia `SpectrumCQ` on the primary analysis path.

## Current Problem

The current pitch heatmap builder decodes the audio, mixes to mono, then analyzes each heatmap frame independently with Essentia `SpectrumCQ`.

For a 225-second, 48 kHz stereo file at 24 frames per second, the current path creates about 5414 frames. Each frame extracts a 32768-sample window and calls into Essentia through the JS/WASM boundary. The window overlap is high, and repeated work is not reused across frames. Logs show this path spending several minutes inside `pitchHeatmap.overview` and failing before completion with a WASM abort.

The problem is therefore the cost and stability of the per-frame analysis path, not file I/O, project parsing, or engine loading.

## Chosen Approach

Use a multiresolution STFT pipeline with a semitone filter projection:

1. Decode audio and mix to mono as the current service does.
2. Generate heatmap frames at 100 frames per second by default.
3. For each frame, compute FFT spectra at a small fixed set of window sizes.
4. Assign each MIDI note from A0 to C8 to the smallest window size that still has enough frequency resolution for that note.
5. Project FFT magnitudes into 88 semitone energy bins using precomputed note frequency bands and optional triangular weighting.
6. Return the existing `PitchEnergyOverview` shape.
7. Keep existing heatmap display controls: gain, contrast, dynamic range, noise floor, and color intensity.

This preserves the renderer and state model while replacing the slow analysis engine.

## Window Strategy

Use a small set of power-of-two FFT sizes. Exact defaults can be tuned during implementation, but the first version should start with:

- Low notes: 65536 or 32768 samples.
- Mid notes: 16384 samples.
- High notes: 8192 or 4096 samples.

Each MIDI note owns one analysis resolution. Lower notes need longer windows because adjacent semitone spacing is small. Higher notes can use shorter windows because their semitone spacing is wider and long windows add cost without improving visible separation.

The note band for a MIDI note is bounded by the geometric midpoint to the previous and next semitone. For A0 and C8, clamp to the piano range edge. The projection sums or weighted-averages magnitudes from FFT bins whose center frequencies fall inside the note band.

## Data Model

Keep the existing runtime data model:

```ts
interface PitchEnergyOverview {
  durationMs: number;
  framesPerSecond: number;
  minMidiNumber: 21;
  maxMidiNumber: 108;
  notesPerFrame: 88;
  frames: PitchEnergyFrame[];
}
```

The first phase should not introduce a new persisted analysis schema. The existing `.ziqi` state for heatmap display settings remains valid.

## Integration Points

The primary implementation target is `src/services/audio/browserPitchEnergyService.ts`.

The service should stop loading Essentia for the default pitch heatmap path. It can keep test-only dependency injection if helpful, but the production path should build `PitchEnergyOverview` from the multiresolution STFT engine.

The existing spectrogram fallback conversion in `SpectrogramView` can remain as a fallback. It should not be the primary heatmap source when pitch analysis succeeds.

The import and open-project commands can continue to call `pitchEnergyService.buildOverviewFromAudioData(...)` without changing their command contract.

## Performance Expectation

The design targets the current bottleneck directly:

- Avoid thousands of Essentia `SpectrumCQ` calls.
- Avoid repeated JS/WASM boundary crossings for every heatmap frame.
- Reuse precomputed windows, note bands, and bin mappings.
- Compute only a few FFTs per frame, then project those spectra into 88 semitone bins.

The first implementation should log enough detail to compare:

- decoded duration and sample rate,
- frame count,
- default frames per second,
- selected FFT window sizes,
- total pitch overview duration,
- progress at regular frame intervals.

## Error Handling

If decoding fails, keep the existing user-facing `Failed to generate pitch heatmap.` behavior.

If analysis fails, log the failing stage and preserve the same user-facing error. Since the new path removes Essentia from the default route, `Failed to load pitch analysis engine.` should no longer occur during normal project open.

## Testing

Unit tests should cover:

- default frames per second is 100,
- output remains A0-C8 with 88 energy bins,
- note-band mapping assigns lower notes to longer windows and higher notes to shorter windows,
- adjacent synthetic semitone tones peak in different MIDI bins,
- progress callbacks still fire,
- zero-length or silent buffers produce valid empty or near-zero output,
- existing display setting tests remain unchanged.

Browser/Electron verification should cover:

- opening the known slow project no longer reports `Failed to load pitch analysis engine.`,
- logs show pitch heatmap analysis completing instead of aborting,
- the visible heatmap has distinct semitone lanes,
- existing gain and contrast controls still affect the display.

## First-Phase Success Criteria

- The default pitch heatmap analysis density is 100 frames per second.
- The 225-second reference audio completes first-load pitch analysis in roughly tens of seconds, without relying on cache.
- Adjacent semitone synthetic inputs are separated into different note bins by automated tests.
- The app no longer loads Essentia for normal pitch heatmap generation.
- Existing project import/open command contracts remain unchanged.
