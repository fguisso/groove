<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  value: number
  kind: 'hat' | 'note' | 'sticking'
  active?: boolean
  beat?: boolean
  downbeat?: boolean
  beatStart?: boolean
  label?: string
}>()
const emit = defineEmits<{ (e: 'click'): void }>()

const symbol = computed(() => {
  if (props.kind === 'sticking') return props.label ?? ''
  if (props.kind === 'hat') {
    return ({ 0: '', 1: 'x', 2: 'o', 3: 'X', 4: 'f' } as Record<number, string>)[props.value] ?? ''
  }
  return ({ 0: '', 1: '●', 2: '◆', 3: '○' } as Record<number, string>)[props.value] ?? ''
})

const filled = computed(() => props.value !== 0 && props.kind !== 'sticking')
const accent = computed(
  () => (props.kind === 'hat' && props.value === 3) || (props.kind === 'note' && props.value === 2),
)
</script>

<template>
  <button
    type="button"
    :class="
      cn(
        'led-cell h-9 w-full select-none text-[11px] font-mono font-semibold',
        'flex items-center justify-center',
        beat && 'beat',
        beatStart && !downbeat && 'ml-5',
        beatStart && downbeat && 'ml-8',
        filled && 'filled',
        filled && accent && 'accent',
        active && 'active-step',
      )
    "
    @click="emit('click')"
  >
    <span>{{ symbol }}</span>
  </button>
</template>
