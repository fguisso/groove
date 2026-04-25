# Architecture

Snapshot of the current state. Update this when modules move, the data flow shifts, or the voice schema changes.

## Module map

### `src/lib/` — pure logic, no Vue or Tone

- `model.ts` — `Groove` shape, voice and state types (`HatValue`, `NoteValue`, `Sticking`), divisions, cycle helpers, `emptyGroove`, `resizeArrays`.
- `codec.ts` — bit-packed binary v3 wire format, base64url-encoded for the URL fragment. Header, presence flags, voice cells, optional title/author trailer. Empty default groove encodes to 11 chars.
- `vex-builder.ts` — turns a `Groove` into a VexFlow staff. Beam grouping is hardcoded for simple meters (1/4 beat group); 6/8 falls back to straight 8ths.
- `export-midi.ts` — `exportMidi(g)` writes a GM drum track (channel 10) to a `.mid` file via `@tonejs/midi`. The GM mapping table at the top of the file is the canonical voice → MIDI note source today.
- `export-png.ts` — score → PNG download.
- `utils.ts` — `cn` class-merge helper.

### `src/composables/`

- `usePlayback.ts` — owns Tone.js synth construction (kk, sn, hh closed/open/pedal, click), the `Tone.Part` scheduler, swing, count-in, and the playback `currentStep` ref. Voice dispatch is the `VoiceKey` union local to this file.
- `useUrlSync.ts` — keeps the `Groove` store in sync with the hash payload. Editor writes back; embed does not.

### `src/stores/`

- `groove.ts` — Pinia store wrapping the current `Groove` plus a few editor-only flags.

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

| Key      | States                               | Bits | Wired in UI?         | Notes                 |
| -------- | ------------------------------------ | ---- | -------------------- | --------------------- |
| `hh`     | 5 (off, closed, open, accent, pedal) | 3    | yes                  | hi-hat                |
| `sn`     | 4 (off, normal, accent, ghost)       | 2    | yes                  | snare                 |
| `kk`     | 4 (off, normal, accent, ghost)       | 2    | yes                  | kick                  |
| `t1`     | 4                                    | 2    | no — data-model only | reserved              |
| `t4`     | 4                                    | 2    | no — data-model only | reserved              |
| `cy`     | 4                                    | 2    | no — data-model only | reserved              |
| sticking | 4 (-, R, L, B)                       | 2    | yes                  | per step, not a voice |

## Known limitations

- **Voice keys are hardcoded across five files** (`model`, `codec`, `usePlayback`, `vex-builder`, `export-midi`). Adding a drum is a coordinated edit. The named-voice abstraction (Phase 1, see `docs/specs/named-voice.md`) is meant to fix this.
- **Beam grouping assumes simple meters.** Compound meters render as straight eighths (`vex-builder.ts:205` TODO).
- **No MIDI input today.** Web MIDI listener and grading land in Phase 3.
- **No timing tests.** Codec round-trip is covered; playback timing is not. Add tests in the phase that needs them.
