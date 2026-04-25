import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { voiceForMidiNote, type VoiceId } from '@/lib/voices'

export interface MidiHit {
  voiceId: VoiceId
  rawNote: number
  velocity: number
  atMs: number
}

export function useMidiInput() {
  const supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
  const connected = ref(false)
  const error = ref<string | null>(null)
  const deviceName = ref<string | null>(null)
  const hits = ref<MidiHit[]>([])
  const access = shallowRef<MIDIAccess | null>(null)
  let cleanups: Array<() => void> = []

  async function connect() {
    if (!supported) {
      error.value = 'Web MIDI is not supported in this browser. Try Chrome, Edge, or Firefox.'
      return
    }
    try {
      const a = await navigator.requestMIDIAccess()
      access.value = a
      const inputs = Array.from(a.inputs.values())
      if (inputs.length === 0) {
        error.value = 'No MIDI input devices found. Connect your kit and try again.'
        return
      }
      const input = inputs[0]
      deviceName.value = input.name ?? 'MIDI device'
      const handler = (ev: Event) => onMessage(ev as MIDIMessageEvent)
      input.addEventListener('midimessage', handler)
      cleanups.push(() => input.removeEventListener('midimessage', handler))
      connected.value = true
      error.value = null
    } catch (e) {
      error.value = (e as Error).message ?? 'Failed to access MIDI devices.'
    }
  }

  function disconnect() {
    cleanups.forEach((c) => c())
    cleanups = []
    access.value = null
    connected.value = false
    deviceName.value = null
  }

  function onMessage(ev: MIDIMessageEvent) {
    const data = ev.data
    if (!data || data.length < 3) return
    const status = data[0] & 0xf0
    if (status !== 0x90) return // note-on only
    const note = data[1]
    const velocity = data[2]
    if (velocity === 0) return // some devices send note-on with velocity 0 as note-off
    const voiceId = voiceForMidiNote(note)
    if (!voiceId) return
    hits.value.push({
      voiceId,
      rawNote: note,
      velocity: velocity / 127,
      atMs: performance.now(),
    })
  }

  function clearHits() {
    hits.value = []
  }

  onBeforeUnmount(() => disconnect())

  return { supported, connected, error, deviceName, hits, connect, disconnect, clearHits }
}
