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
import type { Groove, HatValue, NoteValue } from './model'

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
  return (
    g.voices.hh[step] !== 0 ||
    g.voices.sn[step] !== 0 ||
    g.voices.kk[step] !== 0
  )
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
  const hh = g.voices.hh[step] as HatValue
  const sn = g.voices.sn[step] as NoteValue
  const kk = g.voices.kk[step] as NoteValue
  const keys: string[] = []
  const articulations: { type: string; position: number }[] = []
  const annotations: { text: string; justify: 'top' | 'bottom' }[] = []

  if (hh !== 0) {
    keys.push(hh === 4 ? 'f/4/x2' : 'g/5/x2')
    if (hh === 2) annotations.push({ text: 'o', justify: 'top' })
    if (hh === 3) articulations.push({ type: 'a>', position: 3 })
  }
  if (sn !== 0) {
    keys.push('c/5')
    if (sn === 2) articulations.push({ type: 'a>', position: 3 })
    if (sn === 3) annotations.push({ text: '(·)', justify: 'top' })
  }
  if (kk !== 0) {
    keys.push('f/4')
    if (kk === 2) articulations.push({ type: 'a>', position: 3 })
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
  measureStart: number
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
  x: number     // left edge of marker in svg pixels
  width: number // width of marker in svg pixels
}

export interface RenderResult {
  svg: SVGSVGElement | null
  height: number
  stepMarkers: StepMarker[] // one per step in the whole groove, pointing at the note that rings during that step
}

export function renderScore(
  container: HTMLDivElement,
  g: Groove,
  opts: { width?: number } = {}
): RenderResult {
  container.innerHTML = ''
  const stepsPerMeasure = g.division
  const measures = g.measures
  const width = opts.width ?? Math.max(360, Math.min(1100, container.clientWidth || 720))
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

  for (let m = 0; m < measures; m++) {
    const stave = new Stave(20 + m * measureWidth, 56, measureWidth)
    if (m === 0) stave.addClef('percussion').addTimeSignature(`${g.timeSig[0]}/${g.timeSig[1]}`)
    stave.setContext(ctx).draw()

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
  }
}
