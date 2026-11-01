import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Transport from '@/components/groove/Transport.vue'
import { useGrooveStore } from '@/stores/groove'
import { useScoreViewStore } from '@/stores/scoreView'

let wrapper: VueWrapper
beforeEach(() => {
  setActivePinia(createPinia())
})
afterEach(() => wrapper?.unmount())

describe('compact transport', () => {
  it('keeps the primary controls available with advanced options collapsed', async () => {
    wrapper = mount(Transport, { props: { isPlaying: false } })
    expect(wrapper.get('button[aria-controls]').text()).toBe('More')
    expect(wrapper.get('button[aria-controls]').attributes('aria-expanded')).toBe('false')
    expect(
      (wrapper.get('[data-tour="playback-options"]').element as HTMLElement).style.display,
    ).toBe('none')
    expect(wrapper.get('input[aria-label="Tempo"]').isVisible()).toBe(true)
    expect(wrapper.get('button[aria-label="Metronome"]').isVisible()).toBe(true)
    expect(wrapper.get('.loop-btn').isVisible()).toBe(true)
    await wrapper.get('button[aria-label="Play"]').trigger('click')
    expect(wrapper.emitted('play')).toHaveLength(1)
  })

  it('accepts a typed tempo, synchronizes the slider and rejects an empty value', async () => {
    wrapper = mount(Transport, { props: { isPlaying: false } })
    const input = wrapper.get('input[aria-label="Tempo BPM"]')
    await input.setValue('137')
    expect(useGrooveStore().groove.tempo).toBe(137)
    expect((wrapper.get('input[aria-label="Tempo"]').element as HTMLInputElement).value).toBe('137')
    await input.setValue('999')
    expect(useGrooveStore().groove.tempo).toBe(300)
    expect((input.element as HTMLInputElement).value).toBe('300')
    await input.setValue('')
    expect(useGrooveStore().groove.tempo).toBe(300)
    expect((input.element as HTMLInputElement).value).toBe('300')
    await wrapper.get('input[aria-label="Tempo"]').setValue('120')
    expect((input.element as HTMLInputElement).value).toBe('120')
  })

  it('keeps Play, Stop and BPM available in narrow embeds without an editor bottom bar', async () => {
    wrapper = mount(Transport, { props: { isPlaying: false, embedded: true, readOnly: true } })
    expect(wrapper.get('button[aria-label="Play"]').classes()).not.toContain('hidden')
    expect(
      wrapper
        .get('input[aria-label="Tempo BPM"]')
        .element.parentElement?.classList.contains('hidden'),
    ).toBe(false)
    await wrapper.get('button[aria-label="Play"]').trigger('click')
    expect(wrapper.emitted('play')).toHaveLength(1)
    await wrapper.setProps({ isPlaying: true })
    expect(wrapper.get('button[aria-label="Stop"]').classes()).not.toContain('hidden')
    await wrapper.get('button[aria-label="Stop"]').trigger('click')
    expect(wrapper.emitted('stop')).toHaveLength(1)
  })

  it('preserves advanced settings across More and Less', async () => {
    wrapper = mount(Transport, { props: { isPlaying: false } })
    await wrapper.get('button[aria-controls]').trigger('click')
    expect(wrapper.get('button[aria-controls]').text()).toBe('Less')
    expect(
      (wrapper.get('[data-tour="playback-options"]').element as HTMLElement).style.display,
    ).not.toBe('none')
    await wrapper.get('input[aria-label="Swing"]').setValue('30')
    await wrapper.get('button[aria-label="Follow playhead"]').trigger('click')
    await wrapper.get('button[aria-controls]').trigger('click')
    expect(
      (wrapper.get('[data-tour="playback-options"]').element as HTMLElement).style.display,
    ).toBe('none')
    expect(useGrooveStore().groove.swing).toBe(30)
    expect(useScoreViewStore().followPlayhead).toBe(true)
    await wrapper.get('button[aria-controls]').trigger('click')
    expect(wrapper.get('button[aria-label="Follow playhead"]').attributes('aria-checked')).toBe(
      'true',
    )
    expect((wrapper.get('input[aria-label="Swing"]').element as HTMLInputElement).value).toBe('30')
  })

  it('reveals training fields when enabled and retains their values when disabled', async () => {
    wrapper = mount(Transport, { props: { isPlaying: false } })
    await wrapper.get('button[aria-controls]').trigger('click')
    const fields = wrapper.get('.training-fields')
    expect((fields.element as HTMLElement).style.display).toBe('none')
    await wrapper.get('button[aria-label="Speed training"]').trigger('click')
    expect((fields.element as HTMLElement).style.display).not.toBe('none')
    const target = wrapper.get('input[aria-label="Speed training, target tempo"]')
    await target.setValue('160')
    await wrapper.get('button[aria-label="Speed training"]').trigger('click')
    expect((fields.element as HTMLElement).style.display).toBe('none')
    await wrapper.get('button[aria-label="Speed training"]').trigger('click')
    expect((target.element as HTMLInputElement).value).toBe('160')
  })

  it('preserves read-only embed restrictions when expanded', async () => {
    wrapper = mount(Transport, { props: { isPlaying: false, readOnly: true } })
    await wrapper.get('button[aria-controls]').trigger('click')
    expect(wrapper.find('.loop-btn').exists()).toBe(false)
    expect(wrapper.find('input[aria-label="Swing"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Metronome"]').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="Follow playhead"]').isVisible()).toBe(true)
  })
})
