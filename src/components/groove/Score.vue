<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGrooveStore } from '@/stores/groove'
import { renderScore, type StepMarker } from '@/lib/vex-builder'

const props = defineProps<{ activeStep?: number }>()

const store = useGrooveStore()
const { groove } = storeToRefs(store)
const host = ref<HTMLDivElement | null>(null)
const stepMarkers = ref<StepMarker[]>([])
const scoreHeight = ref(200)

function redraw() {
  if (!host.value) return
  try {
    const res = renderScore(host.value, groove.value)
    stepMarkers.value = res.stepMarkers
    scoreHeight.value = res.height
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
  transition: left 60ms linear, width 60ms linear;
  border-radius: 2px;
}
</style>
