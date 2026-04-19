import { describe, expect, it } from 'vitest'
import { decode, encode } from '../src/lib/codec'
import { emptyGroove, resizeArrays, type HatValue, type NoteValue } from '../src/lib/model'

function random<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)]
}

describe('codec', () => {
  it('round-trips an empty groove', () => {
    const g = emptyGroove()
    const decoded = decode(encode(g))
    expect(decoded).toEqual(g)
  })

  it('encodes the default empty groove to a very short URL', () => {
    const g = emptyGroove()
    const p = encode(g)
    expect(p.length).toBeLessThan(20)
  })

  it('round-trips 50 random grooves with title/author', () => {
    for (let iter = 0; iter < 50; iter++) {
      const g = resizeArrays(
        emptyGroove({
          tempo: 60 + Math.floor(Math.random() * 180),
          swing: Math.floor(Math.random() * 80),
          division: random([8, 12, 16, 24] as const),
          measures: 1 + Math.floor(Math.random() * 4),
          title: 'G' + iter,
          author: iter % 2 ? 'me' : '',
        })
      )
      for (let i = 0; i < g.voices.hh.length; i++) {
        g.voices.hh[i] = Math.floor(Math.random() * 5) as HatValue
        g.voices.sn[i] = Math.floor(Math.random() * 4) as NoteValue
        g.voices.kk[i] = Math.floor(Math.random() * 4) as NoteValue
        g.sticking[i] = random(['-', 'R', 'L', 'B'] as const)
      }
      const decoded = decode(encode(g))
      expect(decoded).toEqual(g)
    }
  })

  it('keeps typical 16-step grooves under 50 url chars', () => {
    const g = emptyGroove()
    for (let i = 0; i < 16; i++) g.voices.hh[i] = 1 as HatValue
    g.voices.sn[4] = 1
    g.voices.sn[12] = 1
    g.voices.kk[0] = 1
    g.voices.kk[8] = 1
    const p = encode(g)
    expect(p.length).toBeLessThan(50)
  })

  it('returns null for garbage', () => {
    expect(decode('!!!not-valid!!!')).toBeNull()
    expect(decode('')).toBeNull()
  })
})
