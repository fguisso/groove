<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ExternalLink } from 'lucide-vue-next'
import { useGrooveStore } from '@/stores/groove'
import { useUrlSync } from '@/composables/useUrlSync'
import { usePlayback } from '@/composables/usePlayback'
import Score from '@/components/groove/Score.vue'
import Transport from '@/components/groove/Transport.vue'

const store = useGrooveStore()
const { groove } = storeToRefs(store)
const route = useRoute()

// Read-only when ?ro=1 appears in the hash's query part
const readOnly = computed(() => route.query.ro === '1')

const editorUrl = computed(() => {
  const payload = route.params.payload as string | undefined
  const base = `${location.origin}${location.pathname}`
  return payload ? `${base}#/g/${payload}` : `${base}#/`
})

useUrlSync({ writeBack: false })

const { isPlaying, currentStep, countInBeat, play, stop } = usePlayback()

const host = ref<HTMLDivElement | null>(null)
let ro: ResizeObserver | null = null

function postHeight() {
  if (!host.value) return
  const h = host.value.getBoundingClientRect().height
  window.parent?.postMessage({ type: 'groove:resize', height: Math.ceil(h) }, '*')
}

onMounted(() => {
  // Mark the document as embed so global styles can strip the body gradient
  // and background color, letting the host page show through.
  document.documentElement.classList.add('is-embed')
  document.body.classList.add('is-embed')
  ro = new ResizeObserver(() => postHeight())
  if (host.value) ro.observe(host.value)
  postHeight()
})
onBeforeUnmount(() => {
  ro?.disconnect()
  document.documentElement.classList.remove('is-embed')
  document.body.classList.remove('is-embed')
})

watch(groove, postHeight, { deep: true })
</script>

<template>
  <div ref="host" class="w-full p-3 space-y-3 relative">
    <div class="flex items-center gap-3 text-sm">
      <div v-if="groove.title || groove.author" class="min-w-0 flex-1 truncate">
        <span class="font-semibold">{{ groove.title }}</span>
        <span v-if="groove.author" class="text-muted-foreground"> — {{ groove.author }}</span>
      </div>
      <a
        :href="editorUrl"
        target="_blank"
        rel="noopener"
        class="ml-auto inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
        title="Open this groove in the editor"
      >
        <ExternalLink class="h-3 w-3" :stroke-width="2" />
        <span>Edit</span>
      </a>
    </div>
    <Score :active-step="currentStep" :is-playing="isPlaying" :selectable="false" />
    <Transport :is-playing="isPlaying" :read-only="readOnly" @play="play(groove)" @stop="stop()" />

    <Transition name="count-fade">
      <div
        v-if="countInBeat > 0"
        class="count-in-overlay pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
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
  font-size: 6rem;
  line-height: 1;
  letter-spacing: -0.05em;
  color: hsl(var(--destructive));
  text-shadow:
    0 0 24px hsl(var(--destructive) / 0.55),
    0 0 60px hsl(var(--destructive) / 0.3);
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
