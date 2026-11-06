import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TopBar from '@/components/shell/TopBar.vue'
import Score from '@/components/groove/Score.vue'

let wrapper: VueWrapper
beforeEach(() => setActivePinia(createPinia()))
afterEach(() => wrapper?.unmount())

describe('phone layout', () => {
  it('keeps toolbar actions named while hiding their text at phone widths', () => {
    wrapper = mount(TopBar)
    for (const label of ['Clear all notes', 'Settings', 'Share']) {
      const button = wrapper.get(`button[aria-label="${label}"]`)
      expect(button.get('span').classes()).toContain('sr-only')
      expect(button.get('span').classes()).toContain('sm:not-sr-only')
    }
  })

  it('marks the full score as vertically scrollable on phones without clipping follow mode', () => {
    wrapper = mount(Score)
    const host = wrapper.get('.score-host')
    expect(host.classes()).toContain('score-host--phone-scroll')
    expect(host.classes()).not.toContain('score-host--following')
  })
})
