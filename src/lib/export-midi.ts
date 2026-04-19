import { Midi } from '@tonejs/midi'
import type { Groove } from './model'

// General MIDI drum notes (channel 10)
const GM = {
  kick: 36,
  snare: 38,
  ghost: 38,
  hhClosed: 42,
  hhOpen: 46,
  hhPedal: 44,
  crash: 49,
  ride: 51,
} as const

function stepDurationSec(g: Groove): number {
  const beatsPerSec = g.tempo / 60
  const stepsPerBeat = g.division / g.timeSig[0]
  return 1 / (beatsPerSec * stepsPerBeat)
}

export async function exportMidi(g: Groove) {
  const midi = new Midi()
  midi.header.setTempo(g.tempo)
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: g.timeSig })
  const track = midi.addTrack()
  track.channel = 9 // GM drum channel (0-indexed)
  track.name = g.title || 'Groove'

  const step = stepDurationSec(g)
  const total = g.voices.hh.length

  for (let i = 0; i < total; i++) {
    const t = step * i
    const dur = step * 0.9

    const hh = g.voices.hh[i]
    if (hh === 1) track.addNote({ midi: GM.hhClosed, time: t, duration: dur, velocity: 0.7 })
    else if (hh === 2) track.addNote({ midi: GM.hhOpen, time: t, duration: dur, velocity: 0.8 })
    else if (hh === 3) track.addNote({ midi: GM.hhClosed, time: t, duration: dur, velocity: 1 })
    else if (hh === 4) track.addNote({ midi: GM.hhPedal, time: t, duration: dur, velocity: 0.7 })

    const sn = g.voices.sn[i]
    if (sn === 1) track.addNote({ midi: GM.snare, time: t, duration: dur, velocity: 0.8 })
    else if (sn === 2) track.addNote({ midi: GM.snare, time: t, duration: dur, velocity: 1 })
    else if (sn === 3) track.addNote({ midi: GM.ghost, time: t, duration: dur, velocity: 0.35 })

    const kk = g.voices.kk[i]
    if (kk === 1) track.addNote({ midi: GM.kick, time: t, duration: dur, velocity: 0.9 })
    else if (kk === 2) track.addNote({ midi: GM.kick, time: t, duration: dur, velocity: 1 })
    else if (kk === 3) track.addNote({ midi: GM.kick, time: t, duration: dur, velocity: 0.5 })
  }

  const blob = new Blob([midi.toArray()], { type: 'audio/midi' })
  download(blob, `${(g.title || 'groove').replace(/\s+/g, '_')}.mid`)
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
