export type HatValue = 0 | 1 | 2 | 3 | 4
export type NoteValue = 0 | 1 | 2 | 3
export type Sticking = '-' | 'R' | 'L' | 'B'

export const HAT_STATES: HatValue[] = [0, 1, 2, 3, 4]
export const NOTE_STATES: NoteValue[] = [0, 1, 2, 3]
export const STICK_STATES: Sticking[] = ['-', 'R', 'L', 'B']

export const HAT_LABEL: Record<HatValue, string> = {
  0: '·',
  1: 'x',
  2: 'o',
  3: 'X',
  4: 'f',
}
export const NOTE_LABEL: Record<NoteValue, string> = {
  0: '·',
  1: '●',
  2: '◆',
  3: '○',
}

export type Division = 4 | 6 | 8 | 12 | 16 | 24 | 32
export const DIVISIONS: Division[] = [4, 6, 8, 12, 16, 24, 32]

export interface Groove {
  v: 1
  title?: string
  author?: string
  timeSig: [number, number]
  division: Division
  measures: number
  tempo: number
  swing: number
  metronome: boolean
  countIn: boolean
  loop: boolean
  voices: {
    hh: HatValue[]
    sn: NoteValue[]
    kk: NoteValue[]
    t1?: NoteValue[]
    t4?: NoteValue[]
    cy?: NoteValue[]
  }
  sticking: Sticking[]
}

export function stepCount(g: Pick<Groove, 'division' | 'measures'>): number {
  return g.division * g.measures
}

export function emptyGroove(overrides: Partial<Groove> = {}): Groove {
  const division: Division = overrides.division ?? 16
  const measures = overrides.measures ?? 1
  const n = division * measures
  return {
    v: 1,
    title: overrides.title ?? '',
    author: overrides.author ?? '',
    timeSig: overrides.timeSig ?? [4, 4],
    division,
    measures,
    tempo: overrides.tempo ?? 90,
    swing: overrides.swing ?? 0,
    metronome: overrides.metronome ?? false,
    countIn: overrides.countIn ?? false,
    loop: overrides.loop ?? true,
    voices: {
      hh: overrides.voices?.hh ?? new Array(n).fill(0),
      sn: overrides.voices?.sn ?? new Array(n).fill(0),
      kk: overrides.voices?.kk ?? new Array(n).fill(0),
      t1: overrides.voices?.t1,
      t4: overrides.voices?.t4,
      cy: overrides.voices?.cy,
    },
    sticking: overrides.sticking ?? new Array(n).fill('-'),
  }
}

export function resizeArrays(g: Groove): Groove {
  const n = stepCount(g)
  const fit = <T>(arr: T[] | undefined, fill: T): T[] | undefined => {
    if (!arr) return undefined
    if (arr.length === n) return arr
    if (arr.length < n) return [...arr, ...new Array(n - arr.length).fill(fill)]
    return arr.slice(0, n)
  }
  const requireFit = <T>(arr: T[], fill: T): T[] => fit(arr, fill) as T[]
  return {
    ...g,
    voices: {
      hh: requireFit(g.voices.hh, 0 as HatValue),
      sn: requireFit(g.voices.sn, 0 as NoteValue),
      kk: requireFit(g.voices.kk, 0 as NoteValue),
      t1: fit(g.voices.t1, 0 as NoteValue),
      t4: fit(g.voices.t4, 0 as NoteValue),
      cy: fit(g.voices.cy, 0 as NoteValue),
    },
    sticking: requireFit(g.sticking, '-' as Sticking),
  }
}

export function cycleHat(v: HatValue): HatValue {
  return ((v + 1) % 5) as HatValue
}
export function cycleNote(v: NoteValue): NoteValue {
  return ((v + 1) % 4) as NoteValue
}
export function cycleSticking(v: Sticking): Sticking {
  const i = STICK_STATES.indexOf(v)
  return STICK_STATES[(i + 1) % STICK_STATES.length]
}
