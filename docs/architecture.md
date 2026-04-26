# Architecture

Snapshot of the current state. Update this when modules move, the data flow shifts, or the voice schema changes.

## Module map

### `src/lib/` — pure logic, no Vue or Tone

- `voices.ts` — voice registry. Single source of truth for what drums exist, their cell width, MIDI mapping per state, VexFlow render hints, and synth dispatch keys. Includes `voiceForMidiNote()` for MIDI input mapping (registry states + `INPUT_ONLY_MIDI` for kit-side notes like snare rim).
- `model.ts` — `Groove` shape; `Voices` type guarantees `hh`/`sn`/`kk` are present; toms and ride are optional. Uses `voices.ts` for cycle helpers.
- `codec.ts` — bit-packed binary, base64url-encoded for the URL fragment. v4 is registry-driven (presence bitmap over `VOICES` order, then cells in order). v3 stays read-only for legacy URLs (maps `t4`→`t3`, `cy`→`ride`).
- `vex-builder.ts` — turns a `Groove` into a VexFlow staff by iterating the registry. Beam grouping is hardcoded for simple meters (1/4 beat group); 6/8 falls back to straight 8ths.
- `export-midi.ts` — `exportMidi(g)` writes a GM drum track (channel 10) via `@tonejs/midi`, looking up notes/velocities from the registry.
- `export-png.ts` — score → PNG download.
- `utils.ts` — `cn` class-merge helper.

### `src/composables/`

- `usePlayback.ts` — owns Tone.js synth construction (kk, sn, hh closed/open/pedal, t1/t2/t3, ride, click), the `Tone.Part` scheduler, swing, count-in, and the playback `currentStep` ref. Voice dispatch reads `voices.ts`.
- `useUrlSync.ts` — keeps the `Groove` store in sync with the hash payload. Editor writes back; embed does not.

### `src/stores/`

- `groove.ts` — Pinia store wrapping the current `Groove` plus a few editor-only flags.
- `midi.ts` — Pinia store wrapping Web MIDI access, last-hit, latency/tolerance settings (persisted to `localStorage`), the live-marker list, the practice-mode toggle + review timer, and the Settings drawer open flag. Shared by `MidiPanel`, `GrooveGrid`, `Score`, `TopBar`, and `EditorView`.

### `src/views/`

- `EditorView.vue` — main editor screen.
- `EmbedView.vue` — iframe-friendly screen. Adds `is-embed` class and posts `groove:resize` to `window.parent`.

### `src/components/`

- `groove/` — domain components: `Score.vue`, `Transport.vue`, the cell grid, etc.
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
- **Marker timing snaps to `currentStep`.** The first attempt at timestamp-based positioning desynced; see the desync trap entry in `docs/progress.md` before trying again.
- **No playback-timing tests.** Codec round-trip is covered; the `Tone.Part` dispatch path and the live marker watcher are not. Add when behavior justifies it.
