<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGrooveStore } from '@/stores/groove'
import { useMidiStore, type LiveMarkerGrade } from '@/stores/midi'
import { VOICE_BY_ID, type VoiceId } from '@/lib/voices'
import NoteCell from './NoteCell.vue'
import MeasureTabs from './MeasureTabs.vue'

const props = defineProps<{ activeStep?: number; isPlaying?: boolean }>()
const store = useGrooveStore()
const { groove, selectedMeasure } = storeToRefs(store)
const midi = useMidiStore()

const stepsPerMeasure = computed(() => groove.value.division)
const perBeat = computed(() => groove.value.division / (groove.value.timeSig[1] === 8 ? 2 : 1))

// In single mode (paused) only the selected measure is rendered. In stack
// mode (playing) every measure is rendered as its own block, vertically.
const visibleMeasures = computed(() =>
  props.isPlaying
    ? Array.from({ length: groove.value.measures }, (_, i) => i)
    : [selectedMeasure.value],
)

const gridStyle = computed(() => ({
  gridTemplateColumns: `96px repeat(${stepsPerMeasure.value}, minmax(26px, 1fr))`,
}))

function isBeat(localIdx: number) {
  return localIdx % perBeat.value === 0
}
function isDownbeat(localIdx: number) {
  return localIdx % (perBeat.value * groove.value.timeSig[0]) === 0
}
function globalIdx(measure: number, localIdx: number) {
  return measure * stepsPerMeasure.value + localIdx
}

const VISIBLE_LANES: VoiceId[] = ['hh', 'ride', 't1', 't2', 't3', 'sn', 'kk']
const lanes = VISIBLE_LANES.map((id) => {
  const v = VOICE_BY_ID[id]
  return { key: id, label: v.label, kind: v.kind }
})

const userWantsSticking = ref<boolean | null>(null)
const hasAnySticking = computed(() => groove.value.sticking.some((s) => s !== '-'))
const showSticking = computed(() =>
  userWantsSticking.value !== null ? userWantsSticking.value : hasAnySticking.value,
)

function toggleSticking() {
  userWantsSticking.value = !showSticking.value
}

// Live pad feedback: when playback is stopped and MIDI is connected, the
// step-0 cell of the matching lane lights up briefly so the user can verify
// pad → voice mapping by ear AND eye.
const LIVE_HIT_MS = 250
const recentlyHit = ref<Record<string, number>>({})
const showLiveMonitor = computed(() => midi.connected && !props.isPlaying)

watch(
  () => midi.lastHit,
  (h) => {
    if (!h) return
    const t = h.atMs
    recentlyHit.value = { ...recentlyHit.value, [h.voiceId]: t }
    setTimeout(() => {
      if (recentlyHit.value[h.voiceId] === t) {
        const next = { ...recentlyHit.value }
        delete next[h.voiceId]
        recentlyHit.value = next
      }
    }, LIVE_HIT_MS)
  },
)

function liveHitFor(voiceId: VoiceId, measure: number, localIdx: number): boolean {
  if (!showLiveMonitor.value) return false
  // The monitor only flashes column 0 of the currently-edited measure.
  if (measure !== selectedMeasure.value) return false
  if (localIdx !== 0) return false
  return recentlyHit.value[voiceId] !== undefined
}

const liveMarkerByCell = computed<Record<string, LiveMarkerGrade>>(() => {
  const out: Record<string, LiveMarkerGrade> = {}
  for (const m of midi.markers) {
    out[`${m.voiceId}-${m.step}`] = m.grade
  }
  return out
})

function liveMarkerFor(
  voiceId: VoiceId,
  measure: number,
  localIdx: number,
): LiveMarkerGrade | undefined {
  return liveMarkerByCell.value[`${voiceId}-${globalIdx(measure, localIdx)}`]
}

function isActive(measure: number, localIdx: number): boolean {
  return props.activeStep === globalIdx(measure, localIdx)
}

// Auto-scroll the stack so the currently-playing measure stays centered.
// Only fires on measure boundaries — scrolling on every step would fight the
// browser's smooth-scroll animation.
const stackHost = ref<HTMLElement | null>(null)
const measureRefs = ref<HTMLElement[]>([])
const activeMeasure = computed(() => {
  const s = props.activeStep ?? -1
  if (s < 0) return -1
  return Math.floor(s / stepsPerMeasure.value)
})

function setMeasureRef(el: Element | null, idx: number) {
  if (el instanceof HTMLElement) measureRefs.value[idx] = el
}

watch(
  () => [props.isPlaying, activeMeasure.value] as const,
  ([playing, m], prev) => {
    if (!playing || m < 0) return
    if (prev && prev[1] === m && prev[0] === playing) return
    nextTick(() => {
      const el = measureRefs.value[m]
      const host = stackHost.value
      if (!el || !host) return
      const top = el.offsetTop - host.clientHeight / 2 + el.clientHeight / 2
      host.scrollTo({ top, behavior: 'smooth' })
    })
  },
)
</script>

<template>
  <section class="panel">
    <div v-if="!props.isPlaying" class="px-3 pt-3">
      <MeasureTabs />
    </div>

    <div ref="stackHost" :class="props.isPlaying ? 'play-stack' : 'overflow-x-auto'">
      <div
        v-for="(m, i) in visibleMeasures"
        :key="'measure-' + m"
        :ref="(el) => setMeasureRef(el as Element | null, i)"
        :class="props.isPlaying ? 'play-stack__measure' : ''"
      >
        <div
          v-if="props.isPlaying"
          class="px-3 pt-2 text-[10px] font-mono uppercase tracking-widest"
          :class="m === activeMeasure ? 'text-primary' : 'text-muted-foreground'"
        >
          Measure {{ m + 1 }}
        </div>

        <div v-if="!showSticking && i === 0 && !props.isPlaying" class="px-3 pt-3">
          <button
            type="button"
            class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
            @click="toggleSticking"
          >
            + Sticking
          </button>
        </div>

        <div class="grid gap-1 p-3" :class="!showSticking && 'pt-2'" :style="gridStyle">
          <template v-if="showSticking">
            <button
              type="button"
              class="pr-3 flex items-center text-[10px] font-mono tracking-wider text-primary hover:text-primary/70 transition-colors"
              :title="props.isPlaying ? 'Sticking' : 'Hide sticking'"
              :disabled="props.isPlaying"
              @click="toggleSticking"
            >
              STICKING
            </button>
            <NoteCell
              v-for="i2 in stepsPerMeasure"
              :key="'stk-' + m + '-' + (i2 - 1)"
              :value="0"
              kind="sticking"
              :label="
                groove.sticking[globalIdx(m, i2 - 1)] === '-'
                  ? ''
                  : groove.sticking[globalIdx(m, i2 - 1)]
              "
              :beat="isBeat(i2 - 1)"
              :downbeat="isDownbeat(i2 - 1)"
              :beat-start="i2 - 1 > 0 && isBeat(i2 - 1)"
              :active="isActive(m, i2 - 1)"
              @click="store.cycleSticking(globalIdx(m, i2 - 1))"
            />
          </template>

          <template v-for="v in lanes" :key="v.key + '-m' + m">
            <div
              class="pr-3 flex items-center text-[10px] font-mono tracking-wider text-muted-foreground"
            >
              {{ v.label }}
            </div>
            <NoteCell
              v-for="i3 in stepsPerMeasure"
              :key="v.key + '-' + m + '-' + (i3 - 1)"
              :value="(groove.voices[v.key] ?? [])[globalIdx(m, i3 - 1)] ?? 0"
              :kind="v.kind"
              :voice-id="v.key"
              :beat="isBeat(i3 - 1)"
              :downbeat="isDownbeat(i3 - 1)"
              :beat-start="i3 - 1 > 0 && isBeat(i3 - 1)"
              :active="isActive(m, i3 - 1)"
              :live-hit="liveHitFor(v.key, m, i3 - 1)"
              :live-marker="liveMarkerFor(v.key, m, i3 - 1)"
              @click="store.cycleCell(v.key, globalIdx(m, i3 - 1))"
            />
          </template>
        </div>
      </div>
    </div>

    <p class="border-t bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
      Hi-hat: <span class="font-mono text-foreground">x</span> closed →
      <span class="font-mono text-foreground">o</span> open →
      <span class="font-mono text-warn">X</span> accent →
      <span class="font-mono text-foreground">f</span> foot. Snare / kick:
      <span class="font-mono text-foreground">●</span> normal →
      <span class="font-mono text-warn">◆</span> accent →
      <span class="font-mono text-foreground">○</span> ghost.
    </p>
  </section>
</template>

<style scoped>
.play-stack {
  max-height: min(70vh, 720px);
  overflow-y: auto;
  scroll-behavior: smooth;
}
.play-stack__measure + .play-stack__measure {
  border-top: 1px solid hsl(var(--border));
}
</style>
