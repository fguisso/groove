# Bugs & open issues

Punch list of visual / layout bugs noticed in the wild. Newest on top. Move resolved items to `progress.md` with the fix entry.

---

## 2026-05-01 — Score / staff rendering

### 24ths get clipped in the iframe embed

- **Where:** Embed view (`/embed`).
- **Repro:** Set division to `24ths`, embed in an iframe with the default width. The right-hand portion of the staff is cut off — the embed posts `groove:resize` for height but the score itself overflows horizontally.
- **Likely fix area:** Either reduce the per-step width in `vex-builder.ts` for higher subdivisions, or let the score wrap (see "measures should wrap" below), or post a min-width hint to the host. Investigate which is least disruptive.
- **Screenshot:** image 2.

### 16ths places a note outside the staff (deeper investigation)

- **Where:** Editor, division = `16ths`, multi-measure groove with sticking enabled (R on step 1 of each measure).
- **Repro:** With the 16ths layout shown in image 3, a note appears past the final barline / off the right edge of the staff system. Looks structural, not just a width issue.
- **Hypothesis:** Beam group spilling past the bar, or a tuplet / rest fill bug in `vex-builder.ts` when stickings change cell width. Worth checking whether the same payload renders correctly at 8ths / 32nds.
- **Screenshot:** image 3 (note hanging past the right barline).

---

## 2026-05-01 — Multi-measure layout

### GrooveGrid: better way to follow multiple measures during playback

- **Where:** GrooveGrid (editor).
- **Symptom:** Grid shows only the active measure (selected via the Measures tab buttons). During playback of a multi-measure loop, the user has to manually switch tabs to follow along, or just watch the score.
- **Open question:** Should the active measure tab auto-switch as playback advances? Should we show all measures stacked? Tradeoff is vertical space vs. clarity. Worth a short design pass before coding.

---

## 2026-06-19 — Found during a manual Chrome pass (minor, still open)

### Pasting a new share link in the address bar does not reload the groove

- **Where:** Editor and embed, when the route stays on the same component but `:payload` changes.
- **Repro:** With a groove open, paste a different `#/g/:payload` (or `#/embed/g/:payload`) into the address bar. The URL updates but the staff / grid keep the previous groove.
- **Cause:** `useUrlSync` decodes `route.params.payload` once at setup; it does not `watch` the route, and Vue Router reuses the same component instance across a param change, so `store.replace` never re-runs. A full page reload (or opening the link in a new tab) works fine.
- **Likely fix area:** `src/composables/useUrlSync.ts` — `watch(() => route.params.payload, ...)` and re-decode, guarding against the write-back loop (skip if the new payload equals the one we just encoded).
- **Severity:** low. The common flows (open a link cold, edit-then-share) are unaffected; only in-app address-bar swaps hit it.

### Guided tour: "Back" is clickable on step 1 of 11

- **Where:** First-run tour popover (`driver.js`), step 1.
- **Symptom:** The Back button is enabled on the first step; clicking it is a no-op instead of being disabled / hidden.
- **Likely fix area:** `src/composables/useTour.ts` driver options (disable/hide the previous button on the first step).
- **Severity:** trivial UX polish.

---
