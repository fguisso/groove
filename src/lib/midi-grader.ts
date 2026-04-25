import type { Groove } from './model'
import { VOICES, type VoiceId } from './voices'

export interface ExpectedHit {
  step: number
  voiceId: VoiceId
  expectedAtMs: number
}

export interface ActualHit {
  voiceId: VoiceId
  atMs: number
}

export type Grade = 'correct' | 'wrong-voice' | 'missed'

export interface GradedHit {
  expected: ExpectedHit
  actual: ActualHit | null
  grade: Grade
}

export interface GradeReport {
  hits: GradedHit[]
  extras: ActualHit[]
}

export function stepDurationMs(g: Groove): number {
  const beatsPerSec = g.tempo / 60
  const stepsPerBeat = g.division / g.timeSig[0]
  return 1000 / (beatsPerSec * stepsPerBeat)
}

// Build the schedule of expected hits for one loop of `g`, anchored at
// `startAtMs`. Caller is responsible for shifting times if the schedule
// covers multiple loops.
export function buildSchedule(g: Groove, startAtMs: number): ExpectedHit[] {
  const stepMs = stepDurationMs(g)
  const n = g.voices.hh.length
  const out: ExpectedHit[] = []
  for (let step = 0; step < n; step++) {
    for (const voice of VOICES) {
      const arr = g.voices[voice.id]
      if (!arr) continue
      if ((arr[step] ?? 0) === 0) continue
      out.push({ step, voiceId: voice.id, expectedAtMs: startAtMs + stepMs * step })
    }
  }
  return out
}

// Greedy left-to-right matching. For each expected hit, find the closest
// uncomputed actual hit within tolerance. Prefer same-voice; fall back to
// any voice (graded as wrong-voice). Unconsumed actual hits become extras.
export function gradeHits(
  expected: ExpectedHit[],
  actual: ActualHit[],
  toleranceMs: number,
): GradeReport {
  const sortedActual = [...actual].sort((a, b) => a.atMs - b.atMs)
  const consumed = new Set<number>()
  const hits: GradedHit[] = []

  for (const exp of expected) {
    let bestExact = -1
    let bestExactDelta = Infinity
    let bestWrong = -1
    let bestWrongDelta = Infinity
    for (let i = 0; i < sortedActual.length; i++) {
      if (consumed.has(i)) continue
      const a = sortedActual[i]
      const delta = Math.abs(a.atMs - exp.expectedAtMs)
      if (delta > toleranceMs) continue
      if (a.voiceId === exp.voiceId) {
        if (delta < bestExactDelta) {
          bestExact = i
          bestExactDelta = delta
        }
      } else if (delta < bestWrongDelta) {
        bestWrong = i
        bestWrongDelta = delta
      }
    }
    if (bestExact >= 0) {
      consumed.add(bestExact)
      hits.push({ expected: exp, actual: sortedActual[bestExact], grade: 'correct' })
    } else if (bestWrong >= 0) {
      consumed.add(bestWrong)
      hits.push({ expected: exp, actual: sortedActual[bestWrong], grade: 'wrong-voice' })
    } else {
      hits.push({ expected: exp, actual: null, grade: 'missed' })
    }
  }

  const extras = sortedActual.filter((_, i) => !consumed.has(i))
  return { hits, extras }
}

export interface GradeSummary {
  correct: number
  wrongVoice: number
  missed: number
  extras: number
  total: number
  score: number
}

export function summarize(report: GradeReport): GradeSummary {
  let correct = 0
  let wrongVoice = 0
  let missed = 0
  for (const h of report.hits) {
    if (h.grade === 'correct') correct++
    else if (h.grade === 'wrong-voice') wrongVoice++
    else missed++
  }
  const total = report.hits.length
  const score = total === 0 ? 0 : Math.round((correct / total) * 100)
  return { correct, wrongVoice, missed, extras: report.extras.length, total, score }
}
