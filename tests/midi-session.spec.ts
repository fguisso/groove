import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, watch } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useMidiStore } from '@/stores/midi'
import { useMidiPractice } from '@/composables/useMidiPractice'
import PracticeFeedback from '@/components/groove/PracticeFeedback.vue'

let wrapper: VueWrapper | undefined
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.useFakeTimers()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('records simultaneous MIDI events synchronously, retains the result after Stop and resets on Play', async () => {
  let now = 1
  let practice!: ReturnType<typeof useMidiPractice>
  wrapper = mount(
    defineComponent({
      setup() {
        practice = useMidiPractice((ms) => (ms == null ? now : ms / 1000))
        return () => null
      },
    }),
  )
  const midi = useMidiStore()
  midi.connected = true
  practice.start()
  practice.addSlot({
    atSec: 1,
    step: 0,
    pass: 5,
    cycle: 1,
    stepSec: 0.123,
    notes: [
      { voiceId: 'hh', midi: 42 },
      { voiceId: 'kk', midi: 36 },
    ],
  })
  midi.lastHit = { voiceId: 'hh', rawNote: 42, velocity: 1, atMs: 1000 }
  midi.lastHit = { voiceId: 'kk', rawNote: 36, velocity: 1, atMs: 1000 }
  now = 1.3
  await vi.advanceTimersByTimeAsync(25)
  expect(midi.markers.map((m) => m.grade)).toEqual(['perfect', 'perfect'])
  expect(midi.markers.every((m) => m.pass === 5)).toBe(true)
  practice.finish()
  now = 2
  await vi.advanceTimersByTimeAsync(400)
  expect(midi.markers).toHaveLength(2)
  practice.start()
  expect(midi.markers).toEqual([])
})

describe('MIDI input timestamps', () => {
  it('uses the system receipt timestamp and does not duplicate listeners when reconnecting', async () => {
    const port = Object.assign(new EventTarget(), { name: 'Test kit' })
    const requestMIDIAccess = vi.fn(async () => ({ inputs: new Map([['test', port]]) }))
    vi.stubGlobal('navigator', { requestMIDIAccess })
    const midi = useMidiStore()
    await midi.connect()
    await midi.connect()
    const seen: number[] = []
    const unwatch = watch(
      () => midi.lastHit,
      (hit) => {
        if (hit) seen.push(hit.rawNote)
      },
      { flush: 'sync' },
    )
    const send = (note: number, velocity = 100, status = 0x99) => {
      const event = new Event('midimessage')
      Object.defineProperties(event, {
        data: { value: new Uint8Array([status, note, velocity]) },
        timeStamp: { value: 1234 },
      })
      port.dispatchEvent(event)
    }
    send(42)
    send(36)
    send(38, 0)
    send(38, 100, 0x89)
    expect(seen).toEqual([42, 36])
    expect(midi.lastHit?.atMs).toBe(1234)
    midi.disconnect()
    send(38)
    expect(seen).toEqual([42, 36])
    unwatch()
  })
})

it('shows distinct, persistent totals and signed timing without relying on color alone', async () => {
  const midi = useMidiStore()
  midi.pushMarker({
    voiceId: 'sn',
    step: 0,
    pass: 3,
    cycle: 1,
    atMs: 1,
    grade: 'late',
    deltaMs: 68,
  })
  midi.pushMarker({ voiceId: 'hh', step: 2, pass: 3, cycle: 1, atMs: 0, grade: 'missed' })
  wrapper = mount(PracticeFeedback, { props: { isPlaying: false } })
  expect(wrapper.text()).toContain('Resultado da prática')
  expect(wrapper.text()).toContain('Atrasada (+68 ms), passagem 3')
  expect(wrapper.text()).toContain('Omitida 1')
  expect(wrapper.text()).toContain('até o próximo Play')
})
