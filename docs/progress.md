# Progress

Running journal. Newest entry on top. Append a dated entry whenever a meaningful task lands or a non-obvious decision is made.

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
