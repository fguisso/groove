<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useGrooveStore } from '@/stores/groove'
import { useMidiInput } from '@/composables/useMidiInput'
import { buildSchedule, gradeHits, summarize, type GradeReport } from '@/lib/midi-grader'

const store = useGrooveStore()
const { groove } = storeToRefs(store)

const { supported, connected, error, deviceName, hits, connect, disconnect, clearHits } =
  useMidiInput()

const LATENCY_KEY = 'groove:midiLatency'
const TOLERANCE_KEY = 'groove:midiTolerance'

const latencyMs = ref(readNumber(LATENCY_KEY, 0))
const toleranceMs = ref(readNumber(TOLERANCE_KEY, 40))

watchEffect(() => writeNumber(LATENCY_KEY, latencyMs.value))
watchEffect(() => writeNumber(TOLERANCE_KEY, toleranceMs.value))

function readNumber(key: string, fallback: number): number {
  if (typeof localStorage === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  const n = raw == null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function writeNumber(key: string, v: number) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, String(v))
}

const practicing = ref(false)
const startedAtMs = ref(0)
const report = ref<GradeReport | null>(null)

function start() {
  clearHits()
  startedAtMs.value = performance.now()
  practicing.value = true
  report.value = null
}

function finish() {
  practicing.value = false
  const schedule = buildSchedule(groove.value, startedAtMs.value)
  const adjusted = hits.value.map((h) => ({ voiceId: h.voiceId, atMs: h.atMs - latencyMs.value }))
  report.value = gradeHits(schedule, adjusted, toleranceMs.value)
}

const summary = computed(() => (report.value ? summarize(report.value) : null))
</script>

<template>
  <section class="panel space-y-3 p-3">
    <header class="flex items-center justify-between">
      <h3 class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        Practice (MIDI)
      </h3>
      <span v-if="connected" class="text-[10px] font-mono text-primary">
        {{ deviceName }}
      </span>
    </header>

    <p v-if="!supported" class="text-xs text-warn">
      Web MIDI is not supported in this browser. Try Chrome, Edge, or Firefox.
    </p>

    <div v-else-if="!connected" class="space-y-2">
      <button
        type="button"
        class="rounded-md border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
        @click="connect"
      >
        Connect MIDI device
      </button>
      <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
    </div>

    <div v-else class="space-y-3">
      <div class="grid grid-cols-2 gap-3 text-xs">
        <label class="space-y-1">
          <span class="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Latency offset (ms)
          </span>
          <input
            v-model.number="latencyMs"
            type="number"
            class="w-full rounded-md border bg-background px-2 py-1 font-mono"
            step="5"
          />
        </label>
        <label class="space-y-1">
          <span class="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Tolerance (ms)
          </span>
          <input
            v-model.number="toleranceMs"
            type="number"
            min="10"
            max="200"
            step="5"
            class="w-full rounded-md border bg-background px-2 py-1 font-mono"
          />
        </label>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="!practicing"
          type="button"
          class="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
          @click="start"
        >
          Start practice
        </button>
        <button
          v-else
          type="button"
          class="rounded-md bg-warn px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
          @click="finish"
        >
          Finish ({{ hits.length }} hits)
        </button>
        <button
          type="button"
          class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          @click="disconnect"
        >
          Disconnect
        </button>
      </div>

      <div v-if="summary" class="rounded-md border bg-muted/30 p-2 text-xs">
        <div class="flex items-baseline gap-2">
          <span class="font-mono text-2xl font-semibold tabular text-primary">
            {{ summary.score }}%
          </span>
          <span class="text-muted-foreground">accuracy</span>
        </div>
        <dl class="mt-2 grid grid-cols-2 gap-x-4 font-mono text-[11px]">
          <div class="flex justify-between">
            <dt class="text-muted-foreground">correct</dt>
            <dd>{{ summary.correct }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted-foreground">missed</dt>
            <dd>{{ summary.missed }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted-foreground">wrong voice</dt>
            <dd>{{ summary.wrongVoice }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted-foreground">extras</dt>
            <dd>{{ summary.extras }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
