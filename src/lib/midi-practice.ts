import type { VoiceId } from './voices'

export type PracticeGrade =
  | 'perfect'
  | 'early'
  | 'late'
  | 'wrong-voice'
  | 'wrong-articulation'
  | 'missed'
  | 'extra'

export interface PracticeSlot {
  atSec: number
  step: number
  pass: number
  cycle: number
  stepSec: number
  notes: { voiceId: VoiceId; midi: number }[]
}

export interface PracticeHit {
  voiceId: VoiceId
  rawNote: number
  atSec: number
  atMs: number
}

export interface PracticeResult {
  voiceId: VoiceId
  step: number
  pass: number
  cycle: number
  atMs: number
  grade: PracticeGrade
  deltaMs?: number
  expectedVoice?: VoiceId
  expectedMidi?: number
  rawNote?: number
}

interface Expected {
  slot: PracticeSlot
  voiceId: VoiceId
  midi: number
}

export const GRADE_LABELS: Record<PracticeGrade, string> = {
  perfect: 'No tempo',
  early: 'Adiantada',
  late: 'Atrasada',
  'wrong-voice': 'Outra peça',
  'wrong-articulation': 'Outro chimbal',
  missed: 'Omitida',
  extra: 'Extra',
}

export function timingWindow(stepSec: number): number {
  // Association is broader than the green window, but shorter than one step.
  // A nearby empty subdivision must not turn a correct drum into a wrong drum.
  return Math.min(0.18, stepSec * 0.9)
}

export function resultLabel(result: PracticeResult): string {
  const delta = result.deltaMs
  return `${GRADE_LABELS[result.grade]}${delta == null ? '' : ` (${delta > 0 ? '+' : ''}${delta} ms)`}, passagem ${result.pass}`
}

export class MidiPractice {
  private expected: Expected[] = []
  private hits: PracticeHit[] = []
  private slots: PracticeSlot[] = []
  private cutoff = Infinity

  constructor(private toleranceMs: number) {}

  addSlot(slot: PracticeSlot) {
    this.slots.push(slot)
    for (const note of slot.notes) this.expected.push({ slot, ...note })
  }

  addHit(hit: PracticeHit) {
    if (hit.atSec <= this.cutoff) this.hits.push(hit)
  }

  finishAt(atSec: number) {
    this.cutoff = atSec
    this.expected = this.expected.filter((e) => e.slot.atSec <= atSec)
    this.slots = this.slots.filter((s) => s.atSec <= atSec)
    this.hits = this.hits.filter((h) => h.atSec <= atSec)
  }

  advance(nowSec: number): PracticeResult[] {
    const results: PracticeResult[] = []
    const usedExpected = new Set<Expected>()
    const usedHits = new Set<PracticeHit>()
    // Allow the browser to deliver queued MIDI messages before declaring a miss.
    const graceSec = 0.12
    const ready = (e: Expected) => nowSec > e.slot.atSec + timingWindow(e.slot.stepSec) + graceSec
    const pairs: { e: Expected; h: PracticeHit; distance: number }[] = []
    for (const e of this.expected) {
      for (const h of this.hits) {
        const distance = Math.abs(h.atSec - e.slot.atSec)
        if (h.voiceId === e.voiceId && distance <= timingWindow(e.slot.stepSec)) {
          pairs.push({ e, h, distance })
        }
      }
    }
    pairs.sort((a, b) => a.distance - b.distance)
    const reservedExpected = new Set<Expected>()
    const reservedHits = new Set<PracticeHit>()
    for (const { e, h } of pairs) {
      if (reservedExpected.has(e) || reservedHits.has(h)) continue
      reservedExpected.add(e)
      reservedHits.add(h)
      if (!ready(e)) continue
      const deltaMs = Math.round((h.atSec - e.slot.atSec) * 1000)
      const articulation = e.voiceId === 'hh' && e.midi !== h.rawNote
      const grade = articulation
        ? 'wrong-articulation'
        : Math.abs((h.atSec - e.slot.atSec) * 1000) <= this.toleranceMs
          ? 'perfect'
          : deltaMs < 0
            ? 'early'
            : 'late'
      results.push(this.result(e, h, grade, deltaMs))
      usedExpected.add(e)
      usedHits.add(h)
    }
    for (const e of this.expected) {
      if (!ready(e) || usedExpected.has(e) || reservedExpected.has(e)) continue
      const h = this.hits
        .filter(
          (h) =>
            !reservedHits.has(h) &&
            !usedHits.has(h) &&
            Math.abs(h.atSec - e.slot.atSec) <=
              Math.min(this.toleranceMs / 1000, timingWindow(e.slot.stepSec)),
        )
        .sort((a, b) => Math.abs(a.atSec - e.slot.atSec) - Math.abs(b.atSec - e.slot.atSec))[0]
      results.push(
        this.result(
          e,
          h,
          h ? 'wrong-voice' : 'missed',
          h ? Math.round((h.atSec - e.slot.atSec) * 1000) : undefined,
        ),
      )
      usedExpected.add(e)
      if (h) usedHits.add(h)
    }
    for (const h of this.hits) {
      if (usedHits.has(h) || reservedHits.has(h)) continue
      const slot = this.slots.reduce<PracticeSlot | null>(
        (best, s) =>
          !best || Math.abs(h.atSec - s.atSec) < Math.abs(h.atSec - best.atSec) ? s : best,
        null,
      )
      if (!slot || nowSec <= h.atSec + timingWindow(slot.stepSec) + graceSec) continue
      if (
        h.atSec < slot.atSec - timingWindow(slot.stepSec) ||
        h.atSec >= slot.atSec + slot.stepSec
      ) {
        usedHits.add(h)
        continue
      }
      results.push({
        voiceId: h.voiceId,
        step: slot.step,
        pass: slot.pass,
        cycle: slot.cycle,
        atMs: h.atMs,
        grade: 'extra',
        rawNote: h.rawNote,
      })
      usedHits.add(h)
    }
    this.expected = this.expected.filter((e) => !usedExpected.has(e))
    this.hits = this.hits.filter((h) => !usedHits.has(h))
    this.slots = this.slots.filter((s) => s.atSec > nowSec - 2)
    return results
  }

  private result(
    e: Expected,
    h: PracticeHit | undefined,
    grade: PracticeGrade,
    deltaMs?: number,
  ): PracticeResult {
    return {
      voiceId: h?.voiceId ?? e.voiceId,
      step: e.slot.step,
      pass: e.slot.pass,
      cycle: e.slot.cycle,
      atMs: h?.atMs ?? 0,
      grade,
      deltaMs,
      expectedVoice: e.voiceId,
      expectedMidi: e.midi,
      rawNote: h?.rawNote,
    }
  }
}
