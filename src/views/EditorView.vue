<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGrooveStore } from '@/stores/groove'
import { useUrlSync } from '@/composables/useUrlSync'
import { usePlayback } from '@/composables/usePlayback'
import { DIVISIONS } from '@/lib/model'
import TopBar from '@/components/shell/TopBar.vue'
import ShareDialog from '@/components/shell/ShareDialog.vue'
import GrooveGrid from '@/components/groove/GrooveGrid.vue'
import Score from '@/components/groove/Score.vue'
import Transport from '@/components/groove/Transport.vue'
import MidiPanel from '@/components/groove/MidiPanel.vue'
import Select from '@/components/ui/Select.vue'
import { exportMidi } from '@/lib/export-midi'
import { exportPng } from '@/lib/export-png'

const store = useGrooveStore()
const { groove } = storeToRefs(store)
useUrlSync()

const { isPlaying, currentStep, countInBeat, play, stop, updateRuntime } = usePlayback()
watch(
  () => [groove.value.tempo, groove.value.swing],
  () => updateRuntime(groove.value),
)

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
    <TopBar @share="shareOpen = true" @export-midi="onExportMidi" @export-png="onExportPng" />

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
        <div class="flex items-center gap-2">
          <label class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
            >Measures</label
          >
          <Select
            :model-value="groove.measures"
            :options="[1, 2, 3, 4].map((m) => ({ label: String(m), value: m }))"
            @update:model-value="store.setMeasures(Number($event))"
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

      <Score ref="scoreRef" :active-step="currentStep" />
      <Transport :is-playing="isPlaying" @play="play(groove)" @stop="stop()" />
      <GrooveGrid :active-step="currentStep" />
      <MidiPanel />
    </main>

    <ShareDialog v-model:open="shareOpen" />

    <Transition name="count-fade">
      <div
        v-if="countInBeat > 0"
        class="count-in-overlay pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center"
      >
        <div :key="countInBeat" class="count-in-number">{{ countInBeat }}</div>
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
