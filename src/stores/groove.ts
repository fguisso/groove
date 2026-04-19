import { defineStore } from 'pinia'
import {
  cycleHat,
  cycleNote,
  cycleSticking,
  emptyGroove,
  resizeArrays,
  type Division,
  type Groove,
  type HatValue,
  type NoteValue,
  type Sticking,
} from '@/lib/model'

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
    cycleCell(voice: 'hh' | 'sn' | 'kk' | 't1' | 't4' | 'cy', i: number) {
      const v = this.groove.voices
      if (voice === 'hh') {
        v.hh[i] = cycleHat(v.hh[i])
      } else {
        const arr = v[voice]
        if (!arr) return
        arr[i] = cycleNote(arr[i] as NoteValue)
      }
    },
    setCell(voice: 'hh' | 'sn' | 'kk' | 't1' | 't4' | 'cy', i: number, val: HatValue | NoteValue) {
      const v = this.groove.voices
      if (voice === 'hh') v.hh[i] = val as HatValue
      else {
        const arr = v[voice]
        if (arr) arr[i] = val as NoteValue
      }
    },
    cycleSticking(i: number) {
      this.groove.sticking[i] = cycleSticking(this.groove.sticking[i])
    },
    setSticking(i: number, val: Sticking) {
      this.groove.sticking[i] = val
    },
    clearAll() {
      const n = this.groove.voices.hh.length
      this.groove.voices.hh = new Array(n).fill(0)
      this.groove.voices.sn = new Array(n).fill(0)
      this.groove.voices.kk = new Array(n).fill(0)
      if (this.groove.voices.t1) this.groove.voices.t1 = new Array(n).fill(0)
      if (this.groove.voices.t4) this.groove.voices.t4 = new Array(n).fill(0)
      if (this.groove.voices.cy) this.groove.voices.cy = new Array(n).fill(0)
      this.groove.sticking = new Array(n).fill('-')
    },
  },
})
