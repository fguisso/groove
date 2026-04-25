<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGrooveStore } from '@/stores/groove'
import { VOICE_BY_ID, type VoiceId } from '@/lib/voices'
import NoteCell from './NoteCell.vue'

const props = defineProps<{ activeStep?: number }>()
const store = useGrooveStore()
const { groove } = storeToRefs(store)

const cols = computed(() => groove.value.voices.hh?.length ?? 0)
const perBeat = computed(() => groove.value.division / (groove.value.timeSig[1] === 8 ? 2 : 1))

function isBeat(i: number) {
  return i % perBeat.value === 0
}
function isDownbeat(i: number) {
  return i % (perBeat.value * groove.value.timeSig[0]) === 0
}

const gridStyle = computed(() => ({
  gridTemplateColumns: `96px repeat(${cols.value}, minmax(26px, 1fr))`,
}))

const VISIBLE_LANES: VoiceId[] = ['hh', 'sn', 'kk']
const lanes = VISIBLE_LANES.map((id) => {
  const v = VOICE_BY_ID[id]
  return { key: id, label: v.label, kind: v.kind }
})

// null = never toggled → follow auto (show if any sticking values exist)
// true/false = explicit user choice, overrides auto
const userWantsSticking = ref<boolean | null>(null)
const hasAnySticking = computed(() => groove.value.sticking.some((s) => s !== '-'))
const showSticking = computed(() =>
  userWantsSticking.value !== null ? userWantsSticking.value : hasAnySticking.value,
)

function toggleSticking() {
  userWantsSticking.value = !showSticking.value
}
</script>

<template>
  <section class="panel overflow-x-auto">
    <div v-if="!showSticking" class="px-3 pt-3">
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
          title="Hide sticking"
          @click="toggleSticking"
        >
          STICKING
        </button>
        <NoteCell
          v-for="(s, i) in groove.sticking"
          :key="'stk-' + i"
          :value="0"
          kind="sticking"
          :label="s === '-' ? '' : s"
          :beat="isBeat(i)"
          :downbeat="isDownbeat(i)"
          :beat-start="i > 0 && isBeat(i)"
          :active="props.activeStep === i"
          @click="store.cycleSticking(i)"
        />
      </template>

      <template v-for="v in lanes" :key="v.key">
        <div
          class="pr-3 flex items-center text-[10px] font-mono tracking-wider text-muted-foreground"
        >
          {{ v.label }}
        </div>
        <NoteCell
          v-for="(val, i) in groove.voices[v.key] ?? []"
          :key="v.key + '-' + i"
          :value="val as number"
          :kind="v.kind"
          :beat="isBeat(i)"
          :downbeat="isDownbeat(i)"
          :beat-start="i > 0 && isBeat(i)"
          :active="props.activeStep === i"
          @click="store.cycleCell(v.key, i)"
        />
      </template>
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
