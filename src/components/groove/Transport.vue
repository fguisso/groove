<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Play, Square, Repeat, Waves, SlidersHorizontal, Gauge } from 'lucide-vue-next'
import { useGrooveStore } from '@/stores/groove'
import { usePracticeTimerStore } from '@/stores/practiceTimer'
import { useMidiStore } from '@/stores/midi'
import { useSpeedTrainerStore } from '@/stores/speedTrainer'
import Slider from '@/components/ui/Slider.vue'
import Switch from '@/components/ui/Switch.vue'
import MetronomeIcon from '@/components/icons/MetronomeIcon.vue'
import { useScoreViewStore } from '@/stores/scoreView'

const props = defineProps<{
  isPlaying: boolean
  readOnly?: boolean
  embedded?: boolean
}>()
const emit = defineEmits<{ (e: 'play'): void; (e: 'stop'): void }>()

const store = useGrooveStore()
const { groove } = storeToRefs(store)
const timerStore = usePracticeTimerStore()
const { enabled: timerEnabled, minutes: timerMinutes } = storeToRefs(timerStore)
const midi = useMidiStore()
const { practiceMode, practiceTimerSec } = storeToRefs(midi)
const speed = useSpeedTrainerStore()
const scoreView = useScoreViewStore()
const {
  enabled: speedEnabled,
  everyLoops: speedEvery,
  stepBpm: speedStep,
  targetBpm: speedTarget,
} = storeToRefs(speed)

const optionsOpen = ref(false)
const optionsId = useId()

function toggleOptions() {
  optionsOpen.value = !optionsOpen.value
}

// Auto-disable the timer if the user turns loop off — without a loop the timer
// has nothing useful to bound, and leaving it visually "on" would mislead.
watch(
  () => groove.value.loop,
  (loopOn) => {
    if (!loopOn && timerEnabled.value) timerStore.setEnabled(false)
  },
)

function onToggleTimer(v: boolean) {
  if (v && !groove.value.loop) return
  timerStore.setEnabled(v)
}

function onTempoChange(e: Event) {
  const input = e.target as HTMLInputElement
  const value = input.valueAsNumber
  if (Number.isFinite(value)) store.setTempo(value)
  input.value = String(groove.value.tempo)
}

function onMinutesInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  timerStore.setMinutes(v)
}

function onPauseSecInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  midi.setPracticeTimerSec(v)
}
</script>

<template>
  <section class="panel space-y-3 p-3" data-tour="transport">
    <div class="transport-main flex flex-wrap items-center gap-3">
      <!-- Play and the tempo readout live in the bottom bar on a phone, inside the
         thumb's reach. Rendering them here too would be a duplicate control. -->
      <button
        v-if="!props.isPlaying"
        type="button"
        class="transport-play"
        :class="props.embedded ? 'inline-flex' : 'hidden md:inline-flex'"
        aria-label="Play"
        @click="emit('play')"
      >
        <Play class="h-5 w-5 translate-x-0.5" :stroke-width="2.5" />
      </button>
      <button
        v-else
        type="button"
        class="transport-play playing"
        :class="props.embedded ? 'inline-flex' : 'hidden md:inline-flex'"
        aria-label="Stop"
        @click="emit('stop')"
      >
        <Square class="h-4 w-4" :stroke-width="2.5" fill="currentColor" />
      </button>

      <div class="items-baseline gap-1 px-1" :class="props.embedded ? 'flex' : 'hidden md:flex'">
        <input
          type="number"
          aria-label="Tempo BPM"
          title="Type a tempo, then press Enter"
          class="tempo-display tempo-input text-3xl"
          inputmode="numeric"
          min="30"
          max="300"
          step="1"
          :value="groove.tempo"
          @change="onTempoChange"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <span class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
          >bpm</span
        >
      </div>

      <!-- Loop carries its own word, not just the icon: the label is most of the
         click target, and it is the toggle people reach for constantly. -->
      <button
        v-if="!props.readOnly"
        type="button"
        class="loop-btn touch-target"
        :class="{ 'is-on': groove.loop }"
        :aria-pressed="groove.loop"
        :title="
          groove.loop ? 'Loop is on, click to play once through' : 'Loop the groove continuously'
        "
        @click="store.toggleLoop()"
      >
        <Repeat class="h-3.5 w-3.5" />
        <span>Loop</span>
      </button>

      <div class="flex min-w-[140px] flex-1 items-center gap-2">
        <label class="text-[10px] font-mono uppercase tracking-widest text-muted-foreground w-14"
          >Tempo</label
        >
        <Slider
          aria-label="Tempo"
          :model-value="groove.tempo"
          :min="30"
          :max="300"
          :step="1"
          @update:model-value="store.setTempo($event)"
        />
      </div>

      <label
        v-if="!props.readOnly"
        class="opt"
        :title="
          groove.metronome
            ? 'Metronome: on, click to silence'
            : 'Metronome: off. Clicks beats during playback'
        "
      >
        <span class="opt__name">
          <MetronomeIcon class="h-3.5 w-3.5" />
          <span>Metro</span>
        </span>
        <span class="opt__ctl">
          <Switch
            aria-label="Metronome"
            :model-value="groove.metronome"
            @update:model-value="store.toggleMetronome()"
          />
        </span>
      </label>
      <button
        type="button"
        class="touch-target ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :aria-expanded="optionsOpen"
        :aria-controls="optionsId"
        @click="toggleOptions"
      >
        <SlidersHorizontal class="h-3.5 w-3.5" />
        {{ optionsOpen ? 'Less' : 'More' }}
      </button>
    </div>
    <div v-show="optionsOpen" :id="optionsId" class="advanced-options" data-tour="playback-options">
      <section class="settings-section" aria-label="Playback options">
        <h3 class="settings-title">Playback</h3>
        <div class="setting-row">
          <span class="setting-name"> Follow playhead </span>
          <Switch
            aria-label="Follow playhead"
            :model-value="scoreView.followPlayhead"
            @update:model-value="scoreView.setFollowPlayhead($event)"
          />
        </div>
        <div v-if="!props.readOnly" class="setting-row">
          <span class="setting-name">Count-in</span>
          <Switch
            aria-label="Count-in"
            :model-value="groove.countIn"
            @update:model-value="store.toggleCountIn()"
          />
        </div>
        <div v-if="!props.readOnly" class="swing-setting">
          <div class="setting-row">
            <span class="setting-name"><Waves class="h-3.5 w-3.5" />Swing</span>
            <span class="setting-value">{{ groove.swing }}%</span>
          </div>
          <Slider
            aria-label="Swing"
            :model-value="groove.swing"
            :min="0"
            :max="80"
            :step="1"
            @update:model-value="store.setSwing($event)"
          />
        </div>
      </section>
      <section class="settings-section" aria-label="Practice options">
        <h3 class="settings-title">Loop practice</h3>
        <div class="setting-row">
          <span class="setting-name">Pause between loops</span>
          <Switch
            aria-label="Pause between loops"
            :model-value="practiceMode"
            @update:model-value="midi.setPracticeMode($event)"
          />
        </div>
        <label v-show="practiceMode" class="detail-row">
          <span>Pause duration</span>
          <span class="unit-input">
            <input
              type="number"
              min="1"
              max="60"
              step="1"
              inputmode="numeric"
              aria-label="Pause between loops, seconds"
              class="setting-number"
              :value="practiceTimerSec"
              @input="onPauseSecInput"
            />
            <span>sec</span>
          </span>
        </label>
        <div class="setting-row" :class="{ 'setting-row--disabled': !groove.loop }">
          <span class="setting-name">Practice timer</span>
          <Switch
            aria-label="Practice timer"
            :disabled="!groove.loop"
            :model-value="timerEnabled"
            @update:model-value="onToggleTimer($event)"
          />
        </div>
        <label v-show="timerEnabled && groove.loop" class="detail-row">
          <span>Stop after</span>
          <span class="unit-input">
            <input
              type="number"
              min="1"
              max="60"
              step="1"
              inputmode="numeric"
              aria-label="Practice timer minutes"
              class="setting-number"
              :disabled="!groove.loop"
              :value="timerMinutes"
              @input="onMinutesInput"
            />
            <span>min</span>
          </span>
        </label>
        <p v-if="!groove.loop" class="setting-hint">Enable Loop to use the timer.</p>
      </section>
      <section v-if="!props.readOnly" class="settings-section" aria-label="Speed training options">
        <div class="speed-setting">
          <div class="setting-row">
            <h3 class="settings-title"><Gauge class="h-3.5 w-3.5" />Speed training</h3>
            <Switch
              aria-label="Speed training"
              :model-value="speedEnabled"
              @update:model-value="speed.setEnabled($event)"
            />
          </div>
          <p class="setting-hint speed-description">Increase the tempo gradually as you repeat.</p>
          <div v-show="speedEnabled" class="training-fields">
            <label class="training-field">
              <span>Add BPM</span>
              <input
                type="number"
                min="1"
                max="40"
                step="1"
                inputmode="numeric"
                aria-label="Speed training, BPM added each time"
                class="setting-number"
                :value="speedStep"
                @input="speed.setStepBpm(Number(($event.target as HTMLInputElement).value))"
              />
            </label>
            <label class="training-field">
              <span>Every (loops)</span>
              <input
                type="number"
                min="1"
                max="32"
                step="1"
                inputmode="numeric"
                aria-label="Speed training, loops between increases"
                class="setting-number"
                :value="speedEvery"
                @input="speed.setEveryLoops(Number(($event.target as HTMLInputElement).value))"
              />
            </label>
            <label class="training-field">
              <span>Target BPM</span>
              <input
                type="number"
                min="40"
                max="260"
                step="1"
                inputmode="numeric"
                aria-label="Speed training, target tempo"
                class="setting-number"
                :value="speedTarget"
                @input="speed.setTargetBpm(Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </div>
        </div>
      </section>
      <section v-if="!props.readOnly" class="settings-section" aria-label="Editor display options">
        <h3 class="settings-title">Editor lanes</h3>
        <label class="setting-row lane-option">
          <span>Show cymbals</span>
          <Switch
            aria-label="Show cymbals"
            :model-value="midi.showCymbals"
            @update:model-value="midi.setShowCymbals($event)"
          />
        </label>
        <label class="setting-row lane-option">
          <span>Show toms</span>
          <Switch
            aria-label="Show toms"
            :model-value="midi.showToms"
            @update:model-value="midi.setShowToms($event)"
          />
        </label>
        <p class="setting-hint">Grid only. All notes still appear in the score and play.</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.tempo-input {
  width: 3.5ch;
  padding: 2px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  text-align: center;
  appearance: textfield;
  -moz-appearance: textfield;
}
.tempo-input:hover {
  border-color: hsl(var(--border));
}
.tempo-input:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
  background: hsl(var(--background));
}
.tempo-input::-webkit-outer-spin-button,
.tempo-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.loop-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 34px;
  padding: 0 0.7rem;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 0.2rem);
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition:
    color 120ms ease-out,
    background 120ms ease-out,
    border-color 120ms ease-out;
}
.loop-btn:hover:not(.is-on) {
  color: hsl(var(--foreground));
  border-color: hsl(var(--primary) / 0.5);
}
.loop-btn.is-on {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
}

.opt {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}
.opt__name,
.opt__ctl {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.advanced-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid hsl(var(--border));
}
.lane-option {
  cursor: pointer;
  font-size: 13px;
}
.settings-section {
  min-width: 0;
  padding: 16px;
  border-radius: 8px;
  background: hsl(var(--muted) / 0.3);
  border: 1px solid hsl(var(--border) / 0.55);
}
.settings-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
}
.setting-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: hsl(var(--foreground));
  font-size: 13px;
  line-height: 20px;
}
.setting-name svg {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}
.setting-value,
.setting-number {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}
.setting-value {
  color: hsl(var(--muted-foreground));
}
.swing-setting {
  margin-top: 8px;
}
.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
.unit-input {
  position: relative;
  display: inline-flex;
  width: 88px;
  flex-shrink: 0;
}
.unit-input .setting-number {
  padding-right: 32px;
}
.unit-input > span {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 11px;
}
.setting-number {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 0 8px;
  text-align: center;
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 5px;
  appearance: textfield;
  -moz-appearance: textfield;
}
.setting-number::-webkit-outer-spin-button,
.setting-number::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.setting-number:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
.setting-row--disabled {
  opacity: 0.45;
}
.setting-number:disabled {
  cursor: not-allowed;
}
.setting-hint {
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
}
.speed-setting > .setting-row {
  min-height: 20px;
}
.speed-setting .settings-title {
  margin-bottom: 0;
}
.speed-description {
  margin: 12px 0 0;
  max-width: 28ch;
}
.training-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
}
.training-field {
  display: grid;
  gap: 6px;
}
.training-field > span {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  line-height: 16px;
}
@media (max-width: 1100px) {
  .advanced-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .advanced-options {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (pointer: coarse) {
  .setting-number {
    min-height: 44px;
  }
}
</style>
