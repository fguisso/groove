import { describe, expect, it } from 'vitest'
import { followOffset, scoreLayout } from '@/lib/score-layout'

describe('score layouts', () => {
  it('wraps a long song without narrowing its measures', () => {
    const layout = scoreLayout(672, 13, 16)
    expect(layout.perRow).toBe(2)
    expect(layout.height).toBe(860)
    expect(layout.totalWidth).toBe(672)
    expect(layout.measureWidth).toBeGreaterThanOrEqual(256)
  })

  it('keeps follow notation the same size as the song grows', () => {
    const short = scoreLayout(1000, 2, 16, true)
    const long = scoreLayout(1000, 13, 16, true)
    expect(long.measureWidth).toBe(short.measureWidth)
    expect(long.measureWidth * 1.5).toBe(960)
    expect(long.totalWidth).toBeGreaterThan(8000)
    expect(long.height).toBe(short.height)
  })

  it.each([16, 24, 32])(
    'preserves dense notation on a narrow screen at division %i',
    (division) => {
      const layout = scoreLayout(300, 8, division, true)
      expect(layout.measureWidth).toBeGreaterThanOrEqual(division * 16)
      expect(layout.totalWidth).toBeGreaterThan(300)
    },
  )

  it('allows a single dense wrapped bar to overflow rather than shrink', () => {
    const layout = scoreLayout(300, 1, 32)
    expect(layout.perRow).toBe(1)
    expect(layout.measureWidth).toBe(512)
  })
})

describe('following the current note', () => {
  it('centers the current position and moves back for repeated bars', () => {
    expect(followOffset(1800, 600)).toBe(-1500)
    expect(followOffset(1400, 600)).toBe(-1100)
  })

  it.each([40, 1800, 4980])('keeps position %i centered, including track edges', (center) => {
    expect(center + followOffset(center, 600)).toBe(300)
  })
})
