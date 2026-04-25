import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './styles/tailwind.css'

// Apply theme and embed classes synchronously before Vue mounts. Safari
// resolves hsl(var(--token)) values at first paint and does not always
// re-cascade when classes are added later in onMounted, which produced an
// unstyled second iframe on pages with two embeds.
function applyInitialClasses() {
  const hash = window.location.hash
  const qIndex = hash.indexOf('?')
  const params = new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex + 1) : '')
  const theme = params.get('theme') ?? 'dark'
  const dark =
    theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)

  const path = qIndex >= 0 ? hash.slice(0, qIndex) : hash
  if (path.startsWith('#/embed/')) {
    document.documentElement.classList.add('is-embed')
    document.body.classList.add('is-embed')
  }
}
applyInitialClasses()

createApp(App).use(createPinia()).use(router).mount('#app')
