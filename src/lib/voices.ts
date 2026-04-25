// Voice registry. Single source of truth for what drums exist, how they
// encode in the wire format, what MIDI notes they emit, what synth makes
// their sound, and how they render on the staff.
//
// Adding a voice is editing this file plus, if its sound is genuinely new,
// adding the synth in `usePlayback.ts`. Everything else (codec, score,
// MIDI export) reads from here.

export type VoiceId = 'hh' | 'sn' | 'kk' | 't1' | 't2' | 't3' | 'ride'
export type VoiceKind = 'hat' | 'note'

export interface VoiceState {
  // index 0 in `Voice.states` is "off" — empty object.
  // Active states declare:
  midi?: number // GM drum note number for MIDI export and (later) input
  velocity?: number // 0..1 velocity for both audio and MIDI
  symbol?: string // text symbol for the editor cell
  vexKey?: string // overrides the voice's default VexFlow key
  articulation?: string // VexFlow articulation type, e.g. 'a>' for accent
  annotation?: string // VexFlow annotation text, e.g. 'o' for open hat
  synthKey?: string // overrides the voice's default synth key
}

export interface Voice {
  id: VoiceId
  label: string
  kind: VoiceKind
  bitsPerCell: number
  vexKey: string // default VexFlow key when state has no override
  defaultSynthKey: string // default synth key in usePlayback's synth bank
  states: readonly VoiceState[]
}

export const VOICES: readonly Voice[] = [
  {
    id: 'hh',
    label: 'HI-HAT',
    kind: 'hat',
    bitsPerCell: 3,
    vexKey: 'g/5/x2',
    defaultSynthKey: 'hh',
    states: [
      {},
      { midi: 42, velocity: 0.8, symbol: 'x' },
      { midi: 46, velocity: 0.9, symbol: 'o', annotation: 'o', synthKey: 'hho' },
      { midi: 42, velocity: 1, symbol: 'X', articulation: 'a>' },
      { midi: 44, velocity: 0.9, symbol: 'f', vexKey: 'f/4/x2', synthKey: 'hhp' },
    ],
  },
  {
    id: 'sn',
    label: 'SNARE',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'c/5',
    defaultSynthKey: 'sn',
    states: [
      {},
      { midi: 38, velocity: 0.85, symbol: '●' },
      { midi: 38, velocity: 1, symbol: '◆', articulation: 'a>' },
      { midi: 38, velocity: 0.35, symbol: '○', annotation: '(·)' },
    ],
  },
  {
    id: 'kk',
    label: 'KICK',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'f/4',
    defaultSynthKey: 'kk',
    states: [
      {},
      { midi: 36, velocity: 0.9, symbol: '●' },
      { midi: 36, velocity: 1, symbol: '◆', articulation: 'a>' },
      { midi: 36, velocity: 0.55, symbol: '○' },
    ],
  },
  {
    id: 't1',
    label: 'TOM 1',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'e/5',
    defaultSynthKey: 't1',
    states: [
      {},
      { midi: 50, velocity: 0.85, symbol: '●' },
      { midi: 50, velocity: 1, symbol: '◆', articulation: 'a>' },
      { midi: 50, velocity: 0.45, symbol: '○' },
    ],
  },
  {
    id: 't2',
    label: 'TOM 2',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'd/5',
    defaultSynthKey: 't2',
    states: [
      {},
      { midi: 47, velocity: 0.85, symbol: '●' },
      { midi: 47, velocity: 1, symbol: '◆', articulation: 'a>' },
      { midi: 47, velocity: 0.45, symbol: '○' },
    ],
  },
  {
    id: 't3',
    label: 'FLOOR TOM',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'a/4',
    defaultSynthKey: 't3',
    states: [
      {},
      { midi: 41, velocity: 0.85, symbol: '●' },
      { midi: 41, velocity: 1, symbol: '◆', articulation: 'a>' },
      { midi: 41, velocity: 0.45, symbol: '○' },
    ],
  },
  {
    id: 'ride',
    label: 'RIDE',
    kind: 'note',
    bitsPerCell: 2,
    vexKey: 'f/5/x2',
    defaultSynthKey: 'ride',
    states: [
      {},
      { midi: 51, velocity: 0.8, symbol: 'x' },
      { midi: 51, velocity: 1, symbol: 'X', articulation: 'a>' },
      { midi: 51, velocity: 0.5, symbol: 'x' },
    ],
  },
]

export const VOICE_IDS: readonly VoiceId[] = VOICES.map((v) => v.id)

export const VOICE_BY_ID: Record<VoiceId, Voice> = Object.fromEntries(
  VOICES.map((v) => [v.id, v]),
) as Record<VoiceId, Voice>

export function nextState(voiceId: VoiceId, current: number): number {
  const v = VOICE_BY_ID[voiceId]
  return (current + 1) % v.states.length
}

export function effectiveSynthKey(voiceId: VoiceId, state: number): string | null {
  const v = VOICE_BY_ID[voiceId]
  const s = v.states[state]
  if (!s) return null
  return s.synthKey ?? v.defaultSynthKey
}
