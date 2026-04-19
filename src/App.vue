<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  const hash = window.location.hash
  const qIndex = hash.indexOf('?')
  const params = new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex + 1) : '')
  const theme = params.get('theme') ?? 'dark'
  const dark =
    theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
})
</script>

<template>
  <router-view />
</template>
