import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGrooveStore } from '@/stores/groove'
import { decode, encode } from '@/lib/codec'

export function useUrlSync(opts: { writeBack?: boolean } = { writeBack: true }) {
  const route = useRoute()
  const router = useRouter()
  const store = useGrooveStore()

  const payload = route.params.payload as string | undefined
  if (payload) {
    const g = decode(payload)
    if (g) store.replace(g)
  }

  if (opts.writeBack) {
    let timer: ReturnType<typeof setTimeout> | null = null
    watch(
      () => store.groove,
      (g) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          const next = encode(g)
          const name = route.name?.toString().startsWith('embed') ? 'embed-with-payload' : 'editor-with-payload'
          router.replace({ name, params: { payload: next } })
        }, 300)
      },
      { deep: true }
    )
  }
}
