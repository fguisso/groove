# Architecture

Snapshot of the current state. Update this when modules move, the data flow shifts, or the voice schema changes.

## Module map

### `src/lib/` — pure logic, no Vue or Tone

- `voices.ts` — voice registry. Single source of truth for what drums exist, their cell width, MIDI mapping per state, VexFlow render hints, synth dispatch keys, and an optional `group: 'tom' | 'cymbal'` for the editor's bulk-collapse toggles. Includes `voiceForMidiNote()` for MIDI input mapping (registry states + `INPUT_ONLY_MIDI` for kit-side notes like snare rim).
- `model.ts` — `Groove` shape; `Voices` type guarantees `hh`/`sn`/`kk` are present; toms and ride are optional. Uses `voices.ts` for cycle helpers.
- `codec.ts` — bit-packed binary, base64url-encoded for the URL fragment. v4 is registry-driven (presence bitmap over `VOICES` order, then cells in order). v3 stays read-only for legacy URLs (maps `t4`→`t3`, `cy`→`ride`).
- `vex-builder.ts` — turns a `Groove` into a VexFlow staff by iterating the registry. Beam grouping is hardcoded for simple meters (1/4 beat group); 6/8 falls back to straight 8ths. `renderScore(..., { singleRow })` lays every measure on one horizontal row (used during playback so the chart can scroll behind a centered playhead); paused, it wraps measures onto rows for readability.
- `export-midi.ts` — `exportMidi(g)` writes a GM drum track (channel 10) via `@tonejs/midi`, looking up notes/velocities from the registry.
- `export-png.ts` — score → PNG download.
- `utils.ts` — `cn` class-merge helper.

### `src/composables/`

- `usePlayback.ts` — owns Tone.js synth construction (kk, sn, hh closed/open/pedal, t1/t2/t3, ride, click), the `Tone.Part` scheduler, swing, count-in, and the playback `currentStep` ref. Voice dispatch reads `voices.ts`. When `loop` is off it schedules an explicit `end` event one step past the last note that tears down playback and fires the `setOnEnded` callback, so the UI never stays stuck in "playing". Manual `stop()` does not fire `onEnded`. Captures the playing timeline geometry and exposes `nearestStepNow()`, which projects the live `transport.seconds` onto the step grid (signed `deltaSec`) so a MIDI hit can be graded for timing off the audio clock.
- `useUrlSync.ts` — keeps the `Groove` store in sync with the hash payload. Editor writes back; embed does not.
- `useWakeLock.ts` — Screen Wake Lock wrapper. Keeps the phone awake while a groove plays; re-acquires on `visibilitychange` (the browser auto-releases when the page is hidden). Both views drive it via `watch(isPlaying)`. No-ops where the API is unsupported.

### `src/stores/`

- `groove.ts` — Pinia store wrapping the current `Groove` plus a few editor-only flags. `selectedMeasure` (UI-only, not encoded in URL) drives the GrooveGrid single-measure mode and the Score click-to-select overlay.
- `midi.ts` — Pinia store wrapping Web MIDI access, last-hit (incl. an audio-clock `timing` captured synchronously via a `setHitTimingProvider` callback the editor registers), latency/tolerance settings (persisted to `localStorage`), the live-marker list (grade ∈ `perfect`/`early`/`late`/`wrong-voice`/`off-time`), the practice-mode toggle + review timer (surfaced as the Transport's "Pause between loops"), the editor lane-visibility toggles (`showToms` / `showCymbals`, persisted), and the Settings drawer open flag. Shared by `MidiPanel`, `GrooveGrid`, `Score`, `TopBar`, `Transport`, and `EditorView`.

### `src/views/`

- `EditorView.vue` — main editor screen.
- `EmbedView.vue` — iframe-friendly screen. Adds `is-embed` class and posts `groove:resize` to `window.parent`.

### `src/components/`

- `groove/` — domain components: `Score.vue`, `Transport.vue`, `GrooveGrid.vue` (single + stack modes via `isPlaying`), `MeasureTabs.vue` (measure switcher with `+` button), the cell grid, etc.
- `shell/`, `ui/`, `icons/` — chrome and primitives.

### `src/styles/`

- `tailwind.css` — design tokens via CSS variables (light at `:root`, dark at `.dark`), Tailwind base/components/utilities, embed override, score-host gradient, LED cell, transport play styles.

### `src/router.ts`

Hash router. Routes:

- `/` and `/g/:payload` → `EditorView`
- `/embed` and `/embed/g/:payload` → `EmbedView`
- catch-all redirects to `/`

### `src/main.ts`

Applies the `dark` and `is-embed` classes synchronously before mounting Vue (Safari requires this; see `docs/progress.md` 2026-04-25).

## Data flow

```
URL hash payload
  ↓ (codec.decode on load)
Pinia store (Groove)
  ↓ (reactive bindings)
  ├─→ Score.vue → vex-builder → VexFlow SVG
  └─→ Transport.vue + usePlayback → Tone.js Part → audio + currentStep

Editor edits
  ↓ (mutate store)
useUrlSync watch
  ↓ (codec.encode)
URL hash (replaceState)
```

Embed view reads URL but never writes back.

## Voice schema today

Source of truth: `src/lib/voices.ts`. Keep this table in sync if voices change.

| Key      | States                               | Bits | Wired in UI? | Notes                 |
| -------- | ------------------------------------ | ---- | ------------ | --------------------- |
| `hh`     | 5 (off, closed, open, accent, pedal) | 3    | yes          | hi-hat                |
| `sn`     | 4 (off, normal, accent, ghost)       | 2    | yes          | snare                 |
| `kk`     | 4 (off, normal, accent, ghost)       | 2    | yes          | kick                  |
| `t1`     | 4 (off, normal, accent, ghost)       | 2    | yes          | high tom              |
| `t2`     | 4 (off, normal, accent, ghost)       | 2    | yes          | mid tom               |
| `t3`     | 4 (off, normal, accent, ghost)       | 2    | yes          | floor tom             |
| `ride`   | 4 (off, normal, accent, ghost)       | 2    | yes          | ride cymbal           |
| sticking | 4 (-, R, L, B)                       | 2    | yes          | per step, not a voice |

## Known limitations

- **Beam grouping assumes simple meters.** Compound meters render as straight eighths (`vex-builder.ts` TODO).
- **No missed-note markers yet.** The live marker layer is purely hit-driven — expected notes the user fails to hit don't get a red dot. See the future-feature note in `docs/progress.md`.
- **Marker timing.** Hit _grading_ now reads the audio clock (`nearestStepNow` projects `transport.seconds` onto the step grid → early/perfect/late), but marker _position_ still snaps to the step's notehead. The first attempt at timestamp-_positioning_ desynced; see the desync trap entry in `docs/progress.md` before moving the dots by microtiming. End-to-end MIDI timing still needs an e-kit to verify.
- **No playback-timing tests.** Codec round-trip is covered; the `Tone.Part` dispatch path and the live marker watcher are not. Add when behavior justifies it.
