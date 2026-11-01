# Score playback views

Long arrangements must remain readable when playback starts. Follow is a presentation preference, not musical data, and does not belong in the URL codec.

## Behavior

- Full score is the default. Preserve the wrapped geometry on Play and Stop, highlighting the current note without changing notation size.
- A single Follow playhead switch lives with the other playback options in Transport. It defaults to off.
- While stopped, always show Full score and no playback marker, even if Follow is enabled. The editing selection remains independent.
- During Play with Follow enabled, render a native-size horizontal track inside a clipped viewport. Keep the playhead at the horizontal center and translate the notation underneath it.
- Do not expose a scrollbar or let users drag or wheel the following track horizontally. Allow blank space at either end so the first and last note remain centered too.
- Size follow measures for roughly six visible beats, with a minimum for dense divisions. Translate backwards when a repeated measure restarts.
- Show stored bar and repeat pass during playback. Preserve musical content and repeat expansion.
- Stop returns to the complete score while retaining the Follow preference for the next Play. Editor and embed share the same behavior.

## Implementation

`score-layout.ts` owns sizing and the center-relative track offset. `vex-builder.ts` uses the geometry. `scoreView.ts` shares the session preference between Transport and Score. `Score.vue` uses Follow only when playback is active, renders the SVG at native scale and clips the translated track. The marker's own position transition is disabled while following so it stays centered as the track moves.

Full-score mode does not scroll the document automatically. Follow resets to off on a new application load. The musical URL and the mobile transport placement remain unchanged.

## Validation

Geometry tests cover long arrangements, dense divisions and exact centering at the start, middle and end of a track. Score component tests cover default full score, enabling Follow while stopped, entering Play, translating on note changes and restoring full score without a playhead on Stop. Browser checks use the 13-stored-bar arrangement with 26 executed bars. Stop playback and restore Follow off after checking.
