import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useScoreViewStore = defineStore('scoreView', () => {
  const followPlayhead = ref(false)

  function setFollowPlayhead(enabled: boolean) {
    followPlayhead.value = enabled
  }

  return { followPlayhead, setFollowPlayhead }
})
