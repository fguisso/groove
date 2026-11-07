<!--
  Groove, a drum-groove editor.
  Copyright (C) 2026 Fernando Guisso
  This program is free software under the GNU General Public License,
  version 3 or (at your option) any later version. See the LICENSE file.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGrooveStore } from '@/stores/groove'
import { useMidiStore } from '@/stores/midi'
import { usePracticeTimerStore } from '@/stores/practiceTimer'
import { useSpeedTrainerStore } from '@/stores/speedTrainer'
import { useUrlSync } from '@/composables/useUrlSync'
import { usePlayback } from '@/composables/usePlayback'
import { useWakeLock } from '@/composables/useWakeLock'
import { useTour } from '@/composables/useTour'
import { DIVISIONS } from '@/lib/model'
import { useMidiPractice } from '@/composables/useMidiPractice'
import PracticeFeedback from '@/components/groove/PracticeFeedback.vue'
import TopBar from '@/components/shell/TopBar.vue'
import ShareDialog from '@/components/shell/ShareDialog.vue'
import GrooveGrid from '@/components/groove/GrooveGrid.vue'
import Score from '@/components/groove/Score.vue'
import Transport from '@/components/groove/Transport.vue'
import StateBar from '@/components/groove/StateBar.vue'
import PracticeClock from '@/components/groove/PracticeClock.vue'
import AudioHint from '@/components/groove/AudioHint.vue'
import MidiPanel from '@/components/groove/MidiPanel.vue'
import Select from '@/components/ui/Select.vue'
import { exportMidi } from '@/lib/export-midi'
import { exportPng } from '@/lib/export-png'

const store = useGrooveStore()
const { groove } = storeToRefs(store)
const midi = useMidiStore()
const practiceTimer = usePracticeTimerStore()
const speed = useSpeedTrainerStore()
const { maybeAutoStart } = useTour()
useUrlSync()

const {
  isPlaying,
  currentStep,
  currentPass,
  countInBeat,
  practiceTimerVal,
  loopCount,
  play,
  stop,
  updateRuntime,
  setOnEnded,
  setOnScheduledStep,
  audibleTime,
  audioBlocked,
  audioState,
} = usePlayback()
const wakeLock = useWakeLock()
watch(
  () => [groove.value.tempo, groove.value.swing],
  () => updateRuntime(groove.value),
)

// Keep the screen awake while a groove is playing; release the moment it stops
// (manual stop, natural end, or timer expiry all flip isPlaying to false).
// Lesson mode holds the lock even when stopped: you are standing at the kit
// transcribing a bar between takes, and the screen dimming mid-thought is
// exactly the failure this is here to prevent.
watch(
  [isPlaying, () => midi.lessonMode],
  ([playing, lesson]) => {
    if (playing || lesson) wakeLock.request()
    else wakeLock.release()
  },
  { immediate: true },
)

// Speed training: every N completed loops, nudge the tempo toward the target.
// The tempo it reaches is kept when playback stops, because "I got it to 140"
// is the point of the exercise; the slider is right there to wind it back.
watch(loopCount, (n) => {
  const next = speed.tempoAfterLoops(n, groove.value.tempo)
  if (next !== null) store.setTempo(next)
})

const midiPractice = useMidiPractice(audibleTime)
setOnScheduledStep(midiPractice.addSlot)
watch(isPlaying, (playing, wasPlaying) => {
  if (!playing && wasPlaying) midiPractice.finish()
})

function onPlay() {
  midiPractice.start()
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
  midiPractice.finish()
  practiceTimer.stop()
  stop()
}

// Global shortcuts: Space toggles play/pause, Cmd/Ctrl+Z undoes.
function onKeydown(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  if (typing) return

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) store.redo()
    else store.undo()
    return
  }
  if (e.code !== 'Space') return
  e.preventDefault()
  if (isPlaying.value) onStop()
  else onPlay()
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  practiceTimer.setOnExpire(() => onStop())
  // Natural completion resets navigation while keeping the practice result.
  setOnEnded((atSec) => {
    midiPractice.finish(atSec)
    practiceTimer.stop()
    store.setSelectedMeasure(0)
  })
  // Defer so the grid/score have painted before the tour anchors to them.
  nextTick(() => maybeAutoStart())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  practiceTimer.setOnExpire(null)
  practiceTimer.stop()
  setOnScheduledStep(null)
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
  <div class="app-shell flex flex-col">
    <TopBar @share="shareOpen = true" />

    <main class="flex-1 px-4 py-5 space-y-4 max-w-[1200px] w-full mx-auto">
      <div v-if="!midi.lessonMode" class="flex flex-wrap items-center gap-4 text-sm">
        <div class="flex items-center gap-2" data-tour="division">
          <label class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
            >Division</label
          >
          <Select
            :model-value="groove.division"
            :options="DIVISIONS.map((d) => ({ label: d + (d === 32 ? 'nds' : 'ths'), value: d }))"
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

      <!-- Lesson mode: standing at a kit with a teacher talking. The staff and
           the practice tools are for studying afterwards, not for catching a
           bar as it is dictated, so they step aside and the grid gets the room. -->
      <div v-if="!midi.lessonMode" class="relative" data-tour="score">
        <Score
          ref="scoreRef"
          :active-step="currentStep"
          :active-pass="currentPass"
          :is-playing="isPlaying"
        />
        <PracticeClock />
      </div>
      <PracticeFeedback v-if="!midi.lessonMode" :is-playing="isPlaying" />
      <Transport v-if="!midi.lessonMode" :is-playing="isPlaying" @play="onPlay" @stop="onStop" />
      <GrooveGrid :active-step="currentStep" :active-pass="currentPass" :is-playing="isPlaying" />
      <StateBar :is-playing="isPlaying" @play="onPlay" @stop="onStop" />
    </main>

    <MidiPanel @export-midi="onExportMidi" @export-png="onExportPng" />

    <ShareDialog v-model:open="shareOpen" />

    <!-- Editor only: a position:fixed banner inside an embed iframe would fight
         whatever height the host page gave the frame. -->
    <AudioHint :is-playing="isPlaying" :blocked="audioBlocked" :state="audioState()" />

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
