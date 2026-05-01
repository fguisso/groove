# Progress

Running journal. Newest entry on top. Append a dated entry whenever a meaningful task lands or a non-obvious decision is made.

---

## 2026-05-01 — GitHub link in the top bar

**Status:** Small navigation affordance. Icon-only anchor next to Clear in `TopBar.vue` opens `https://github.com/fguisso/groove` in a new tab. Uses lucide's `Github` glyph and the same muted-foreground hover treatment as the other toolbar chrome.

**Decision:** Anchor over button + `window.open` so middle-click and cmd-click work for opening the repo in a background tab without code.

---

## 2026-05-01 — Show/hide tom and cymbal lanes (Settings → Editor)

**Status:** Two new toggles in the Settings drawer collapse tom rows and cymbal rows from the grid. Purely visual — staff and audio still play every note.

**Done:**

- `src/lib/voices.ts` — `Voice.group?: 'tom' | 'cymbal'` field (optional). `t1`, `t2`, `t3` tagged `'tom'`; `ride` tagged `'cymbal'`. Future cymbal voices (crash, etc.) inherit the toggle by tagging themselves at registry time — no UI plumbing needed.
- `src/stores/midi.ts` — two new persisted booleans `showToms`, `showCymbals` (default `true`), keys `groove:showToms` / `groove:showCymbals`. Setters via the existing `writeBool` helper.
- `src/components/groove/GrooveGrid.vue` — `lanes` is now a `computed` filtering `VISIBLE_LANES` by `voice.group` against the store flags. Both single and stack render modes already iterated `lanes`, so no template changes — fewer rows just appear.
- `src/components/groove/MidiPanel.vue` — new "Editor" section between Export and MIDI device with two checkboxes plus a one-liner explaining the toggle is editor-only.

**Decisions:**

- **Visual only.** The codec, the `Groove` type, the store, and the URL hash were not touched. Two users opening the same share link must always see the same notes regardless of each one's local toggle state. Hidden lanes still play through the synth and still render on the staff.
- **Cymbal toggle is plural and forward-looking.** The user explicitly mentioned that `attacks` (crashes etc.) will land in their own lane later. Naming the toggle "Show cymbals" today avoids a rename when those land — they'll just tag `group: 'cymbal'` in the registry.
- **`group` on the voice registry, not a hardcoded list in `GrooveGrid`.** Putting the metadata next to the voice itself means any voice author handles their own grouping. The grid's filter stays oblivious to which voices are toms.
- **Persisted in `localStorage` like the other Settings flags** (`practiceMode`, `latencyMs`, `toleranceMs`). Personal editor preference, never per-groove.

**Next:** Watch for the user adding more cymbals (crash etc.) — should slot in cleanly. Tom soloing during playback is a tangential request that would need a different mechanism; not on the list yet.

---

## 2026-05-01 — Embed: follow OS theme via CSS, Edit-in-editor link

**Status:** Embed iframes now inherit the host's OS theme automatically (no JS listener, no postMessage protocol) and expose a small "Edit" link that opens the same groove in the full editor.

**Done:**

- `src/main.ts` — split the theme bootstrap into editor vs embed branches. Editor keeps the existing default `dark`. Embed default is `auto`: when the URL has no `?theme=`, no class is added at all and CSS handles the rest. `?theme=dark` adds `.dark`; `?theme=light` adds a marker `.theme-light` so the media query is bypassed.
- `src/styles/tailwind.css` — added a `@media (prefers-color-scheme: dark)` block scoped to `html.is-embed:not(.theme-light):not(.dark)` that mirrors the dark CSS-var palette. The dark `.panel` shadow override gets the same media-wrapped duplicate. Both palette and shadow are now duplicated — kept in sync via a comment at the top of the dark block.
- `src/views/EmbedView.vue` — `editorUrl` computed maps the current `route.params.payload` back into a `#/g/:payload` URL on the same `${origin}${pathname}`. New header row holds the title (truncated) plus an `<a target="_blank" rel="noopener">` styled with the lucide `ExternalLink` icon. Falls back to `#/` when no payload.

**Decisions:**

- **Pure CSS over `matchMedia('change')` listener.** A listener works, but the user explicitly asked for the no-events route. CSS recalculates on `prefers-color-scheme` change for free, and Safari's first-paint quirk doesn't apply here because the dark-vars rule only matters on a re-cascade triggered by the OS toggle, which Safari handles correctly.
- **Editor stays on `dark` default.** The user only flagged the embed as needing OS-following behavior. The editor is a focused workspace and the dark default is intentional.
- **`.theme-light` marker, not `.light`.** Two reasons: it's only used to break out of the media query (semantic = "explicit light override"), and using a name distinct from any Tailwind utility avoids collision risk if Tailwind ever adds a `.light` class strategy.
- **Edit link, not a button.** Native anchor with `target="_blank"` cooperates with browser middle-click / cmd-click to open background tabs. A button + `window.open` would lose that ergonomics.

**Caveat:** Light/dark dark-vars are duplicated in two CSS blocks. If a future palette tweak forgets one, hot-reloaded embed previews will silently disagree with the editor. A PostCSS step that emits both from a single source would be the proper DRY fix; left as-is for now since the palette is stable.

**Next:** Consider adding a "Copy link" button in the embed footer too, since "Edit" implies the user already wants to share / save the groove they're looking at.

---

## 2026-05-01 — Score uses full container width (cap removed)

**Status:** Bug fix on top of the multi-measure editor work. The staff was rendering at 720 px (the fallback) inside a much wider card, leaving the right portion of multi-measure grooves visually clipped at the staff's right edge.

**Root cause:** `Score.vue` was reading `container.clientWidth` from the inner host `<div ref="host">`, which sits inside an `inline-block` wrap. Inline-block elements without an explicit width are shrink-to-fit on their content; before the SVG is drawn, the inner div has `clientWidth === 0` and the renderer fell back to 720 px.

**Done:**

- `src/components/groove/Score.vue` — added a separate `hostRoot` ref on the outer `.score-host` (block-level, fills the panel). `availableWidth()` reads `hostRoot.clientWidth` and subtracts horizontal padding via `getComputedStyle`, then passes the result to `renderScore({ width })`. Also added a `ResizeObserver` on the outer host so the staff redraws on container resize, not only on `window.resize`.
- `src/lib/vex-builder.ts` — removed the `Math.min(1100, ...)` cap on width. The `max-w-[1200px]` constraint already lives on the page main, and the per-measure formatter can use the extra pixels for breathing room.
- `src/components/groove/Score.vue` — `text-center` on the host so when the SVG is narrower than its container (e.g. via an explicit `opts.width` in `export-png`), the staff centers instead of pinning left.

**Decisions:**

- **Read the outer host, not the inner.** The inner div is wrapped by `inline-block`; clientWidth there is content-derived and unreliable until after the first SVG paint. Outer host is `display: block` (the `.score-host` class) and reflects actual layout from first paint.
- **`ResizeObserver` over `window.resize` only.** Sidebars opening/closing, drawer overlays, and parent layout changes don't always fire `window.resize`. Observing the host catches everything.

**Caveat:** `availableWidth` calls `getComputedStyle` on each redraw. Cheap enough but worth noting if redraws ever land in a hot loop.

---

## 2026-05-01 — Multi-measure editor: GrooveGrid one-at-a-time, Score-driven nav

**Status:** Editor switches between a single-measure grid (paused) and a vertical stack of every measure (playing). Score becomes the navigator: clicking a measure on the staff selects it. Measures dropdown replaced by `[ 1 ] [ 2 ] ... [ N ] [ + ]` tabs.

**Done:**

- `src/stores/groove.ts` — `selectedMeasure: number` UI flag in state. `setSelectedMeasure(m)` clamps to `[0, measures-1]`; `setMeasures` and `replace` re-clamp; `reset` zeroes it. Lives in the store (not the URL hash) so it stays out of share links.
- `src/lib/vex-builder.ts` — `RenderResult` now exposes `measureBounds: { x, width }[]`, captured per stave inside the existing measure loop. Lets the Score component overlay click targets without reimplementing stave geometry.
- `src/components/groove/Score.vue` — transparent `<button class="score-measure-hit">` overlays per measure. Selected measure gets a faint primary tint + bottom border. Disabled while `isPlaying`. New `selectable` prop (default true) lets `EmbedView` opt out via `v-show`.
- `src/components/groove/MeasureTabs.vue` (new) — small tab strip reading `selectedMeasure` and `groove.measures` from the store. `+` button calls `setMeasures(measures + 1)` then jumps `selectedMeasure` to the new tail; disabled at 8.
- `src/components/groove/GrooveGrid.vue` (refactor) — two render modes driven by `props.isPlaying`:
  - **Single (paused):** renders only `selectedMeasure`. `globalIdx(measure, localIdx)` translates back into the underlying voice arrays so cycle/click handlers are unchanged.
  - **Stack (playing):** v-fors over every measure, each block self-contained (label header + sticking row + lanes). Wrapper has `max-height: min(70vh, 720px); overflow-y: auto`. `activeMeasure` watcher (recomputes from `currentStep`) calls `host.scrollTo({ top, behavior: 'smooth' })` only when the measure index changes — scrolling per step would fight the smooth animation.
- `src/views/EditorView.vue` — Measures `<Select>` removed (replaced by MeasureTabs inside the grid). `<Score>` gets `:is-playing`. `onStop` now snapshots the playing measure via `Math.floor(currentStep.value / division) % measures` _before_ calling `stop()`, so the single-mode grid resumes on the bar the user paused on.
- `src/views/EmbedView.vue` — Score gets `:is-playing` and `:selectable="false"` so the embed doesn't show clickable measure overlays.

**Decisions:**

- **`selectedMeasure` is store state, not local to EditorView.** Three components (Score, MeasureTabs, GrooveGrid) read it; the store's existing pattern of "Groove + a few editor-only flags" already accommodates UI-only state, and using a store ref means clamping logic lives next to `setMeasures`.
- **Stack-mode auto-scroll fires on measure change, not step change.** A per-step `scrollTo` either no-ops (when destination doesn't change) or restarts the smooth animation, both wasteful. Watching the derived `activeMeasure` keeps the scroll calls coarse and the animation continuous.
- **Pause = jump to currently-playing measure.** User chose this over "preserve pre-play selection" — matches the "pause to fix what just played" use case better than "pause as preview".
- **Score click is no-op while playing.** Scrubbing during play would mean re-anchoring the Tone transport mid-loop; not worth the regression risk for a feature whose primary need is editing-time navigation.
- **Max measures stays at 8 (current store cap).** Codec already supports far more (`measures` is a u8 with `n ≤ 2048` total steps), but 8 covers practice grooves and avoids stress-testing the vertical stack height.
- **Single-mode `+ Sticking` toggle stays on the first visible block only.** Toggle is global UI state; rendering it on every measure block during play would clutter and serves no purpose since toggling is disabled mid-play anyway.
- **Embed gets `selectable=false` rather than reusing `isPlaying=true`.** Different semantics — playing means "active runtime," not selectable means "no editor". Conflating them broke when an embed is paused.

**Sensors:** typecheck, eslint, vitest (9 tests), prettier check, vite build all pass.

**Caveats:** End-to-end browser exercise (clicking through tabs, watching the stack scroll mid-play, MIDI live markers in stack mode) was not possible from this session — only build sanity. The user should:

1. Verify scroll-to-center in stack mode visually with `measures=4..8`. If the host height calculation feels off, the math is `el.offsetTop - host.clientHeight/2 + el.clientHeight/2`.
2. Verify on `division=32 × measures=8` the perf is acceptable (each block has ~256 cells × 7 lanes; rendering all eight is the worst-case path that didn't exist before).
3. Verify MIDI live markers fire on the right cells in stack mode (the `globalIdx` math is shared between modes, so it should, but practice mode markers were specced against the single-row layout).

**Next:** Consider a "remove this measure" affordance per tab once the basic flow gets used. The store already supports lower `measures` via `setMeasures(n - 1)`, but there's no UI handle yet (out of scope for this pass).

---

## 2026-04-26 — Score markers aligned to actual notes

**Status:** Live MIDI markers on the staff now sit on top of the real noteheads (per voice), are bigger, borderless, and semi-transparent so the underlying note glyph reads through.

**Done:**

- `vex-builder.ts` now returns `voiceY: Record<VoiceId, number>` from `renderScore`. Each voice's Y is captured from `stave.getYForLine(...)` on the first measure's stave, using a `VOICE_LINE` table keyed off each voice's `vexKey` (e.g. `hh: -0.5` above the top line, `kk: 3.5` near the bottom).
- `Score.vue` consumes `voiceY` instead of the `VOICE_Y_PCT` percentage hack that was floating dots above the staff. Removed the table from the component entirely.
- Live marker style: 18×18 (was 12×12), no white border, fill drops to ~55 % alpha. Glow box-shadow keeps grade legible.

**Decisions:**

- **Capture once on measure 0.** Lines are identical across measures; iterating wastes work and risks the wrong stave winning if VexFlow reflows.
- **Semi-transparent on purpose.** The user wants to see if the marker is sitting on the actual notehead — opaque dots hide that, defeating the alignment check.
- **Voice line table colocated with vex-builder.** It has to stay in sync with each voice's `vexKey`; living next to the renderer makes that obvious.

**Next:** End-to-end pass on a real e-kit. If timing-on-the-staff (early/late) becomes desired, see the cautionary note below before reaching for `performance.now()` again.

**Future feature — missed-note markers:** Currently the live marker layer is purely hit-driven (every MIDI hit becomes a marker, graded vs. the programmed step). It does not surface _expected notes that the user failed to hit_. Add a note-driven pass: as each step plays (or once the tolerance window past it closes), check whether any in-window hit matched the expected voice; if not, drop a red marker on the unhit notehead. Implementation hinges on a stable per-step "expected vs. landed" map — likely best built once we have the audio-clock-anchored timeline (see the desync trap entry below) so the matching window is precise.

---

## 2026-04-26 — Reverted: timestamp-based marker positions (desync trap)

**Status:** Reverted. The plan was sound on paper, the result was visibly out of sync. Leaving this note so the next attempt doesn't repeat the same mistake.

**What was tried:**

- Captured `playbackStartedAtMs = performance.now()` right before `Tone.getTransport().start()`, exposed it from `usePlayback`.
- In the `lastHit` watcher, computed `elapsed = h.atMs - startMs - latencyMs`, modulo loop length, derived a `floatStep`, rounded to a logical step, applied a tolerance grace window, and stored `floatStep` on the marker so `Score.vue` could offset the circle horizontally for microtiming.

**Why it broke synchronization:**

- **`performance.now()` and the audio clock are not aligned.** Tone schedules with a lookahead (~100 ms by default) and the AudioContext's `currentTime` runs on a separate clock. Snapping a wall-clock anchor right before `transport.start()` means every elapsed calculation is off by the lookahead, plus jitter from the main thread.
- **`latencyMs` couldn't paper over it.** The user's latency slider was meant to compensate for kit→browser MIDI delay only. With timestamp-based positioning it also had to absorb the Tone lookahead and any scheduler drift, which made the slider's "right value" untethered from the physical hookup.
- **Modulo + negative elapsed = wrong loop.** When `latencyMs > 0` the first few hits in each loop produced negative `elapsed`, which the modulo flipped to the _previous_ loop's window — markers landed at the wrong end of the bar.
- **Mid-play config changes broke the math.** Tempo / measure / practice-mode toggles changed `totalLoopMs` without re-anchoring `playbackStartedAtMs`, so subsequent markers drifted progressively.

**What to do next time:**

- Use the audio clock (`Tone.now()` / `Tone.getTransport().seconds`) as the anchor, not `performance.now()`. The MIDI hit timestamp can be projected onto the transport timeline via `Tone.getContext().now()` at receive time.
- Or stay with `currentStep` snapping (lossy but stable) and add microtiming as a _separate_ visual that comes from the next hit's offset relative to the _next_ `Tone.getDraw().schedule` boundary, not from independent wall-clock math.
- Re-anchor on every `play()` AND every config change that affects loop length (`updateRuntime` should also reset the anchor and recompute).
- Treat this as an audio-engineering problem first, not a math problem. Write a small calibration test (loop a known pattern, click a UI button on the metronome, measure the offset) before wiring anything to the visualization layer.

**Files left untouched after revert:** `midi.ts`, `usePlayback.ts`, `Score.vue`, `EditorView.vue` are back to the previous, working state. Nothing to clean up.

---

## 2026-04-26 — Practice pause + Space shortcut + sticky markers on pause

**Status:** Optional review window between loop iterations and a fix to the play/pause shortcut.

**Done:**

- **Space replaces Esc** as the global play/pause shortcut. Switched detection to `e.code === 'Space'`. Settings drawer's Shortcuts section relabeled to `Space`.
- **MIDI practice mode (off by default).** New section in the Settings drawer with a checkbox + a 1–30 s slider (default 10 s). Both persisted to `localStorage` (`groove:midiPracticeMode`, `groove:midiPracticeSec`).
- **Silent pause between loops.** `usePlayback.play(g, { practicePauseSec })` schedules a per-second `timer` event series in the same `Tone.Part` after the track's last step. No metronome — just a `practiceTimerVal` ref counting down from N to 1. Loop-end extends to `trackEnd + pauseSec`. Pause is ignored when `g.loop` is false.
- **Review countdown overlay.** EditorView shows a teal/primary `practice-timer-number` (slightly smaller than the count-in glyph) with a "review" caption above it. Reuses the count-pulse keyframe.
- **Sticky markers on Pause.** Added `onPlay` / `onStop` wrappers in EditorView. Play always clears markers (fresh start). Stop only clears when `practiceMode` is off — practice mode keeps the verdicts on screen so the user can study after pausing. `lastTrackStep` was introduced so the no-count-in step-wrap detector ignores the `-1` transitions during the practice pause.

**Decisions:**

- **Pause coupled to loop only.** A practice pause without `g.loop = true` leaves the player staring at a dead screen; we just no-op it instead.
- **Single `Tone.Part` for everything.** Count-in beats + steps + timer ticks all share one part, so looping replays the whole sequence atomically. Avoids juggling multiple scheduled timelines.
- **Distinct color for the review countdown.** Teal vs. count-in's red so the user instantly reads "you're in review, not about to be on".
- **Markers cleared on Play, not on Stop.** This way the user's review can outlive a pause; only an intentional restart wipes the slate.

**Next:** Real e-kit pass; consider adding a brief audio cue at "1" of the review countdown so the player knows the next bar is imminent.

---

## 2026-04-26 — Drawer becomes Settings, persistent markers, looping count-in, ESC shortcut

**Status:** Practice/grading flow gone; the right drawer is now a general Settings panel; MIDI feedback markers stay on the grid and tablature for an entire bar; count-in plays before every loop; ESC is the one keyboard shortcut.

**Done:**

- **Practice flow removed.** Midi store dropped `practicing`, `startedAtMs`, `finalReport`, `startPractice`, `finishPractice`, `computeReport`, and `hits` (only `lastHit` matters now). `GrooveGrid` no longer computes a `gradeMap`, and `NoteCell` no longer carries a `grade` prop. `tailwind.css` lost the `.grade-correct/.grade-wrong/.grade-missed` outlines.
- **Drawer = Settings.** `MidiPanel.vue` re-titled "Settings". Sections: Export (PNG / MIDI), MIDI device, MIDI tuning, Last pad, Shortcuts. The export buttons in `TopBar` were removed (top bar now: Clear · Settings · Share). MidiPanel emits `exportMidi` / `exportPng` to EditorView, which still owns the score ref for PNG.
- **Looping count-in.** `usePlayback.ts` now folds count-in beats into the same `Tone.Part` as the track steps. Looping the part replays count-in before every iteration, matching a real practice flow. `loopEnd = countInLen + n × stepSec`.
- **Persistent markers.** Removed the 800 ms TTL in `pushMarker`. Markers stay visible until the editor explicitly calls `clearMarkers()`. `EditorView` clears them on `countInBeat === 3` (count-in path) or when `currentStep` wraps from `>0` back to `0` (no-count-in loop). Animations on the grid dot and the score circle changed from fade-out to one-shot pulse-in (220 ms) that resolves to a stable visible state.
- **ESC = play/pause.** Single global keydown listener in `EditorView`; ignored if focus is in an input/textarea/contenteditable. The previous "ESC closes drawer" handler in `MidiPanel` is gone.

**Decisions:**

- **Count-in inside the part, not as a separate `scheduleOnce` block.** Lets us loop the whole count+track without coordinating two timelines. Cost: count-in events fire as part of the part's draw schedule, so the user-visible `countInBeat` resets to 0 only when the first `step` event fires.
- **Markers cleared at count-in 3, not 1.** Gives the player two count beats to look at the verdict before the next bar starts. With count-in off, we fall back to wrapping `currentStep`.
- **Single shortcut on purpose.** Adding more (Space, R, etc.) was tempting; the user explicitly asked for one. Easy to extend later.
- **MIDI tuning sliders kept** even though no grading consumer uses them now. They're cheap UI and we'll wire them back when a grading view returns.

**Next:** End-to-end with the e-kit. Open follow-ups: marker persistence has no per-loop history (last loop's markers replace previous, can't compare bars over time); the `midi-grader` lib is now unused outside tests — keep or remove next pass.

---

## 2026-04-25 — Live MIDI markers on grid and tablature

**Status:** Every MIDI hit during playback now leaves a short-lived dot on the matching grid cell AND a colored circle on the staff, so the user can see in real time whether they nailed the timing/pad.

**Done:**

- Midi store: new `LiveMarker { id, voiceId, step, atMs, grade }` type with `grade ∈ { 'on-time', 'wrong-voice', 'off-time' }`, plus `markers` ref, `pushMarker`, `clearMarkers`. Markers auto-decay after 800 ms via `setTimeout`.
- `EditorView`: watches `midi.lastHit` and, while `isPlaying`, snaps the hit to `currentStep`, classifies it (`on-time` if the programmed groove has that voice firing here; `wrong-voice` if any other voice is expected; `off-time` if nothing is expected), and pushes a marker. `clearMarkers()` runs on stop so stale dots don't linger.
- `GrooveGrid` reads `markers` and forwards a per-cell `liveMarker` grade to `NoteCell`.
- `NoteCell` + `tailwind.css`: a small filled dot in the bottom-right corner of the cell, color-coded by grade, with an 800 ms scale/fade keyframe (`live-marker-fade`). Distinct from `live-hit` (column-0 verification glow) and from `grade-correct/wrong/missed` (practice-mode outlines).
- `Score.vue`: an absolutely-positioned circle is drawn at `stepMarkers[step].x + width/2`, with Y derived from a per-voice `VOICE_Y_PCT` mapping (rough staff-position approximation). Circles fade out via `score-marker-fade` over 800 ms.

**Decisions:**

- **Snap to `currentStep`, not to a tolerance window.** The cell granularity already encodes "near miss" via wrong-voice/off-time. Refining timing into "early/late by N ms" is a future step (and would conflict with the existing tolerance setting in practice grading).
- **Live markers are independent of practice mode.** They fire whenever playback runs and a device is connected — no Start/Finish required. Keeps the feature usable as casual visual feedback while jamming.
- **Three grade colors reused everywhere.** Green = on-time, amber = wrong-voice, red = off-time. Matches the practice-mode outline colors so users learn one palette.
- **Voice on staff via Y-percentage table.** Pulling exact note-head Y out of VexFlow is brittle; a coarse percentage map is good enough for a "the kick dot lands near the bottom" read.

**Next:** End-to-end with a real e-kit. Open follow-ups: snapping doesn't surface early/late timing; markers don't survive across loop boundaries (cleared on stop only).

---

## 2026-04-25 — MIDI drawer overlay + supported-flag fix

**Status:** MIDI panel now hidden by default and opens as a right-side drawer over the editor. Bug fix: panel was always reporting "Web MIDI not supported" even on Chrome.

**Done:**

- Bug fix in `src/stores/midi.ts`: `supported` was a plain `const` returned from the setup store, which `storeToRefs` silently drops (only refs/computed survive destructuring). The destructured `supported` in `MidiPanel` was therefore `undefined`, making `v-if="!supported"` always true. Wrapped in `ref(...)`. Also exposed `panelOpen` + `openPanel/closePanel/togglePanel`.
- `MidiPanel.vue` rewritten as a fixed `position: fixed` drawer with a backdrop, slide-in animation from the right, ESC to close, click-outside to dismiss. The editor layout itself is untouched.
- `EditorView.vue` reverted to its original single-column layout — the drawer is mounted as a sibling to `<main>` so it overlays without affecting the existing flow.
- `TopBar.vue` gained a `MIDI` button (with a small green dot when a device is connected) that calls `midi.togglePanel()`.

**Decisions:**

- **Drawer over sidebar.** First pass put MIDI in a sticky right column, but the user wanted the editor's CSS untouched and the panel hidden until explicitly opened. Drawer is the natural fit.
- **Open state lives in the store.** `panelOpen` next to the rest of the MIDI state means TopBar can toggle without prop-drilling and any other component (e.g. a future "Connect & start" CTA) can open the drawer too.
- **Live cell feedback stays independent of the panel.** `GrooveGrid` reads `lastHit`/grade map straight from the store, so the column-0 monitor and per-cell grading still work whether the drawer is open or closed.
- **Trigger lives in TopBar, not as a floating button.** Keeps with existing chrome and avoids a stray FAB.

**Next:** Live e-kit verification of the supported-flag fix and the drawer flow.

---

## 2026-04-25 — MIDI sidebar + in-grid feedback

**Status:** MIDI controls live in a wide right sidebar. The grid now doubles as the live pad monitor and the grading display.

**Done:**

- New `src/stores/midi.ts` — Pinia store owning Web MIDI access, hits, last-hit, latency/tolerance settings (persisted in `localStorage`), practice state, and final report. Replaces `src/composables/useMidiInput.ts` (deleted).
- `MidiPanel.vue` rewritten as a tall, sticky right-column sidebar with sections: Device · Settings (range sliders for latency/tolerance) · Last pad (voice label + GM note + velocity bar) · Practice · Score summary.
- `EditorView.vue` switched to a two-column layout (`flex-col lg:flex-row`); main column holds editor controls/score/transport/grid, right column hosts `MidiPanel` (`lg:w-[360px]` sticky to top).
- `GrooveGrid.vue` now reads the MIDI store. When playback is stopped and a device is connected, each incoming pad pulses the matching voice's step-0 cell for ~250 ms — verifies pad→voice mapping without leaving the grid. During practice it computes a live grade map (recomputed per hit); after Finish the frozen `finalReport` drives the same map.
- `NoteCell.vue` accepts `liveHit` and `grade` props; `tailwind.css` adds a `live-hit` pulse animation and `grade-correct/wrong/missed` outlines (green/amber/red dashed).

**Decisions:**

- **Grid column 0 reused as the live monitor.** No separate strip. When the user is connected but not practicing/playing, hitting a pad blinks the corresponding voice's first cell — works on empty cells too via a tinted background.
- **Grade map is live during practice.** `gradeHits` is greedy and stable over a sorted hit array, so recomputing on every store mutation gives correct partial state without breaking the final report.
- **State moved to a Pinia store.** Multiple components (`MidiPanel`, `GrooveGrid`) need the same hits/lastHit/settings; a shared store is cleaner than provide/inject or prop drilling.
- **Sliders, not number inputs.** Range inputs read better in a dense sidebar and avoid the spinner-driven typo problem when dialing latency.
- **Sidebar collapses on small screens.** `lg:` breakpoint puts the sidebar below the editor on narrow viewports; sticky-top behavior is `lg:` only.

**Next:** End-to-end verification with a real e-kit. Open follow-ups: extras have no in-grid representation (still a numeric-only count); multi-loop grading still uses loop-0 schedule.

---

## 2026-04-25 — Phase 3 complete (MVP — needs e-kit verification)

**Status:** Web MIDI listener, grader, and practice panel landed. Logic is unit-tested. End-to-end verification requires a connected e-drum kit and a supported browser; the user owns this.

**Done:**

- `src/lib/midi-grader.ts` — pure logic. `buildSchedule(g, startMs)` derives expected hits from a groove iterating the registry. `gradeHits(expected, actual, tol)` does greedy matching: prefers same-voice within tolerance, falls back to wrong-voice, otherwise marks missed. Unconsumed actuals become extras. `summarize(report)` rolls up to a percentage.
- `src/composables/useMidiInput.ts` — Web MIDI wrapper. Requests access on click, connects to first input, listens for note-on, maps GM note → voice via `voiceForMidiNote()` in `voices.ts`. Stores hits with `performance.now()` timestamps.
- `src/lib/voices.ts` — added `voiceForMidiNote()` plus an `INPUT_ONLY_MIDI` table for kit-side notes that don't appear in our state mappings (snare rim 37, alternate tom GMs, crash → ride fallback).
- `src/components/groove/MidiPanel.vue` — connect/disconnect, latency offset and tolerance inputs (both persisted to `localStorage`), Start/Finish practice buttons, score summary panel.
- Wired `MidiPanel` into `EditorView`. `EmbedView` stays read-only and has no MIDI affordance.
- `tests/midi-grader.spec.ts` — 8 cases covering schedule build, exact hits, tolerance window, wrong-voice grading, extras counting, same-voice preference, and summary rollup.

**Decisions:**

- **Practice mode is manual.** User clicks Start, plays through the chart however many loops, clicks Finish. No automatic tie to playback transport — keeps the panel independent and avoids state coupling.
- **Velocity and dynamic state ignored.** Grading checks voice + timing only. Whether the player executed a hit as accent or ghost is not measured. Adding this needs MIDI velocity → state inference, which is noisy and out of MVP scope.
- **Latency offset is manual.** No calibration screen yet — user dials in the offset that produces the best scores. Persisted per browser.
- **Default tolerance is 40 ms.** A typical drummer's tightness on consecutive 16ths at 120 BPM has spread in this range. Increase for forgiving practice, decrease to push tightness.
- **Aroma TDX 15S kit support.** GM 37 (rim) maps to snare for grading. GM 49 (crash) maps to ride since we don't have a crash voice yet.

**Known gaps for follow-up:**

- No per-cell visual feedback in the grid — the panel shows a numeric report only. Adding cell badges (green/red/yellow) is a UX win but requires plumbing grade state into `GrooveGrid`.
- Browsers without Web MIDI (Safari) get a clear unsupported message; no fallback.
- Multi-loop practice: hits past the first loop are still graded against the first loop's schedule. Pull `loop` true into the schedule builder to fix.
- No streak counter, no tempo ramp, no lesson flow — all explicitly deferred per the spec.

**Next:** End-to-end verification with the Aroma TDX 15S, then iterate from there. Cell-level visual feedback is the highest-value next slice.

---

## 2026-04-25 — Phase 2 complete

**Status:** Toms (t1, t2, t3) and ride lane wired in UI, render, and playback.

**Done:**

- Added `t2` (mid tom, GM 47) to the registry alongside the existing `t1` and `t3`. Synth in `usePlayback.ts` is a `MembraneSynth` tuned between `t1` (high) and `t3` (floor).
- Editor grid now shows seven lanes top-down: HI-HAT → RIDE → TOM 1 → TOM 2 → TOM 3 → SNARE → KICK.
- Lazy-allocated voice arrays in the store: clicking a tom or ride cell creates the array on first use, so empty lanes don't bloat URLs.
- `NoteCell` now reads its symbol/accent from the registry when given a `voiceId`. Ride cells render `x`/`X` to match the score notation; toms keep `●`/`◆`/`○`.
- Codec test extended to round-trip t2 alongside t1, t3, ride.

**Decisions:**

- Editor lane order keeps toms grouped together rather than splitting around the snare like a drum chart. Easier to scan when editing.
- All four extra lanes (ride + 3 toms) are always visible. No "+ Add tom" affordance for now; toggle UI adds noise we don't yet need.
- t2 GM note is 47 (low-mid tom). Standard GM has 48 too (hi-mid); we picked the lower one because the kit's mid tom typically sits closer to floor in pitch.

**Next:** Phase 3 — MIDI input MVP. Read `docs/specs/midi-input.md`. The registry already has GM mappings per voice — Phase 3 inverts that map for input. Open design questions on the spec (latency calibration, grading model, display) need decisions before coding.

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
