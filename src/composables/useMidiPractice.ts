import { onBeforeUnmount, watch } from 'vue'
import { useMidiStore } from '@/stores/midi'
import { MidiPractice, type PracticeSlot } from '@/lib/midi-practice'

export function useMidiPractice(clock: (eventMs?: number) => number) {
  const midi = useMidiStore()
  let session: MidiPractice | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let stopAt: number | null = null

  function tick() {
    if (!session) return
    const now = clock()
    for (const result of session.advance(now)) midi.pushMarker(result)
    if (stopAt != null && now >= stopAt) cancel()
  }

  function cancel() {
    if (timer) clearInterval(timer)
    timer = null
    session = null
    stopAt = null
  }

  function start() {
    cancel()
    midi.clearMarkers()
    session = new MidiPractice(midi.toleranceMs)
    timer = setInterval(tick, 25)
  }

  function addSlot(slot: PracticeSlot) {
    // Connecting in the middle of playback starts with the next scheduled step.
    if (midi.connected) session?.addSlot(slot)
  }

  function finish(atSec = clock()) {
    if (stopAt != null) return
    // Keep receiving queued events and the final note's timing window after Stop.
    session?.finishAt(atSec)
    stopAt = atSec + 0.35
    tick()
  }

  watch(
    () => midi.lastHit,
    (hit) => {
      if (!hit || !session) return
      session.addHit({
        ...hit,
        atSec: clock(hit.atMs) - midi.latencyMs / 1000,
      })
    },
    { flush: 'sync' },
  )
  onBeforeUnmount(cancel)
  return { start, addSlot, finish }
}
