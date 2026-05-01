import {
  Annotation,
  Articulation,
  Beam,
  Dot,
  Formatter,
  Fraction,
  GhostNote,
  Renderer,
  Stave,
  StaveNote,
  Stem,
  Voice,
} from 'vexflow'
import type { Groove } from './model'
import { VOICES, type VoiceId } from './voices'

// Treble-clef line numbers per voice's `vexKey`. VexFlow's `getYForLine`
// treats line 0 as the top staff line and line 4 as the bottom; spaces and
// ledger positions are halves and negatives. Keeping this here means we
// derive marker Y from the rendered stave instead of guessing percentages.
const VOICE_LINE: Record<VoiceId, number> = {
  hh: -0.5, // g/5/x2 — above top line
  ride: 0, // f/5/x2 — top line
  t1: 0.5, // e/5
  t2: 1, // d/5
  sn: 1.5, // c/5
  t3: 2.5, // a/4
  kk: 3.5, // f/4
}

// Map { stepsPerBeat: { span → VexFlow duration } }. Covers 4/4 with the
// supported divisions. Dotted durations collapse "note + following empty"
// spans so beams read as one group per beat, without rest glyphs in the middle.
const DURATION_TABLE: Record<number, Record<number, string>> = {
  1: { 1: 'q' },
  2: { 1: '8', 2: 'q' },
  4: { 1: '16', 2: '8', 3: '8d', 4: 'q' },
  8: { 1: '32', 2: '16', 3: '16d', 4: '8', 6: '8d', 8: 'q' },
}

function durationForSpan(span: number, stepsPerBeat: number): string {
  const byBeat = DURATION_TABLE[stepsPerBeat]
  if (byBeat && byBeat[span]) return byBeat[span]
  // Fallback to the single-step duration (tolerates odd spans in div=32 etc.)
  const singleStep: Record<number, string> = { 1: 'q', 2: '8', 4: '16', 8: '32' }
  return singleStep[stepsPerBeat] ?? '16'
}

function hasAnyHit(g: Groove, step: number): boolean {
  for (const voice of VOICES) {
    const arr = g.voices[voice.id]
    if (arr && arr[step] !== 0) return true
  }
  return false
}

interface Built {
  keys: string[]
  duration: string
  articulations: { type: string; position: number }[]
  annotations: { text: string; justify: 'top' | 'bottom' }[]
  isRest: boolean
  span: number // number of base-division steps this tickable covers
}

function buildCellKeys(g: Groove, step: number) {
  const keys: string[] = []
  const articulations: { type: string; position: number }[] = []
  const annotations: { text: string; justify: 'top' | 'bottom' }[] = []

  for (const voice of VOICES) {
    const arr = g.voices[voice.id]
    if (!arr) continue
    const state = arr[step] ?? 0
    if (state === 0) continue
    const def = voice.states[state]
    if (!def) continue
    keys.push(def.vexKey ?? voice.vexKey)
    if (def.articulation) articulations.push({ type: def.articulation, position: 3 })
    if (def.annotation) annotations.push({ text: def.annotation, justify: 'top' })
  }
  return { keys, articulations, annotations }
}

// Single voice per measure. Within each beat, consecutive empty steps are
// absorbed into the preceding note's duration (16th → 8th → 8d → quarter).
// Leading/trailing empty steps become a rest at that beat edge, so beams can
// cover the remaining notes as one group.
// Also returns stepToBuiltIdx: for each base-division step in the measure,
// the index of the Built that covers it. Lets the step marker stay on the
// currently ringing note for steps that span multiple base positions.
function buildMainVoice(
  g: Groove,
  measureStart: number,
): { builts: Built[]; stepToBuiltIdx: number[] } {
  const div = g.division
  const stepsPerBeat = div / g.timeSig[0]
  const numBeats = g.timeSig[0]
  const builts: Built[] = []
  const stepToBuiltIdx: number[] = new Array(div)

  for (let beat = 0; beat < numBeats; beat++) {
    const beatStart = beat * stepsPerBeat
    let i = 0
    while (i < stepsPerBeat) {
      const step = measureStart + beatStart + i
      const hasNote = hasAnyHit(g, step)

      // Grow the span until the next hit or the end of the beat.
      let j = i + 1
      while (j < stepsPerBeat && !hasAnyHit(g, measureStart + beatStart + j)) {
        j++
      }
      const span = j - i
      const dur = durationForSpan(span, stepsPerBeat)
      const builtIdx = builts.length

      if (hasNote) {
        const cell = buildCellKeys(g, step)
        builts.push({
          keys: cell.keys,
          duration: dur,
          articulations: cell.articulations,
          annotations: cell.annotations,
          isRest: false,
          span,
        })
      } else {
        builts.push({
          keys: ['b/4'],
          duration: dur + 'r',
          articulations: [],
          annotations: [],
          isRest: true,
          span,
        })
      }

      for (let k = 0; k < span; k++) {
        stepToBuiltIdx[beatStart + i + k] = builtIdx
      }

      i = j
    }
  }
  return { builts, stepToBuiltIdx }
}

function toStaveNote(b: Built): StaveNote {
  const note = new StaveNote({
    keys: b.keys,
    duration: b.duration,
    auto_stem: false,
    stem_direction: Stem.UP,
  })
  note.setStemDirection(Stem.UP)
  for (const a of b.articulations) {
    note.addModifier(new Articulation(a.type).setPosition(a.position))
  }
  for (const an of b.annotations) {
    note.addModifier(new Annotation(an.text).setVerticalJustification(an.justify))
  }
  // Attach dots if the duration string ends in 'd'.
  if (b.duration.endsWith('d')) Dot.buildAndAttach([note])
  return note
}

function buildStickingNotes(g: Groove, measureStart: number): GhostNote[] {
  const div = g.division
  // Ghost notes at base step resolution. cellDuration for single step:
  const stepDur = ({ 4: 'q', 8: '8', 16: '16', 32: '32' } as Record<number, string>)[div] ?? '16'
  const notes: GhostNote[] = []
  for (let i = 0; i < div; i++) {
    const stk = g.sticking[measureStart + i]
    const n = new GhostNote(stepDur)
    if (stk && stk !== '-') {
      n.addModifier(new Annotation(stk).setVerticalJustification('top'))
    }
    notes.push(n)
  }
  return notes
}

export interface StepMarker {
  x: number // left edge of marker in svg pixels
  width: number // width of marker in svg pixels
}

export interface MeasureBounds {
  x: number // left edge of the measure (incl. clef/time-sig area on m=0) in svg pixels
  width: number
}

export interface RenderResult {
  svg: SVGSVGElement | null
  height: number
  stepMarkers: StepMarker[] // one per step in the whole groove, pointing at the note that rings during that step
  voiceY: Record<VoiceId, number> // exact Y in svg pixels per voice — drives live MIDI marker placement on the staff
  measureBounds: MeasureBounds[] // one per measure — drives click-to-select-measure in the editor
}

export function renderScore(
  container: HTMLDivElement,
  g: Groove,
  opts: { width?: number } = {},
): RenderResult {
  container.innerHTML = ''
  const stepsPerMeasure = g.division
  const measures = g.measures
  const width = opts.width ?? Math.max(360, container.clientWidth || 720)
  const measureWidth = Math.max(180, (width - 40) / measures)
  const totalWidth = 40 + measureWidth * measures
  const height = 200

  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(totalWidth, height)
  const ctx = renderer.getContext()
  ctx.setFont('Arial', 10)

  // Simple meters only for now — beat group = 1/4. TODO: 6/8 etc.
  const beatGroup = new Fraction(1, 4)
  const stepMarkers: StepMarker[] = []
  const voiceY = {} as Record<VoiceId, number>
  const measureBounds: MeasureBounds[] = []

  for (let m = 0; m < measures; m++) {
    const staveX = 20 + m * measureWidth
    measureBounds.push({ x: staveX, width: measureWidth })
    const stave = new Stave(staveX, 56, measureWidth)
    if (m === 0) stave.addClef('percussion').addTimeSignature(`${g.timeSig[0]}/${g.timeSig[1]}`)
    stave.setContext(ctx).draw()

    // Lines are identical across measures — capture Y once on the first stave.
    if (m === 0) {
      for (const v of VOICES) voiceY[v.id] = stave.getYForLine(VOICE_LINE[v.id])
    }

    const measureStart = m * stepsPerMeasure
    const { builts, stepToBuiltIdx } = buildMainVoice(g, measureStart)
    const mainNotes = builts.map((b) => toStaveNote(b))

    const mainVoice = new Voice({ num_beats: g.timeSig[0], beat_value: g.timeSig[1] })
    mainVoice.setStrict(false)
    mainVoice.addTickables(mainNotes)

    const stickingNotes = buildStickingNotes(g, measureStart)
    const stickingVoice = new Voice({ num_beats: g.timeSig[0], beat_value: g.timeSig[1] })
    stickingVoice.setStrict(false)
    stickingVoice.addTickables(stickingNotes)

    new Formatter()
      .joinVoices([mainVoice, stickingVoice])
      .format([mainVoice, stickingVoice], measureWidth - 40)

    for (const n of mainNotes) if (!n.isRest()) n.setStemDirection(Stem.UP)

    const mainBeams = Beam.generateBeams(mainNotes, {
      groups: [beatGroup],
      beam_rests: false,
      maintain_stem_directions: true,
      stem_direction: Stem.UP,
    })

    // NOTE: don't call setStemDirection on notes after beam generation — it
    // calls reset() internally, which clears the note's beam reference and
    // causes flags to render alongside the beam.

    mainVoice.draw(ctx, stave)
    stickingVoice.draw(ctx, stave)
    mainBeams.forEach((b) => b.setContext(ctx).draw())

    // Per-step markers: fixed-width highlight centered on the notehead of the
    // note currently ringing. Steps that share a note (e.g. an 8th covering
    // two 16th positions) resolve to the same marker, so the highlight stays
    // put while the note sustains.
    // getNoteHeadBeginX/EndX give the actual notehead glyph bounds — cleaner
    // than getAbsoluteX which is the tick-context X and sits slightly left.
    const markerWidth = 18
    for (let s = 0; s < stepsPerMeasure; s++) {
      const bIdx = stepToBuiltIdx[s]
      const note = mainNotes[bIdx] as StaveNote & {
        getNoteHeadBeginX?: () => number
        getNoteHeadEndX?: () => number
      }
      const headBegin = note.getNoteHeadBeginX?.() ?? note.getAbsoluteX()
      const headEnd = note.getNoteHeadEndX?.() ?? headBegin + 10
      const center = (headBegin + headEnd) / 2
      stepMarkers.push({ x: center - markerWidth / 2, width: markerWidth })
    }
  }

  return {
    svg: container.querySelector('svg') as SVGSVGElement | null,
    height,
    stepMarkers,
    voiceY,
    measureBounds,
  }
}
