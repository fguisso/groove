<script setup lang="ts">
import { computed } from 'vue'
import { useMidiStore } from '@/stores/midi'
import { GRADE_LABELS, resultLabel, type PracticeGrade } from '@/lib/midi-practice'
import { VOICE_BY_ID } from '@/lib/voices'

defineProps<{ isPlaying: boolean }>()
const midi = useMidiStore()
const grades = Object.keys(GRADE_LABELS) as PracticeGrade[]
const counts = computed(() =>
  Object.fromEntries(grades.map((g) => [g, midi.markers.filter((m) => m.grade === g).length])),
)
const last = computed(() => [...midi.markers].reverse().find((m) => m.grade !== 'missed'))
const timing = computed(() =>
  midi.markers
    .filter((m) => ['perfect', 'early', 'late'].includes(m.grade))
    .map((m) => m.deltaMs!)
    .sort((a, b) => a - b),
)
function median(values: number[]) {
  const n = values.length
  return n ? (values[Math.floor((n - 1) / 2)]! + values[Math.floor(n / 2)]!) / 2 : 0
}
const medianMs = computed(() => Math.round(median(timing.value)))
const spreadMs = computed(() =>
  Math.round(median(timing.value.map((n) => Math.abs(n - medianMs.value)).sort((a, b) => a - b))),
)
const hatName = (note?: number) => (note === 46 ? 'aberto' : note === 44 ? 'pedal' : 'fechado')
</script>

<template>
  <section
    v-if="midi.connected || midi.markers.length"
    class="practice-feedback rounded-lg border bg-card p-3 space-y-3"
    aria-label="Avaliação MIDI"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <p class="text-sm font-medium">{{ isPlaying ? 'Prática MIDI' : 'Resultado da prática' }}</p>
      <p class="text-xs text-muted-foreground">No tempo: ±{{ midi.toleranceMs }} ms</p>
    </div>
    <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs">
      <span v-for="grade in grades" :key="grade" class="inline-flex items-center gap-1.5">
        <span class="practice-key" :class="`practice-key--${grade}`" aria-hidden="true">{{
          grade === 'missed'
            ? '○'
            : grade === 'extra'
              ? '+'
              : grade === 'wrong-voice' || grade === 'wrong-articulation'
                ? '◇'
                : grade === 'early'
                  ? '‹'
                  : grade === 'late'
                    ? '›'
                    : '●'
        }}</span>
        {{ GRADE_LABELS[grade] }} <strong class="tabular">{{ counts[grade] }}</strong>
      </span>
    </div>
    <p v-if="last" class="text-sm">
      <strong>{{ VOICE_BY_ID[last.voiceId].label }}</strong
      >: {{ resultLabel(last)
      }}<template v-if="last.grade === 'wrong-voice' && last.expectedVoice"
        >. Esperado: {{ VOICE_BY_ID[last.expectedVoice].label }}</template
      ><template v-if="last.grade === 'wrong-articulation'"
        >. Esperado {{ hatName(last.expectedMidi) }}, recebido {{ hatName(last.rawNote) }}</template
      >.
    </p>
    <p v-else class="text-xs text-muted-foreground">
      Toque durante a música. A contagem inicial e a pausa de revisão ficam fora da avaliação.
    </p>
    <p v-if="timing.length >= 8" class="text-xs text-muted-foreground">
      Desvio central: {{ medianMs > 0 ? '+' : '' }}{{ medianMs }} ms. Dispersão típica:
      {{ spreadMs }} ms.
      <span v-if="Math.abs(medianMs) > midi.toleranceMs && spreadMs < Math.abs(medianMs) / 2"
        >Há um deslocamento consistente. Confira a calibração MIDI antes de interpretar como erro de
        execução.</span
      >
    </p>
    <p v-if="midi.markers.length" class="text-xs text-muted-foreground">
      Totais incluem todas as repetições. A partitura mostra a avaliação mais recente de cada nota.
      O resultado permanece até o próximo Play.
    </p>
  </section>
</template>

<style scoped>
.practice-key {
  display: inline-flex;
  width: 1rem;
  justify-content: center;
  font-weight: 700;
}
.practice-key--perfect {
  color: hsl(160 70% 45%);
}
.practice-key--early {
  color: hsl(200 85% 58%);
}
.practice-key--late {
  color: hsl(28 90% 56%);
}
.practice-key--wrong-voice,
.practice-key--wrong-articulation {
  color: hsl(285 65% 55%);
}
.practice-key--missed {
  color: hsl(var(--muted-foreground));
}
.practice-key--extra {
  color: hsl(var(--destructive));
}
</style>
