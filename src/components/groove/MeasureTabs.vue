<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useGrooveStore } from '@/stores/groove'

const MAX_MEASURES = 8

const store = useGrooveStore()
const { groove, selectedMeasure } = storeToRefs(store)

const tabs = computed(() => Array.from({ length: groove.value.measures }, (_, i) => i))
const canAdd = computed(() => groove.value.measures < MAX_MEASURES)
const canPrev = computed(() => selectedMeasure.value > 0)
const canNext = computed(() => selectedMeasure.value < groove.value.measures - 1)

function addMeasure() {
  if (!canAdd.value) return
  const next = groove.value.measures + 1
  store.setMeasures(next)
  store.setSelectedMeasure(next - 1)
}

function step(delta: number) {
  store.setSelectedMeasure(selectedMeasure.value + delta)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <span
      class="hidden sm:inline text-[10px] font-mono uppercase tracking-widest text-muted-foreground pr-2"
    >
      Measures
    </span>

    <!-- Paging arrows. Numbered tabs are fine with a mouse and fiddly with a
         thumb, especially once eight of them wrap onto two rows. -->
    <button
      type="button"
      class="measure-tab measure-tab--page"
      :disabled="!canPrev"
      aria-label="Previous measure"
      title="Previous measure"
      @click="step(-1)"
    >
      <ChevronLeft class="h-4 w-4" :stroke-width="2.5" />
    </button>
    <button
      v-for="m in tabs"
      :key="m"
      type="button"
      class="measure-tab"
      :class="{ 'is-active': m === selectedMeasure }"
      @click="store.setSelectedMeasure(m)"
    >
      {{ m + 1 }}
    </button>
    <button
      type="button"
      class="measure-tab measure-tab--page"
      :disabled="!canNext"
      aria-label="Next measure"
      title="Next measure"
      @click="step(1)"
    >
      <ChevronRight class="h-4 w-4" :stroke-width="2.5" />
    </button>

    <button
      type="button"
      class="measure-tab measure-tab--add"
      :disabled="!canAdd"
      :title="canAdd ? 'Add measure' : `Max ${MAX_MEASURES} measures`"
      aria-label="Add measure"
      @click="addMeasure"
    >
      <Plus class="h-3 w-3" :stroke-width="2.5" />
    </button>
  </div>
</template>

<style scoped>
.measure-tab {
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  cursor: pointer;
  transition:
    color 120ms ease-out,
    background 120ms ease-out,
    border-color 120ms ease-out;
}
.measure-tab:hover:not(:disabled) {
  color: hsl(var(--foreground));
  border-color: hsl(var(--primary) / 0.5);
}
.measure-tab.is-active {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
}
.measure-tab--add {
  color: hsl(var(--muted-foreground));
}
.measure-tab--add:disabled,
.measure-tab--page:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.measure-tab--page {
  color: hsl(var(--foreground));
}
@media (pointer: coarse) {
  .measure-tab {
    min-width: 44px;
    height: 44px;
    font-size: 13px;
  }
}
</style>
