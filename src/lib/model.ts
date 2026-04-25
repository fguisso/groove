import { VOICE_BY_ID, VOICE_IDS, type VoiceId } from './voices'

export type HatValue = 0 | 1 | 2 | 3 | 4
export type NoteValue = 0 | 1 | 2 | 3
export type Sticking = '-' | 'R' | 'L' | 'B'

export const HAT_STATES: HatValue[] = [0, 1, 2, 3, 4]
export const NOTE_STATES: NoteValue[] = [0, 1, 2, 3]
export const STICK_STATES: Sticking[] = ['-', 'R', 'L', 'B']

export type Division = 4 | 6 | 8 | 12 | 16 | 24 | 32
export const DIVISIONS: Division[] = [4, 6, 8, 12, 16, 24, 32]

// Voice cells keyed by voice id. hh, sn, kk are always pre-allocated for the
// editor; toms/ride are populated on demand.
export type DefaultVoiceId = 'hh' | 'sn' | 'kk'
export type Voices = Record<DefaultVoiceId, number[]> & Partial<Record<VoiceId, number[]>>

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
  voices: Voices
  sticking: Sticking[]
}

export function stepCount(g: Pick<Groove, 'division' | 'measures'>): number {
  return g.division * g.measures
}

const DEFAULT_VOICES: VoiceId[] = ['hh', 'sn', 'kk']

export function emptyGroove(overrides: Partial<Groove> = {}): Groove {
  const division: Division = overrides.division ?? 16
  const measures = overrides.measures ?? 1
  const n = division * measures
  const voices: Partial<Record<VoiceId, number[]>> = {}
  for (const id of DEFAULT_VOICES) {
    voices[id] = overrides.voices?.[id] ?? new Array(n).fill(0)
  }
  for (const id of VOICE_IDS) {
    if (DEFAULT_VOICES.includes(id)) continue
    if (overrides.voices?.[id]) voices[id] = overrides.voices[id]
  }
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
    voices: voices as Voices,
    sticking: overrides.sticking ?? new Array(n).fill('-'),
  }
}

export interface PartialGroove extends Omit<Groove, 'voices'> {
  voices: Partial<Record<VoiceId, number[]>>
}

export function resizeArrays(g: Groove | PartialGroove): Groove {
  const n = stepCount(g)
  const voices: Partial<Record<VoiceId, number[]>> = {}
  for (const id of VOICE_IDS) {
    const arr = g.voices[id]
    if (!arr) continue
    if (arr.length === n) voices[id] = arr
    else if (arr.length < n) voices[id] = [...arr, ...new Array(n - arr.length).fill(0)]
    else voices[id] = arr.slice(0, n)
  }
  for (const id of DEFAULT_VOICES) {
    if (!voices[id]) voices[id] = new Array(n).fill(0)
  }
  const sticking =
    g.sticking.length === n
      ? g.sticking
      : g.sticking.length < n
        ? [...g.sticking, ...new Array(n - g.sticking.length).fill('-' as Sticking)]
        : g.sticking.slice(0, n)
  return { ...g, voices: voices as Voices, sticking }
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

export function cycleVoiceCell(voiceId: VoiceId, current: number): number {
  const v = VOICE_BY_ID[voiceId]
  return (current + 1) % v.states.length
}
