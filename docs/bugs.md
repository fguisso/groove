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
