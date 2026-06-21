import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

// Bumped when the tour gains a step worth re-surfacing to returning users.
// Stored alongside the flag so a content refresh can re-trigger the auto-start.
// v2: chart auto-scroll, the Transport "Options" accordion + Pause between
// loops, and early/perfect/late MIDI timing feedback.
const TOUR_VERSION = 2
const TOUR_SEEN_KEY = 'groove:tourSeen'

function seenVersion(): number {
  try {
    return Number(localStorage.getItem(TOUR_SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

function markSeen() {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, String(TOUR_VERSION))
  } catch {
    // Private mode / storage disabled, so the tour just won't remember itself.
  }
}

function steps(): DriveStep[] {
  return [
    {
      popover: {
        title: 'Welcome to Groove 🥁',
        description:
          'A drum groove editor that lives entirely in your browser. Build a beat, hear it, read it on a staff, and share the whole thing as a single link. Here is a quick tour. Hit Next.',
        // No Back button on the first step; there is nowhere to go back to.
        showButtons: ['next', 'close'],
      },
    },
    {
      element: '[data-tour="naming"]',
      popover: {
        title: 'Name your groove',
        description:
          'Give the pattern a title and an author. These travel inside the share link, so whoever opens it sees the same labels.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="division"]',
      popover: {
        title: 'Pick a subdivision',
        description:
          'Set how finely each beat is split: 8ths, 16ths, 32nds. This decides how many cells you get per measure.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="grid"]',
      popover: {
        title: 'Build the beat',
        description:
          'Click a cell to drop a note; click again to cycle states: accent, ghost, open hat, foot. The legend at the bottom spells out every symbol. Lanes cover hi-hat, ride, three toms, snare and kick.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="measures"]',
      popover: {
        title: 'Multiple measures',
        description:
          'Add up to 8 bars with the + tab and switch which one you are editing. You can also click a measure on the staff above to jump straight to it.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="score"]',
      popover: {
        title: 'Read it as a chart',
        description:
          'Everything you enter renders live as a real percussion staff, beamed per beat, just like a drum chart. While it plays, a marker rides the notes and the chart scrolls to keep the current note centered.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="play"]',
      popover: {
        title: 'Hear it',
        description:
          'Press play to hear the groove through a synthesized kit, no samples to download. The Spacebar toggles play/pause too.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="transport"]',
      popover: {
        title: 'Practice tools',
        description:
          'Loop the bar, add swing, click in a metronome and a count-in, set a timer that auto-stops the session, or add a silent Pause between loops to review. On a narrow screen these sit behind the Options button.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="settings"]',
      popover: {
        title: 'Settings & MIDI',
        description:
          'Connect a MIDI drum kit for live feedback: each hit lands on the staff graded early, perfect or late. Export the groove as a .mid or .png file, and hide tom or cymbal lanes you are not using.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="share"]',
      popover: {
        title: 'Share anything',
        description:
          'The entire groove is packed into the URL, with no server involved. Share copies a link, and you can also embed it as an iframe on any page.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="help"]',
      popover: {
        title: 'That is the tour',
        description: 'Replay it anytime from this button. Now go build a beat. 🎶',
        side: 'bottom',
        align: 'end',
      },
    },
  ]
}

export function useTour() {
  function startTour() {
    const d = driver({
      showProgress: true,
      popoverClass: 'groove-tour',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      steps: steps(),
      onDestroyed: markSeen,
    })
    d.drive()
  }

  // Auto-run once for first-time visitors. localStorage is fine here: it is
  // transient UX state, never a substitute for the URL (see docs/conventions).
  function maybeAutoStart() {
    if (seenVersion() >= TOUR_VERSION) return
    startTour()
  }

  return { startTour, maybeAutoStart }
}
