<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGrooveStore } from '@/stores/groove'
import { useMidiStore } from '@/stores/midi'
import { renderScore, type StepMarker } from '@/lib/vex-builder'
import type { VoiceId } from '@/lib/voices'

const props = defineProps<{ activeStep?: number }>()

const store = useGrooveStore()
const { groove } = storeToRefs(store)
const midi = useMidiStore()
const { markers } = storeToRefs(midi)
const host = ref<HTMLDivElement | null>(null)
const stepMarkers = ref<StepMarker[]>([])
const scoreHeight = ref(200)
const voiceY = ref<Record<VoiceId, number>>({} as Record<VoiceId, number>)

function redraw() {
  if (!host.value) return
  try {
    const res = renderScore(host.value, groove.value)
    stepMarkers.value = res.stepMarkers
    scoreHeight.value = res.height
    voiceY.value = res.voiceY
  } catch (e) {
    console.warn('[score] render failed', e)
  }
}

onMounted(() => {
  redraw()
  window.addEventListener('resize', redraw)
})
onBeforeUnmount(() => window.removeEventListener('resize', redraw))
watch(groove, redraw, { deep: true })

const marker = computed(() => {
  const i = props.activeStep ?? -1
  if (i < 0 || i >= stepMarkers.value.length) return null
  return stepMarkers.value[i]
})

interface MarkerPosition {
  id: number
  x: number
  y: number
  cls: string
}

const markerPositions = computed<MarkerPosition[]>(() => {
  const out: MarkerPosition[] = []
  for (const m of markers.value) {
    const sm = stepMarkers.value[m.step]
    if (!sm) continue
    const y = voiceY.value[m.voiceId]
    if (y == null) continue
    out.push({
      id: m.id,
      x: sm.x + sm.width / 2,
      y,
      cls: `score-live-marker score-live-marker--${m.grade}`,
    })
  }
  return out
})

defineExpose({
  getSvg: () => host.value?.querySelector('svg') as SVGSVGElement | null,
})
</script>

<template>
  <div class="score-host w-full overflow-x-auto">
    <div class="score-wrap">
      <div ref="host" />
      <div
        v-if="marker"
        class="score-marker"
        :style="{
          left: marker.x + 'px',
          width: marker.width + 'px',
          height: scoreHeight + 'px',
        }"
      />
      <div
        v-for="m in markerPositions"
        :key="m.id"
        :class="m.cls"
        :style="{ left: m.x + 'px', top: m.y + 'px' }"
      />
    </div>
  </div>
</template>

<style scoped>
.score-wrap {
  position: relative;
  display: inline-block;
  vertical-align: top;
}

.score-marker {
  position: absolute;
  top: 0;
  background: hsl(var(--primary) / 0.22);
  border-left: 1px solid hsl(var(--primary) / 0.6);
  border-right: 1px solid hsl(var(--primary) / 0.6);
  pointer-events: none;
  transition:
    left 60ms linear,
    width 60ms linear;
  border-radius: 2px;
}

/* Live MIDI marker — sits on top of the actual notehead so the user can read
   "I hit this note" at a glance. Semi-transparent on purpose: lets the
   notehead glyph beneath show through, and avoids covering accents/dots. */
.score-live-marker {
  position: absolute;
  width: 18px;
  height: 18px;
  margin-left: -9px;
  margin-top: -9px;
  border-radius: 50%;
  pointer-events: none;
  animation: score-marker-appear 220ms ease-out;
  z-index: 2;
}
.score-live-marker--on-time {
  background: hsl(160 70% 45% / 0.55);
  box-shadow: 0 0 14px hsl(160 70% 45% / 0.7);
}
.score-live-marker--wrong-voice {
  background: hsl(var(--warn) / 0.55);
  box-shadow: 0 0 14px hsl(var(--warn) / 0.7);
}
.score-live-marker--off-time {
  background: hsl(var(--destructive) / 0.55);
  box-shadow: 0 0 14px hsl(var(--destructive) / 0.7);
}

@keyframes score-marker-appear {
  0% {
    opacity: 0;
    transform: scale(2.2);
  }
  60% {
    opacity: 1;
    transform: scale(1.2);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
