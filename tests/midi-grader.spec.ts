import { describe, expect, it } from 'vitest'
import {
  buildSchedule,
  gradeHits,
  stepDurationMs,
  summarize,
  type ActualHit,
} from '../src/lib/midi-grader'
import { emptyGroove } from '../src/lib/model'

describe('midi grader', () => {
  it('builds a schedule from a groove with hits at expected step times', () => {
    const g = emptyGroove({ tempo: 120, division: 16 })
    g.voices.hh[0] = 1
    g.voices.hh[4] = 1
    g.voices.kk[0] = 1
    g.voices.sn[4] = 1
    const stepMs = stepDurationMs(g) // 16ths at 120bpm = 125ms
    expect(stepMs).toBeCloseTo(125, 5)

    const schedule = buildSchedule(g, 1000)
    expect(schedule).toHaveLength(4)
    // Order is voice-major within each step (hh, sn, kk by registry order)
    expect(schedule[0]).toEqual({ step: 0, voiceId: 'hh', expectedAtMs: 1000 })
    expect(schedule[1]).toEqual({ step: 0, voiceId: 'kk', expectedAtMs: 1000 })
    expect(schedule[2]).toEqual({ step: 4, voiceId: 'hh', expectedAtMs: 1000 + 4 * 125 })
    expect(schedule[3]).toEqual({ step: 4, voiceId: 'sn', expectedAtMs: 1000 + 4 * 125 })
  })

  it('grades exact hits as correct', () => {
    const expected = [
      { step: 0, voiceId: 'hh' as const, expectedAtMs: 1000 },
      { step: 0, voiceId: 'kk' as const, expectedAtMs: 1000 },
    ]
    const actual: ActualHit[] = [
      { voiceId: 'hh', atMs: 1000 },
      { voiceId: 'kk', atMs: 1000 },
    ]
    const report = gradeHits(expected, actual, 30)
    expect(report.hits.every((h) => h.grade === 'correct')).toBe(true)
    expect(report.extras).toEqual([])
  })

  it('grades hits within tolerance as correct', () => {
    const expected = [{ step: 0, voiceId: 'hh' as const, expectedAtMs: 1000 }]
    const report = gradeHits(expected, [{ voiceId: 'hh', atMs: 1025 }], 30)
    expect(report.hits[0].grade).toBe('correct')
  })

  it('grades hits outside tolerance as missed', () => {
    const expected = [{ step: 0, voiceId: 'hh' as const, expectedAtMs: 1000 }]
    const report = gradeHits(expected, [{ voiceId: 'hh', atMs: 1100 }], 30)
    expect(report.hits[0].grade).toBe('missed')
    expect(report.extras).toHaveLength(1)
  })

  it('grades within-tolerance wrong-voice hits', () => {
    const expected = [{ step: 0, voiceId: 'hh' as const, expectedAtMs: 1000 }]
    const report = gradeHits(expected, [{ voiceId: 'sn', atMs: 1010 }], 30)
    expect(report.hits[0].grade).toBe('wrong-voice')
    expect(report.hits[0].actual).not.toBeNull()
    expect(report.extras).toEqual([])
  })

  it('counts unconsumed actual hits as extras', () => {
    const expected = [{ step: 0, voiceId: 'hh' as const, expectedAtMs: 1000 }]
    const actual: ActualHit[] = [
      { voiceId: 'hh', atMs: 1000 },
      { voiceId: 'sn', atMs: 1500 },
    ]
    const report = gradeHits(expected, actual, 30)
    expect(report.hits[0].grade).toBe('correct')
    expect(report.extras).toHaveLength(1)
    expect(report.extras[0].voiceId).toBe('sn')
  })

  it('prefers same-voice over wrong-voice when both within tolerance', () => {
    const expected = [{ step: 0, voiceId: 'hh' as const, expectedAtMs: 1000 }]
    const actual: ActualHit[] = [
      { voiceId: 'sn', atMs: 1000 }, // exact, but wrong voice
      { voiceId: 'hh', atMs: 1010 }, // 10ms late, right voice
    ]
    const report = gradeHits(expected, actual, 30)
    expect(report.hits[0].grade).toBe('correct')
    expect(report.hits[0].actual?.voiceId).toBe('hh')
    expect(report.extras).toHaveLength(1)
  })

  it('summarize reports score percentage', () => {
    const report = {
      hits: [
        {
          expected: { step: 0, voiceId: 'hh' as const, expectedAtMs: 0 },
          actual: { voiceId: 'hh' as const, atMs: 0 },
          grade: 'correct' as const,
        },
        {
          expected: { step: 1, voiceId: 'hh' as const, expectedAtMs: 100 },
          actual: { voiceId: 'hh' as const, atMs: 100 },
          grade: 'correct' as const,
        },
        {
          expected: { step: 2, voiceId: 'hh' as const, expectedAtMs: 200 },
          actual: null,
          grade: 'missed' as const,
        },
        {
          expected: { step: 3, voiceId: 'hh' as const, expectedAtMs: 300 },
          actual: { voiceId: 'sn' as const, atMs: 300 },
          grade: 'wrong-voice' as const,
        },
      ],
      extras: [{ voiceId: 'kk' as const, atMs: 500 }],
    }
    const s = summarize(report)
    expect(s).toEqual({
      correct: 2,
      wrongVoice: 1,
      missed: 1,
      extras: 1,
      total: 4,
      score: 50,
    })
  })
})
