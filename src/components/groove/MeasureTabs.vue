<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Plus } from 'lucide-vue-next'
import { useGrooveStore } from '@/stores/groove'

const MAX_MEASURES = 8

const store = useGrooveStore()
const { groove, selectedMeasure } = storeToRefs(store)

const tabs = computed(() => Array.from({ length: groove.value.measures }, (_, i) => i))
const canAdd = computed(() => groove.value.measures < MAX_MEASURES)

function addMeasure() {
  if (!canAdd.value) return
  const next = groove.value.measures + 1
  store.setMeasures(next)
  store.setSelectedMeasure(next - 1)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <span class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground pr-2">
      Measures
    </span>
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
.measure-tab--add:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
