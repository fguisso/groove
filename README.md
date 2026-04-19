# groove

A drum groove editor and score renderer for the web. Click cells to build a beat, hear it through a synthesized kit, read it on a percussion staff, and share it as a URL short enough to paste anywhere. Frontend only. The whole groove lives in the link.

![Groove v0.1](./groove-v0.1.png)

## Acknowledgments

This project would not exist without [GrooveScribe](https://github.com/montulli/GrooveScribe) and its creator, Lou Montulli. For years, even after the original project slowed down, I kept a personal fork running as my practice companion for drum studies. Without that tool I probably would not have progressed as far on the kit, nor gotten as comfortable with the underlying music theory.

It also sparked my curiosity about the stack behind music software on the web: how scores render, how audio is scheduled with tight timing, how state survives in a shareable URL. Following that thread is what pushed me to learn the tools this app is built on.

## Features

**Embed via iframe.** This is the feature I care about most. I use it on my personal wiki to document drum lessons and practice goals, and this app exists in large part so that workflow keeps working. Live example: [In the End (lesson notes)](https://wiki.guisso.dev/music/aulas-de-bateria-com-grillo/in-the-end/). The embed view has no editor chrome, can be locked read-only via `?ro=1`, and posts a `groove:resize` message to the parent so the host page can auto-fit the iframe height.

> Heads up if you are embedding against a hosted instance on my domain (`guisso.dev` or subdomains): the URL payload format and route shape are not a stable API contract yet. I may change the codec or the routes as the project evolves, which will break embeds pinned to the old format. If you rely on embeds long term, fork this repo and host your own build instead.

**Notation that reads like a drum chart.** Beams group per beat, stems go up, notes at the same tick share a single stem, and empty space inside a beat is absorbed into the preceding note duration (a 16th followed by an empty slot becomes an 8th, and so on). A translucent marker follows playback through the score, sitting on the note currently ringing.

**Cell-based input grid.** Click to cycle note states: normal, accent, ghost, open hat, pedal. Hi-hat, snare, and kick as separate lanes, with an optional sticking row for R, L, B. Visual gaps delimit beats inside each measure so the grid reads at a glance.

**Synthesized audio via Tone.js.** No samples to download. Kick is a tight membrane synth, snare mixes filtered noise with a tonal body, hi-hats are shaped from white noise through carefully tuned filters. Swing, loop, metronome, and count-in are all supported. The count-in shows a large on-screen counter so you know exactly when the groove enters.

**Short, shareable URLs.** State is packed into a compact binary format and base64url-encoded into the URL fragment. An empty groove is 11 characters. A typical 16-step rock beat fits in under 50. No server is involved at any point.

**MIDI and PNG export.** Download the groove as a standard `.mid` file (GM drum mapping) or as a PNG of the rendered score.

**Light and dark themes.** Tuned to match the aesthetics of modern audio software.

## Stack

Vue 3, TypeScript, Vite, Pinia, shadcn-vue, VexFlow, Tone.js, `@tonejs/midi`, Tailwind CSS.

## Running locally

```sh
npm install
npm run dev
```

Open `http://localhost:5173`.

Production build:

```sh
npm run build
npm run preview
```

## URL shape

- Editor: `/#/g/<payload>`
- Embed: `/#/embed/g/<payload>` (append `?ro=1` to lock the transport)

The payload is a bit-packed binary representation of the groove, base64url-encoded. An empty groove is 11 characters. Typical patterns sit around 30 to 50.

## Roadmap

Things I want to get to, roughly in the order I think about them. No promises on timing.

Near term

- [ ] Undo and redo.
- [ ] Toms and cymbal ride lanes (the data model already supports `t1`, `t4`, `cy`; just needs UI and renderer wiring).
- [ ] Triplet feel: make divisions 6, 12, 24 render as tuplets on the score instead of falling back to straight eighths.
- [ ] More time signatures: 3/4, 2/4, 6/8 (beaming rules for compound meters).
- [ ] Print friendly layout and PDF export.
- [ ] Mobile touch polish (bigger hit targets, horizontal scroll affordance).

Medium term

- [ ] Grooves library: a small browsable set of named presets (rock, funk, shuffle, common fills), similar to the old GrooveScribe menu.
- [ ] Per-measure variation inside a multi-bar groove (intro, verse, fill).
- [ ] Click-and-drag to paint cells across a row.
- [ ] Keyboard shortcuts.

Long term

- [ ] Connect to an electronic kit over Web MIDI, so the app can listen to what I play on the pads, score it, and grade it. This is the destination: a self-hostable, open-source drum tutor.
- [ ] Built-in lesson flow: a groove plus a metronome goal, a streak counter, and feedback when the notes I play match the chart.
- [ ] Exercise templates with progressive tempo (start at 60 bpm, bump 2 bpm per successful loop).
- [ ] Self-hosted sync of saved grooves across devices (optional, still no account by default).

Maintenance

- [ ] Swap remaining single-letter voice keys for a small named-voice abstraction so adding a new drum does not touch five files.
- [ ] More codec test coverage (property-based round-trip fuzz).
- [ ] Accessibility pass (keyboard nav of the cell grid, ARIA for the transport).

## About this project

Groove is coming together piece by piece. My main goal is to learn more about music software (how scores render, how audio is scheduled, how state survives in a URL) and to build a tool I can actually use in my own drum practice. I pull features from GrooveScribe where it makes sense and add new ones as I see the need.

The longer arc is to document my drum studies thoroughly and, further down the road, bridge into an open-source digital tutor that can talk to my electric kit. That is a long road and I am walking it slowly.

## Contributing

Code, bug reports, and feedback are all welcome.

A note before you open a PR: I do not have a strong formal music background, and I expect other contributors here to often be curious programmers in the same boat. If you are proposing a feature rooted in music theory or drum notation conventions, please explain the concept in your PR description. Write as if the reader is a capable programmer but not a music teacher, and teach us what you are adding. The same for programmers, explain to musician what you are doing.

Let us treat this build as an excuse to learn together.
