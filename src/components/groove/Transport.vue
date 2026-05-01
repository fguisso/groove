<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Play, Square, Repeat, Timer, Waves } from 'lucide-vue-next'
import { useGrooveStore } from '@/stores/groove'
import { usePracticeTimerStore } from '@/stores/practiceTimer'
import Slider from '@/components/ui/Slider.vue'
import Switch from '@/components/ui/Switch.vue'
import MetronomeIcon from '@/components/icons/MetronomeIcon.vue'

const props = defineProps<{
  isPlaying: boolean
  readOnly?: boolean
}>()
const emit = defineEmits<{ (e: 'play'): void; (e: 'stop'): void }>()

const store = useGrooveStore()
const { groove } = storeToRefs(store)
const timerStore = usePracticeTimerStore()
const { enabled: timerEnabled, minutes: timerMinutes } = storeToRefs(timerStore)

// Auto-disable the timer if the user turns loop off — without a loop the timer
// has nothing useful to bound, and leaving it visually "on" would mislead.
watch(
  () => groove.value.loop,
  (loopOn) => {
    if (!loopOn && timerEnabled.value) timerStore.setEnabled(false)
  },
)

function onToggleTimer(v: boolean) {
  if (v && !groove.value.loop) return
  timerStore.setEnabled(v)
}

function onMinutesInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  timerStore.setMinutes(v)
}
</script>

<template>
  <section class="panel flex flex-wrap items-center gap-5 p-3">
    <button
      v-if="!props.isPlaying"
      type="button"
      class="transport-play"
      aria-label="Play"
      @click="emit('play')"
    >
      <Play class="h-5 w-5 translate-x-0.5" :stroke-width="2.5" />
    </button>
    <button
      v-else
      type="button"
      class="transport-play playing"
      aria-label="Stop"
      @click="emit('stop')"
    >
      <Square class="h-4 w-4" :stroke-width="2.5" fill="currentColor" />
    </button>

    <div class="flex items-baseline gap-1 px-1">
      <span class="tempo-display text-4xl">{{ groove.tempo }}</span>
      <span class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">bpm</span>
    </div>

    <div class="h-8 w-px bg-border" />

    <div class="flex items-center gap-2 min-w-[180px] flex-1">
      <label class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground w-14"
        >Tempo</label
      >
      <Slider
        :model-value="groove.tempo"
        :min="40"
        :max="260"
        :step="1"
        @update:model-value="store.setTempo($event)"
      />
    </div>

    <div v-if="!props.readOnly" class="flex items-center gap-2 min-w-[160px] flex-1">
      <label class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground w-14"
        >Swing</label
      >
      <Slider
        :model-value="groove.swing"
        :min="0"
        :max="80"
        :step="1"
        @update:model-value="store.setSwing($event)"
      />
      <span class="font-mono tabular text-xs text-muted-foreground w-8 text-right"
        >{{ groove.swing }}%</span
      >
    </div>

    <div class="flex items-center gap-4 ml-auto">
      <label
        v-if="!props.readOnly"
        class="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground cursor-pointer"
        :title="
          groove.loop
            ? 'Loop: on — click to stop looping'
            : 'Loop: off — play groove in a continuous loop'
        "
      >
        <Repeat class="h-3.5 w-3.5" />
        <Switch :model-value="groove.loop" @update:model-value="store.toggleLoop()" />
      </label>
      <label
        class="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
        :class="
          !groove.loop
            ? 'opacity-40 cursor-not-allowed'
            : 'cursor-pointer hover:text-foreground transition-colors'
        "
        :title="
          !groove.loop
            ? 'Practice timer: enable loop first'
            : timerEnabled
              ? `Practice timer: on (${timerMinutes} min) — click to disable`
              : 'Practice timer: off — auto-stop playback after N minutes'
        "
      >
        <Timer class="h-3.5 w-3.5" />
        <Switch :model-value="timerEnabled" @update:model-value="onToggleTimer($event)" />
        <input
          type="number"
          min="1"
          max="60"
          step="1"
          inputmode="numeric"
          aria-label="Practice timer minutes"
          class="w-10 px-1 py-0.5 text-[11px] font-mono tabular text-center bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
          :value="timerMinutes"
          @input="onMinutesInput"
        />
        <span class="text-[10px] font-mono uppercase tracking-widest">min</span>
      </label>
      <label
        v-if="!props.readOnly"
        class="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground cursor-pointer"
        :title="
          groove.metronome
            ? 'Metronome: on — click to silence'
            : 'Metronome: off — click beats during playback'
        "
      >
        <MetronomeIcon class="h-3.5 w-3.5" />
        <Switch :model-value="groove.metronome" @update:model-value="store.toggleMetronome()" />
      </label>
      <label
        v-if="!props.readOnly"
        class="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground cursor-pointer"
        :title="
          groove.countIn
            ? 'Count-in: on — click to disable the lead-in bar'
            : 'Count-in: off — play a bar of clicks before starting'
        "
      >
        <Waves class="h-3.5 w-3.5" />
        <Switch :model-value="groove.countIn" @update:model-value="store.toggleCountIn()" />
      </label>
    </div>
  </section>
</template>
