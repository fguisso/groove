# Progress

Running journal. Newest entry on top. Append a dated entry whenever a meaningful task lands or a non-obvious decision is made.

---

## 2026-04-25 — Phase 1 complete

**Status:** Named voice abstraction landed. Ready for Phase 2.

**Done:**

- Added `src/lib/voices.ts` — single source of truth for voice metadata: id, label, kind, bitsPerCell, MIDI mapping per state, VexFlow render hints, synth dispatch keys.
- Bumped wire format to v4 (registry-driven voice presence bitmap). v3 stays read-only for legacy URLs; `t4` decodes to `t3` and `cy` decodes to `ride` so the wiki embed (`A1AAAEQBBEQggggggggAgACAQQAEAA`) still works.
- Refactored `model.ts`, `codec.ts`, `usePlayback.ts`, `vex-builder.ts`, `export-midi.ts`, and `stores/groove.ts` to read from the registry. Adding a voice now means: append to `VOICES`, add a synth in `usePlayback.ts` (only if its sound is genuinely new), and add a UI lane.
- Added codec tests: a v3 backward-compat case with the wiki payload, and a v4 round-trip exercising t1, t3, ride.

**Decisions:**

- Wire format kept presence as a 1-byte bitmap (max 8 voices). When we cross 8, bump format and use 2 bytes.
- Voice ids renamed: `t4` → `t3` (we have at most 3 toms in the target kit), `cy` → `ride` (specific instrument, not "any cymbal").
- `Voices` type guarantees `hh`, `sn`, `kk` are always present; toms and ride are optional. Keeps existing accessor sites simple.
- Synths for `t1`, `t3`, `ride` are pre-built in `usePlayback.ts` even though they have no UI yet — the lane addition in Phase 2 is then UI-only.

**Next:** Phase 2 — toms (t1, t2, t3) + ride lane in UI/render/playback. Read `docs/specs/toms-and-ride.md`. Note that the registry currently has `t1`, `t3`, `ride`; Phase 2 must add `t2` and decide whether to include t1/t2/t3 in the visible grid.

---

## 2026-04-25 — Phase 0 complete

**Status:** Engineering harness in place. Ready to start Phase 1.

**Done this session:**

- Fixed Safari iframe regression where the second of two embeds painted with `:root` (light) variables instead of `.dark`. Theme and `is-embed` classes are now applied synchronously in `src/main.ts` before Vue mounts. Commit `584bf54`.
- Bumped GitHub Actions to current majors (checkout v6, setup-node v6, configure-pages v6, upload-pages-artifact v5, deploy-pages v5) and Node runtime to 22 LTS. Commit `1bb8898`.
- Set up the engineering harness:
  - `CLAUDE.md` at repo root — orientation that points the agent at this file first.
  - `docs/architecture.md` — current module map, data flow, voice schema, known limitations.
  - `docs/conventions.md` — workflow rules, commit style, comment policy.
  - `docs/specs/{named-voice,toms-and-ride,midi-input}.md` — design notes for Phases 1 through 3.
  - ESLint flat config + Prettier with project-style defaults (no semis, single quotes, 100 cols).
  - `npm run lint`, `format`, `format:check`, `typecheck` scripts; `build` now does typecheck + Vite.
  - CI workflow runs typecheck, lint, format:check, and tests as separate steps.

**Next session:** Phase 1 — named voice abstraction. Read `docs/specs/named-voice.md` first; the spec calls out the open design questions to resolve before writing code. Phase 2 (toms + ride) and Phase 3 (MIDI input) depend on this landing first.

**Decisions made this session:**

- **MIDI feature stays in 4/4 rock only** for the MVP. Multi-meter and tuplets remain deferred (already in the README roadmap).
- **Target kit for Phase 3 is the Aroma TDX 15S**: HH (closed/open/pedal), kick, snare with rim/border, three toms, ride.
- **Docs in English**, consistent with existing README and code comments.
- **No husky / lint-staged** for now. CI is the gatekeeper. Revisit if pre-commit drift becomes a problem.
- **No custom review agent** for now. Built-in `simplify`, `review`, `security-review` skills are enough until Phase 3.
