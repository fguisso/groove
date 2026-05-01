<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGrooveStore } from '@/stores/groove'
import { useMidiStore, type LiveMarkerGrade } from '@/stores/midi'
import { usePracticeTimerStore } from '@/stores/practiceTimer'
import { useUrlSync } from '@/composables/useUrlSync'
import { usePlayback } from '@/composables/usePlayback'
import { DIVISIONS } from '@/lib/model'
import { VOICES } from '@/lib/voices'
import TopBar from '@/components/shell/TopBar.vue'
import ShareDialog from '@/components/shell/ShareDialog.vue'
import GrooveGrid from '@/components/groove/GrooveGrid.vue'
import Score from '@/components/groove/Score.vue'
import Transport from '@/components/groove/Transport.vue'
import PracticeClock from '@/components/groove/PracticeClock.vue'
import MidiPanel from '@/components/groove/MidiPanel.vue'
import Select from '@/components/ui/Select.vue'
import { exportMidi } from '@/lib/export-midi'
import { exportPng } from '@/lib/export-png'

const store = useGrooveStore()
const { groove } = storeToRefs(store)
const midi = useMidiStore()
const practiceTimer = usePracticeTimerStore()
useUrlSync()

const { isPlaying, currentStep, countInBeat, practiceTimerVal, play, stop, updateRuntime } =
  usePlayback()
watch(
  () => [groove.value.tempo, groove.value.swing],
  () => updateRuntime(groove.value),
)

// Live marker stamping: every MIDI hit during playback drops a marker on the
// grid + tablature, graded against the programmed groove.
watch(
  () => midi.lastHit,
  (h) => {
    if (!h || !isPlaying.value) return
    const step = currentStep.value
    if (step < 0) return
    const expected = (groove.value.voices[h.voiceId]?.[step] ?? 0) !== 0
    let grade: LiveMarkerGrade
    if (expected) grade = 'on-time'
    else if (VOICES.some((v) => (groove.value.voices[v.id]?.[step] ?? 0) !== 0))
      grade = 'wrong-voice'
    else grade = 'off-time'
    midi.pushMarker({ voiceId: h.voiceId, step, atMs: h.atMs, grade })
  },
)

// Clear feedback markers right before the next loop starts so the user sees
// their last bar's verdicts during the review window, then a clean slate.
// With count-in: clear at beat 3 (so 3 + 4 of count play with empty board).
// Without count-in: clear when playback wraps from the last step back to 0.
// `lastTrackStep` tracks the most recent positive step, so transitions through
// `-1` during the practice pause don't break the wrap detection.
watch(countInBeat, (v) => {
  if (v === 3) midi.clearMarkers()
})
let lastTrackStep = -1
watch(currentStep, (s) => {
  if (s < 0) return
  if (!groove.value.countIn && s === 0 && lastTrackStep > 0) midi.clearMarkers()
  lastTrackStep = s
})

function onPlay() {
  midi.clearMarkers()
  lastTrackStep = -1
  play(groove.value, {
    practicePauseSec: midi.practiceMode ? midi.practiceTimerSec : 0,
  })
  if (practiceTimer.enabled && groove.value.loop) practiceTimer.start()
}
function onStop() {
  // Snapshot the playing measure before stop() resets currentStep, so the
  // single-mode grid resumes on whatever bar the user paused on.
  const s = currentStep.value
  if (s >= 0) {
    const m = Math.floor(s / groove.value.division) % groove.value.measures
    store.setSelectedMeasure(m)
  }
  // In practice mode the user explicitly wants to keep markers visible after
  // pausing — only the next Play press clears them.
  if (!midi.practiceMode) midi.clearMarkers()
  practiceTimer.stop()
  stop()
}

// Single global shortcut: Space toggles play/pause.
function onKeydown(e: KeyboardEvent) {
  if (e.code !== 'Space') return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  e.preventDefault()
  if (isPlaying.value) onStop()
  else onPlay()
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  practiceTimer.setOnExpire(() => onStop())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  practiceTimer.setOnExpire(null)
  practiceTimer.stop()
})

const shareOpen = ref(false)
const scoreRef = ref<InstanceType<typeof Score> | null>(null)

async function onExportMidi() {
  await exportMidi(groove.value)
}
async function onExportPng() {
  const svg = scoreRef.value?.getSvg()
  if (svg) await exportPng(svg, groove.value.title || 'groove')
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <TopBar @share="shareOpen = true" />

    <main class="flex-1 px-4 py-5 space-y-4 max-w-[1200px] w-full mx-auto">
      <div class="flex flex-wrap items-center gap-4 text-sm">
        <div class="flex items-center gap-2">
          <label class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
            >Division</label
          >
          <Select
            :model-value="groove.division"
            :options="DIVISIONS.map((d) => ({ label: String(d) + 'ths', value: d }))"
            @update:model-value="store.setDivision($event as typeof groove.division)"
          />
        </div>
        <div
          class="ml-auto flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
        >
          <span>Time</span>
          <span class="text-foreground tabular"
            >{{ groove.timeSig[0] }}/{{ groove.timeSig[1] }}</span
          >
        </div>
      </div>

      <div class="relative">
        <Score ref="scoreRef" :active-step="currentStep" :is-playing="isPlaying" />
        <PracticeClock />
      </div>
      <Transport :is-playing="isPlaying" @play="onPlay" @stop="onStop" />
      <GrooveGrid :active-step="currentStep" :is-playing="isPlaying" />
    </main>

    <MidiPanel @export-midi="onExportMidi" @export-png="onExportPng" />

    <ShareDialog v-model:open="shareOpen" />

    <Transition name="count-fade">
      <div
        v-if="countInBeat > 0"
        class="count-in-overlay pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center"
      >
        <div :key="countInBeat" class="count-in-number">{{ countInBeat }}</div>
      </div>
    </Transition>

    <Transition name="count-fade">
      <div
        v-if="practiceTimerVal > 0"
        class="pointer-events-none fixed inset-x-0 top-24 z-40 flex flex-col items-center"
      >
        <span class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          review
        </span>
        <div :key="practiceTimerVal" class="practice-timer-number">{{ practiceTimerVal }}</div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.count-in-number {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 800;
  font-size: 10rem;
  line-height: 1;
  letter-spacing: -0.05em;
  color: hsl(var(--destructive));
  text-shadow:
    0 0 32px hsl(var(--destructive) / 0.55),
    0 0 80px hsl(var(--destructive) / 0.3);
  animation: count-pulse 260ms cubic-bezier(0.2, 0.9, 0.3, 1);
}

.practice-timer-number {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 800;
  font-size: 8rem;
  line-height: 1;
  letter-spacing: -0.05em;
  color: hsl(var(--primary));
  text-shadow:
    0 0 28px hsl(var(--primary) / 0.5),
    0 0 64px hsl(var(--primary) / 0.25);
  animation: count-pulse 260ms cubic-bezier(0.2, 0.9, 0.3, 1);
}

@keyframes count-pulse {
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  35% {
    transform: scale(1.15);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.count-fade-leave-active {
  transition: opacity 120ms ease-out;
}
.count-fade-leave-to {
  opacity: 0;
}
</style>
