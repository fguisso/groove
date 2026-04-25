import { defineStore } from 'pinia'
import {
  cycleSticking,
  cycleVoiceCell,
  emptyGroove,
  resizeArrays,
  type Division,
  type Groove,
  type Sticking,
} from '@/lib/model'
import { VOICES, type VoiceId } from '@/lib/voices'

export const useGrooveStore = defineStore('groove', {
  state: (): { groove: Groove } => ({ groove: emptyGroove() }),
  actions: {
    replace(g: Groove) {
      this.groove = resizeArrays(g)
    },
    reset() {
      this.groove = emptyGroove()
    },
    setTitle(t: string) {
      this.groove.title = t
    },
    setAuthor(a: string) {
      this.groove.author = a
    },
    setTempo(bpm: number) {
      this.groove.tempo = Math.max(30, Math.min(300, Math.round(bpm)))
    },
    setSwing(pct: number) {
      this.groove.swing = Math.max(0, Math.min(100, Math.round(pct)))
    },
    setDivision(d: Division) {
      this.groove.division = d
      this.groove = resizeArrays(this.groove)
    },
    setMeasures(m: number) {
      this.groove.measures = Math.max(1, Math.min(8, Math.round(m)))
      this.groove = resizeArrays(this.groove)
    },
    toggleMetronome() {
      this.groove.metronome = !this.groove.metronome
    },
    toggleCountIn() {
      this.groove.countIn = !this.groove.countIn
    },
    toggleLoop() {
      this.groove.loop = !this.groove.loop
    },
    cycleCell(voice: VoiceId, i: number) {
      const arr = this.groove.voices[voice]
      if (!arr) return
      arr[i] = cycleVoiceCell(voice, arr[i])
    },
    setCell(voice: VoiceId, i: number, val: number) {
      const arr = this.groove.voices[voice]
      if (arr) arr[i] = val
    },
    cycleSticking(i: number) {
      this.groove.sticking[i] = cycleSticking(this.groove.sticking[i])
    },
    setSticking(i: number, val: Sticking) {
      this.groove.sticking[i] = val
    },
    clearAll() {
      const n = this.groove.voices.hh?.length ?? this.groove.division * this.groove.measures
      for (const v of VOICES) {
        const arr = this.groove.voices[v.id]
        if (arr) this.groove.voices[v.id] = new Array(n).fill(0)
      }
      this.groove.sticking = new Array(n).fill('-')
    },
  },
})
