import { afterEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { usePlayback } from '@/composables/usePlayback'
import { emptyGroove } from '@/lib/model'
import type { PracticeSlot } from '@/lib/midi-practice'

const fake = vi.hoisted(() => ({
  callback: null as null | ((time: number, event: unknown) => void),
  events: [] as [string, { kind: string; index?: number }][],
  bpm: { value: 122 },
}))
vi.mock('tone', () => {
  class Synth {
    volume = { value: 0 }
    toDestination() {
      return this
    }
    chain() {}
    triggerAttackRelease() {}
  }
  class Part {
    constructor(callback: typeof fake.callback, events: typeof fake.events) {
      fake.callback = callback
      fake.events = events
    }
    start() {}
    stop() {}
    dispose() {}
  }
  const raw = {
    currentTime: 10.2,
    baseLatency: 0.01,
    outputLatency: 0.02,
    getOutputTimestamp: () => ({ contextTime: 10, performanceTime: 1000 }),
  }
  return {
    Part,
    MembraneSynth: Synth,
    NoiseSynth: Synth,
    Filter: Synth,
    Synth,
    getDestination: () => ({}),
    start: async () => {},
    getContext: () => ({ state: 'running', rawContext: raw }),
    getTransport: () => ({ bpm: fake.bpm, start() {}, stop() {} }),
    getDraw: () => ({ schedule() {} }),
    Time: () => ({ toSeconds: () => 60 / fake.bpm.value / 4 }),
    immediate: () => raw.currentTime,
  }
})

afterEach(() => {
  fake.bpm.value = 122
})
it('forwards the exact scheduler audio times and expanded repeat identities, independent of drawing', async () => {
  let playback!: ReturnType<typeof usePlayback>
  const wrapper = mount(
    defineComponent({
      setup() {
        playback = usePlayback()
        return () => null
      },
    }),
  )
  const scheduled: PracticeSlot[] = []
  playback.setOnScheduledStep((slot) => scheduled.push(slot))
  const g = emptyGroove({ tempo: 122, countIn: true, repeats: [2] })
  g.voices.hh[0] = 2
  await playback.play(g)
  const steps = fake.events.filter(([, e]) => e.kind === 'step')
  const count = fake.events.find(([, e]) => e.kind === 'count')!
  fake.callback!(8, count[1])
  expect(scheduled).toEqual([])
  fake.callback!(10, steps[0]![1])
  fake.bpm.value = 130
  fake.callback!(12.1234, steps[16]![1])
  fake.callback!(15.6789, steps[0]![1])
  expect(scheduled.map((s) => [s.atSec, s.step, s.pass, s.cycle])).toEqual([
    [10, 0, 1, 1],
    [12.1234, 0, 2, 1],
    [15.6789, 0, 1, 2],
  ])
  expect(scheduled[0]!.notes).toEqual([{ voiceId: 'hh', midi: 46 }])
  expect(scheduled[1]!.stepSec).toBeCloseTo(60 / 130 / 4)
  expect(playback.audibleTime(1050)).toBeCloseTo(10.05)
  playback.stop()
  wrapper.unmount()
})
