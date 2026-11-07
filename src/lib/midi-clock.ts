export interface AudioClockSample {
  currentTime: number
  performanceMs: number
  baseLatency?: number
  outputLatency?: number
  outputTimestamp?: { contextTime?: number; performanceTime?: number }
}

// Map the MIDI event's receipt time to the sample audible at that moment.
// getOutputTimestamp already includes the output path; do not subtract it twice.
export function audibleTimeAt(eventMs: number, clock: AudioClockSample): number {
  const stamp = clock.outputTimestamp
  if (
    stamp &&
    Number.isFinite(stamp.contextTime) &&
    Number.isFinite(stamp.performanceTime) &&
    stamp.performanceTime! > 0 &&
    stamp.contextTime! > 0
  ) {
    return stamp.contextTime! + (eventMs - stamp.performanceTime!) / 1000
  }
  return (
    clock.currentTime +
    (eventMs - clock.performanceMs) / 1000 -
    Math.max(0, clock.baseLatency ?? 0) -
    Math.max(0, clock.outputLatency ?? 0)
  )
}
