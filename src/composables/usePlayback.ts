import { ref, shallowRef, watch } from 'vue'
import * as Tone from 'tone'
import type { Groove } from '@/lib/model'
import { VOICES, effectiveSynthKey } from '@/lib/voices'

type SynthKey = 'kk' | 'sn' | 'hh' | 'hho' | 'hhp' | 't1' | 't3' | 'ride' | 'click'
type Trigger = (time: number, velocity?: number) => void

/**
 * Synthesized drum voices. All sounds generated from WebAudio primitives — no sample loading.
 *
 * Design notes:
 *   kick:  MembraneSynth with tight pitch sweep → C2, 3 octaves (~260Hz → 65Hz thud)
 *   snare: white noise through bandpass (~2kHz, body) + short low tone (~200Hz, punch)
 *   hh closed: white noise → highpass 7kHz, ~35ms envelope (crisp tick)
 *   hh open:   white noise → highpass 5.5kHz, ~400ms envelope (sustained)
 *   hh pedal:  white noise → bandpass 4.5kHz, ~50ms envelope (muted chick)
 *   tom1 / t3: MembraneSynth tuned for high tom and floor tom
 *   ride:      filtered noise + tonal partial around 5kHz
 *   click:     square wave, C6 on downbeat / G5 on other beats
 */
function makeSynth(kind: SynthKey): Trigger {
  if (kind === 'kk') {
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.6 },
    }).toDestination()
    synth.volume.value = -6
    return (time, v = 1) => synth.triggerAttackRelease('C2', '8n', time, v)
  }

  if (kind === 'sn') {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 },
    })
    const noiseBp = new Tone.Filter({ type: 'bandpass', frequency: 2200, Q: 0.9 })
    noise.chain(noiseBp, Tone.getDestination())
    noise.volume.value = -9
    const body = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
    }).toDestination()
    body.volume.value = -16
    return (time, v = 1) => {
      noise.triggerAttackRelease('16n', time, v)
      body.triggerAttackRelease('A2', '16n', time, v * 0.7)
    }
  }

  if (kind === 'hh') {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    })
    const hp = new Tone.Filter({ type: 'highpass', frequency: 7000, Q: 0.7 })
    noise.chain(hp, Tone.getDestination())
    noise.volume.value = -17
    return (time, v = 1) => noise.triggerAttackRelease('32n', time, v)
  }

  if (kind === 'hho') {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.25 },
    })
    const hp = new Tone.Filter({ type: 'highpass', frequency: 5500, Q: 0.7 })
    noise.chain(hp, Tone.getDestination())
    noise.volume.value = -14
    return (time, v = 1) => noise.triggerAttackRelease('8n', time, v)
  }

  if (kind === 'hhp') {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
    })
    const bp = new Tone.Filter({ type: 'bandpass', frequency: 4500, Q: 1.6 })
    noise.chain(bp, Tone.getDestination())
    noise.volume.value = -20
    return (time, v = 1) => noise.triggerAttackRelease('32n', time, v)
  }

  if (kind === 't1') {
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 2.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.4 },
    }).toDestination()
    synth.volume.value = -8
    return (time, v = 1) => synth.triggerAttackRelease('A3', '8n', time, v)
  }

  if (kind === 't3') {
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.5 },
    }).toDestination()
    synth.volume.value = -7
    return (time, v = 1) => synth.triggerAttackRelease('E2', '8n', time, v)
  }

  if (kind === 'ride') {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.6, sustain: 0.02, release: 0.6 },
    })
    const hp = new Tone.Filter({ type: 'highpass', frequency: 4500, Q: 0.6 })
    noise.chain(hp, Tone.getDestination())
    noise.volume.value = -16
    const bell = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
    }).toDestination()
    bell.volume.value = -22
    return (time, v = 1) => {
      noise.triggerAttackRelease('4n', time, v)
      bell.triggerAttackRelease('E5', '8n', time, v * 0.5)
    }
  }

  // click (metronome)
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
  }).toDestination()
  synth.volume.value = -16
  return (time, v = 1) => {
    const note = v >= 0.9 ? 'C6' : 'G5'
    synth.triggerAttackRelease(note, '32n', time, Math.min(v, 0.85))
  }
}

const ALL_SYNTH_KEYS: SynthKey[] = ['kk', 'sn', 'hh', 'hho', 'hhp', 't1', 't3', 'ride', 'click']

export function usePlayback() {
  const isPlaying = ref(false)
  const currentStep = ref(-1)
  const countInBeat = ref(0)
  const part = shallowRef<Tone.Part | null>(null)
  const players = shallowRef<Record<SynthKey, Trigger> | null>(null)

  function ensurePlayers() {
    if (players.value) return players.value
    const map = {} as Record<SynthKey, Trigger>
    for (const k of ALL_SYNTH_KEYS) map[k] = makeSynth(k)
    players.value = map
    return map
  }

  function applySwing(g: Groove) {
    Tone.getTransport().swing = Math.max(0, Math.min(0.5, g.swing / 200))
    Tone.getTransport().swingSubdivision = g.division >= 16 ? '16n' : '8n'
  }

  function subdivision(g: Groove): string {
    switch (g.division) {
      case 4:
        return '4n'
      case 6:
        return '8t'
      case 8:
        return '8n'
      case 12:
        return '8t'
      case 16:
        return '16n'
      case 24:
        return '16t'
      case 32:
        return '32n'
    }
  }

  async function play(g: Groove) {
    await Tone.start()
    const p = ensurePlayers()
    stopInternal()
    Tone.getTransport().bpm.value = g.tempo
    applySwing(g)

    const n = g.voices.hh?.length ?? g.division * g.measures
    const stepDur = subdivision(g)
    const beatsPerMeasure = g.timeSig[0]
    const stepsPerBeat = g.division / beatsPerMeasure
    const stepsPerMeasure = g.division

    const beatSec = 60 / g.tempo
    const countInLen = g.countIn ? beatsPerMeasure * beatSec : 0

    const events: [string, { step: number }][] = []
    const stepSec = Tone.Time(stepDur).toSeconds()
    for (let i = 0; i < n; i++) events.push([stepSec * i + '', { step: i }])

    const newPart = new Tone.Part((time, ev: { step: number }) => {
      const step = ev.step

      for (const voice of VOICES) {
        const arr = g.voices[voice.id]
        if (!arr) continue
        const state = arr[step] ?? 0
        if (state === 0) continue
        const synthKey = effectiveSynthKey(voice.id, state)
        if (!synthKey) continue
        const trigger = p[synthKey as SynthKey]
        if (!trigger) continue
        const def = voice.states[state]
        trigger(time, def.velocity ?? 1)
      }

      if (g.metronome && step % stepsPerBeat === 0) {
        const isDownbeat = step % stepsPerMeasure === 0
        p.click(time, isDownbeat ? 1 : 0.55)
      }

      Tone.getDraw().schedule(() => {
        currentStep.value = step
      }, time)
    }, events)

    newPart.loop = g.loop
    newPart.loopEnd = stepSec * n + 's'
    newPart.start(countInLen)
    part.value = newPart

    if (g.countIn) {
      for (let i = 0; i < beatsPerMeasure; i++) {
        const isFirst = i === 0
        Tone.getTransport().scheduleOnce((time) => {
          p.click(time, isFirst ? 1 : 0.6)
          Tone.getDraw().schedule(() => {
            countInBeat.value = i + 1
          }, time)
        }, i * beatSec)
      }
      Tone.getTransport().scheduleOnce((time) => {
        Tone.getDraw().schedule(() => {
          countInBeat.value = 0
        }, time)
      }, countInLen)
    }

    Tone.getTransport().stop()
    Tone.getTransport().position = 0
    Tone.getTransport().start()
    isPlaying.value = true
  }

  function stopInternal() {
    if (part.value) {
      part.value.stop()
      part.value.dispose()
      part.value = null
    }
    Tone.getTransport().stop()
  }

  function stop() {
    stopInternal()
    isPlaying.value = false
    currentStep.value = -1
    countInBeat.value = 0
  }

  function updateRuntime(g: Groove) {
    if (!isPlaying.value) return
    Tone.getTransport().bpm.value = g.tempo
    applySwing(g)
  }

  watch(isPlaying, (v) => {
    if (!v) currentStep.value = -1
  })

  return { isPlaying, currentStep, countInBeat, play, stop, updateRuntime }
}
