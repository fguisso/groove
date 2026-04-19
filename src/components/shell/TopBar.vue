<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Share2, Download, Image as ImageIcon, Trash2 } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import GrooveLogo from '@/components/shell/GrooveLogo.vue'
import { useGrooveStore } from '@/stores/groove'

defineEmits<{
  (e: 'share'): void
  (e: 'exportMidi'): void
  (e: 'exportPng'): void
}>()

const store = useGrooveStore()
const { groove } = storeToRefs(store)

function onClear() {
  const hasAny =
    groove.value.voices.hh.some((v) => v !== 0) ||
    groove.value.voices.sn.some((v) => v !== 0) ||
    groove.value.voices.kk.some((v) => v !== 0) ||
    groove.value.sticking.some((s) => s !== '-')
  if (!hasAny) return
  if (window.confirm('Clear all notes from this groove? This cannot be undone.')) {
    store.clearAll()
  }
}
</script>

<template>
  <header class="app-toolbar sticky top-0 z-20 flex flex-wrap items-center gap-3 px-4 py-2.5">
    <a href="#/" class="flex items-center gap-2 text-foreground hover:text-primary transition-colors" aria-label="Go home">
      <GrooveLogo :width="84" />
      <span class="hidden sm:inline text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border rounded px-1.5 py-0.5">
        v0.1
      </span>
    </a>

    <div class="flex-1 flex flex-wrap items-center gap-2 min-w-[200px]">
      <Input
        class="max-w-[240px]"
        placeholder="Untitled groove"
        :model-value="groove.title"
        @update:model-value="store.setTitle(String($event))"
      />
      <Input
        class="max-w-[180px]"
        placeholder="Author"
        :model-value="groove.author"
        @update:model-value="store.setAuthor(String($event))"
      />
    </div>

    <div class="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" title="Clear all notes — asks for confirmation" @click="onClear">
        <Trash2 class="h-3.5 w-3.5" /> Clear
      </Button>
      <Button variant="outline" size="sm" @click="$emit('exportPng')">
        <ImageIcon class="h-3.5 w-3.5" /> PNG
      </Button>
      <Button variant="outline" size="sm" @click="$emit('exportMidi')">
        <Download class="h-3.5 w-3.5" /> MIDI
      </Button>
      <Button size="sm" @click="$emit('share')">
        <Share2 class="h-3.5 w-3.5" /> Share
      </Button>
    </div>
  </header>
</template>
