import { describe, expect, it } from 'vitest'
import { audibleTimeAt } from '@/lib/midi-clock'
import { MidiPractice, type PracticeSlot } from '@/lib/midi-practice'
import { emptyGroove } from '@/lib/model'
import { expandTimeline } from '@/lib/playback-order'
import { decode } from '@/lib/codec'
import { VOICES } from '@/lib/voices'

const stepSec = 60 / 122 / 4
function slot(
  atSec = 1,
  step = 0,
  notes: PracticeSlot['notes'] = [{ voiceId: 'hh', midi: 42 }],
): PracticeSlot {
  return { atSec, step, notes, pass: 1, cycle: 1, stepSec }
}
const hit = (atSec = 1, voiceId: 'hh' | 'sn' | 'kk' = 'hh', rawNote = 42) => ({
  atSec,
  voiceId,
  rawNote,
  atMs: atSec * 1000,
})

describe('MIDI clock alignment', () => {
  it('reproduces the old one-subdivision error at 122 BPM', () => {
    expect(Math.round(0.1 / stepSec)).toBe(1)
    const time = audibleTimeAt(1000, {
      currentTime: 4.04,
      performanceMs: 1100,
      outputTimestamp: { contextTime: 3.9, performanceTime: 1000 },
      baseLatency: 0.02,
      outputLatency: 0.02,
    })
    expect(time).toBeCloseTo(3.9)
    // No scheduler lookahead, callback delay, or double output compensation.
    expect(Math.round((time - 3.9) / stepSec)).toBe(0)
  })
  it('uses an explicit latency fallback when output timestamps are unavailable', () => {
    expect(
      audibleTimeAt(1000, {
        currentTime: 4.1,
        performanceMs: 1100,
        baseLatency: 0.01,
        outputLatency: 0.02,
      }),
    ).toBeCloseTo(3.97)
    expect(
      audibleTimeAt(1000, {
        currentTime: 4.1,
        performanceMs: 1100,
        outputTimestamp: { contextTime: 0, performanceTime: 0 },
      }),
    ).toBeCloseTo(4)
  })
})

describe('practice association and feedback', () => {
  it('uses the entire configured tolerance for green and keeps timing outside it distinct', () => {
    for (const [delta, grade] of [
      [0.039, 'perfect'],
      [0.0404, 'late'],
      [-0.07, 'early'],
      [0.07, 'late'],
    ] as const) {
      const p = new MidiPractice(40)
      p.addSlot(slot())
      p.addSlot(slot(1 + stepSec, 1, []))
      p.addHit(hit(1 + delta))
      const results = p.advance(2)
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ grade, step: 0, deltaMs: Math.round(delta * 1000) })
    }
  })
  it('applies a residual offset before associating the note, not after selecting a step', () => {
    const p = new MidiPractice(40)
    p.addSlot(slot())
    p.addSlot(slot(1 + stepSec, 1, []))
    const rawSec = 1.1
    p.addHit(hit(rawSec - 0.1))
    expect(p.advance(2)[0]).toMatchObject({ grade: 'perfect', step: 0, deltaMs: 0 })
  })
  it('counts chords separately and consumes each expected note and hit only once', () => {
    const p = new MidiPractice(40)
    p.addSlot(
      slot(1, 0, [
        { voiceId: 'hh', midi: 42 },
        { voiceId: 'kk', midi: 36 },
      ]),
    )
    p.addHit(hit())
    p.addHit(hit(1, 'kk', 36))
    p.addHit(hit(1.005))
    expect(
      p
        .advance(2)
        .map((r) => r.grade)
        .sort(),
    ).toEqual(['extra', 'perfect', 'perfect'])
    expect(p.advance(3)).toEqual([])
  })
  it('prefers the same drum over replacing another simultaneous voice', () => {
    const p = new MidiPractice(40)
    p.addSlot(
      slot(1, 0, [
        { voiceId: 'kk', midi: 36 },
        { voiceId: 'hh', midi: 42 },
      ]),
    )
    p.addHit(hit(1.01))
    expect(
      p
        .advance(2)
        .map((r) => r.grade)
        .sort(),
    ).toEqual(['missed', 'perfect'])
  })
  it('distinguishes wrong drum, omission, extra, and hi-hat articulation', () => {
    const p = new MidiPractice(40)
    p.addSlot(slot())
    p.addSlot(slot(2, 8))
    p.addSlot(slot(3, 16, []))
    p.addSlot(slot(4, 24, [{ voiceId: 'hh', midi: 46 }]))
    p.addHit(hit(1, 'sn', 38))
    p.addHit(hit(3))
    p.addHit(hit(4, 'hh', 44))
    const results = p.advance(5)
    expect(results.map((r) => r.grade).sort()).toEqual([
      'extra',
      'missed',
      'wrong-articulation',
      'wrong-voice',
    ])
    expect(results.find((r) => r.grade === 'wrong-articulation')).toMatchObject({
      expectedMidi: 46,
      rawNote: 44,
    })
  })
  it('buffers an early MIDI event that arrives before the scheduler callback', () => {
    const p = new MidiPractice(40)
    p.addHit(hit(0.9))
    expect(p.advance(0.92)).toEqual([])
    p.addSlot(slot())
    expect(p.advance(2)[0]).toMatchObject({ grade: 'early', deltaMs: -100 })
  })
  it('does not declare a miss before queued MIDI has time to arrive', () => {
    const p = new MidiPractice(40)
    p.addSlot(slot())
    expect(p.advance(1.15)).toEqual([])
    p.addHit(hit(1.02))
    expect(p.advance(1.3)[0]?.grade).toBe('perfect')
  })
  it('ignores count-in and review hits without grading a stale step', () => {
    const p = new MidiPractice(40)
    p.addSlot(slot(2))
    p.addHit(hit(1))
    p.addHit(hit(3))
    expect(p.advance(4).map((r) => r.grade)).toEqual(['missed'])
  })
  it('does not grade notes scheduled ahead of a manual Stop', () => {
    const p = new MidiPractice(40)
    p.addSlot(slot(1))
    p.addSlot(slot(1.1, 1))
    p.finishAt(1.05)
    p.addHit(hit(1.01))
    p.addHit(hit(1.2))
    expect(p.advance(2).map((r) => r.grade)).toEqual(['perfect'])
  })
  it('uses each scheduled audio time across tempo changes, swing and loop boundaries', () => {
    const p = new MidiPractice(40)
    for (const [i, time] of [1, 1.17, 1.26, 1.4, 5, 5.1].entries()) {
      p.addSlot({ ...slot(time, i % 4), cycle: i >= 4 ? 2 : 1 })
      p.addHit(hit(time))
    }
    const results = p.advance(6)
    expect(results).toHaveLength(6)
    expect(results.every((r) => r.grade === 'perfect' && r.deltaMs === 0)).toBe(true)
    expect(results.filter((r) => r.cycle === 2)).toHaveLength(2)
  })
  it('keeps all 25 played measures distinct in the 11-block study with no drift', () => {
    const g = emptyGroove({
      tempo: 122,
      division: 16,
      measures: 11,
      repeats: [1, 1, 5, 1, 1, 1, 4, 1, 1, 8, 1],
    })
    const slots = expandTimeline(g)
    expect(slots).toHaveLength(400)
    const p = new MidiPractice(40)
    let count = 0
    const passes = new Set<number>()
    for (const [i, s] of slots.entries()) {
      const time = 2 + i * stepSec
      p.addSlot({ ...slot(time, s.step), pass: s.pass })
      p.addHit(hit(time))
      for (const r of p.advance(time)) {
        count++
        passes.add(r.pass)
        expect(r.grade).toBe('perfect')
      }
    }
    count += p.advance(60).length
    expect(count).toBe(400)
    expect(passes.has(8)).toBe(true)
  })
})

it('reproduces false red markers with the saved study and grades its exact notes correctly after alignment', () => {
  const g = decode(
    'BHoAAEQLhEcggggggggggggggggggggggggggggggAAggggggggggggggggggggggghBBBBBBBBBBBBBBAAAAAAAAAAAAAAAAAAAQABAAEAAQABAAEAAQABFAEAAQABAAEAAQABAAEAAQARAQEUAQABABEBARUAEAABABEAAQAQAAEAEAABABAAAQARAAEAEAABAAEAAQAQEAEAEQABABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAREREREREREAAQAAwBwAbU3RhbmQgQnkgTWUgLSBTZWd1bmRhIHBhcnRlDERpbm8gRm9uc2VjYQ',
  )!
  const slots = expandTimeline(g)
  const p = new MidiPractice(40)
  let total = 0
  let oldRed = 0
  const results = []
  for (const [i, s] of slots.entries()) {
    const atSec = 2 + i * stepSec
    const notes = VOICES.flatMap((v) => {
      const state = g.voices[v.id]?.[s.step] ?? 0
      const midi = v.states[state]?.midi
      return state && midi != null ? [{ voiceId: v.id, midi }] : []
    })
    p.addSlot({ ...slot(atSec, s.step, notes), pass: s.pass })
    for (const note of notes) {
      total++
      const wrongSlot = slots[Math.round((i * stepSec + 0.1) / stepSec)]
      if (wrongSlot && !VOICES.some((v) => g.voices[v.id]?.[wrongSlot.step])) oldRed++
      p.addHit({ voiceId: note.voiceId, rawNote: note.midi, atSec, atMs: atSec * 1000 })
    }
    results.push(...p.advance(atSec))
  }
  results.push(...p.advance(60))
  expect(g.tempo).toBe(122)
  expect(slots).toHaveLength(400)
  expect(oldRed / total).toBeGreaterThan(0.7)
  expect(results).toHaveLength(total)
  expect(results.every((r) => r.grade === 'perfect' && r.deltaMs === 0)).toBe(true)
  console.log(
    JSON.stringify({
      savedStudyExpectedNotes: total,
      falseRedWithOldLookahead: oldRed,
      correctedExactHits: results.length,
    }),
  )
})
