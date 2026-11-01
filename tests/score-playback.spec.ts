import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import Score from '@/components/groove/Score.vue'
import { useScoreViewStore } from '@/stores/scoreView'

vi.mock('@/lib/vex-builder', () => ({
  renderScore: () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '2400')
    return {
      svg,
      stepMarkers: [10, 100].map((x) => ({ x, y: 0, width: 18, height: 120 })),
      measureBounds: [],
      voiceY: {},
    }
  },
}))

let wrapper: VueWrapper
beforeEach(() => {
  setActivePinia(createPinia())
})
afterEach(() => wrapper?.unmount())

describe('playback-only follow option', () => {
  it('defaults to full score even while playing', async () => {
    wrapper = mount(Score, { props: { isPlaying: true, activeStep: 0 } })
    await nextTick()
    expect(useScoreViewStore().followPlayhead).toBe(false)
    expect(wrapper.find('.score-host--following').exists()).toBe(false)
    expect(wrapper.find('.score-marker').exists()).toBe(true)
  })

  it('waits for Play before following and removes the playhead on Stop', async () => {
    wrapper = mount(Score, { props: { isPlaying: false, activeStep: 0, selectable: false } })
    useScoreViewStore().setFollowPlayhead(true)
    await nextTick()
    expect(wrapper.find('.score-host--following').exists()).toBe(false)
    expect(wrapper.find('.score-marker').exists()).toBe(false)

    await wrapper.setProps({ isPlaying: true })
    expect(wrapper.find('.score-host--following').exists()).toBe(true)
    expect(wrapper.find('.score-marker').exists()).toBe(true)

    await wrapper.setProps({ isPlaying: false })
    expect(wrapper.find('.score-host--following').exists()).toBe(false)
    expect(wrapper.find('.score-marker').exists()).toBe(false)
    expect(wrapper.get('.score-wrap').attributes('style')).not.toContain('translateX')
    expect(useScoreViewStore().followPlayhead).toBe(true)
  })

  it('moves the track as the current note changes', async () => {
    useScoreViewStore().setFollowPlayhead(true)
    wrapper = mount(Score, { props: { isPlaying: true, activeStep: 0 } })
    await nextTick()
    const before = wrapper.get('.score-wrap').attributes('style')
    await wrapper.setProps({ activeStep: 1 })
    expect(wrapper.get('.score-wrap').attributes('style')).not.toBe(before)
  })
})
