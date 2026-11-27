# Dashboard design decisions

## Reference dashboard

Use the familiar late-retail original Xbox dashboard as the behavioral reference, with 5960 as the source anchor. The exact build number is not a fidelity requirement. Use Theseus and the running ogxweb demo for implementation and feel, and check the shipped screen structure against retail captures. Community additions shown by the ports are not automatically in scope.

See [dashboard source research](research/dashboard-sources.md) for what each source establishes.

## V1 screen scope

- **Startup:** skippable intro into Home. Language and Clock are available through Settings rather than mandatory on first run.
- **Home:** Memory, Music, Xbox Live, Settings, in that order.
- **Memory:** device selector → hard disk → save list → save actions → removal confirmation. Cover the empty list and both confirmation outcomes.
- **Music:** soundtrack collection → track list and player. Cover the empty collection and stopped, playing, and paused states.
- **Xbox Live:** recognizable offline entry screen with a working Back path. Accounts and network setup are deferred.
- **Settings:** scrollable list for Clock, Language, Audio, Video, and System Info. Parental Control, Auto Off, and Live-related settings are deferred.
- **Return:** Back moves up one screen at a time and restores the row or control that opened it.

Milestone 1 is controller-navigable Home and the complete Memory round trip with sample saves, including canceling a removal confirmation.

## PC behavior and persistence

- **Memory:** app-owned sample saves only. Confirmed removal persists across launches; no browsing PC drives or deleting outside the app.
- **Music:** add local audio files through a native picker and play them from a soundtrack. Persist references without copying files. Mark missing tracks unavailable and allow removal or re-adding.
- **Clock:** show the PC clock and persist the dashboard's 12/24-hour format. Do not set system time.
- **Language:** English by default, with a persisted choice of English or Brazilian Portuguese.
- **Audio and Video:** persist dashboard volume, mute, display mode, and reduced motion. These preferences affect only the app.
- **System Info:** show the desktop app version and its retail reference. **Xbox Live** stays offline and never asks for credentials.

## Input and focus

- D-pad, left stick, and arrow keys move to the next valid control in that direction without wrapping. The stick uses its dominant axis; the D-pad wins if both gamepad controls are held.
- Directional input moves immediately, repeats after 300 ms, then repeats every 120 ms. Begin with stick thresholds of 55% to engage and 40% to release, then validate on hardware.
- A / Enter confirms; B / Escape backs out. Confirm and Back fire once per press. Back cancels a confirmation and does nothing at Home. Destructive confirmations initially focus Cancel.
- Home starts focused on Music. Returning restores the control that opened the screen. If that control was removed, focus the next surviving item, then the previous one, then the empty-state control.
- Local audio selection hands off to the native picker. Dashboard input resumes after it closes.

## Window, transitions, and idle

- Use a centered **16:9** dashboard in windowed and fullscreen modes. Recompose the scene for widescreen without stretching its artwork or controls. Fit the scene with bars when the window has a different aspect ratio.
- Start windowed on the first launch. Toggle native fullscreen with F11 or Settings → Video, persist the mode, and keep the current screen and focus when switching.
- A, B, Enter, or Escape skips startup without activating the next screen. Screen changes use orb and depth motion, initially around 650 ms and tuned at milestone 1. Focus movement within a screen is immediate. The destination accepts navigation when ready without replaying held input.
- Let the orb and background move subtly at idle without changing the screen or focus. Pause decorative motion when minimized. Reduced motion uses a short fade for screen changes and disables ambient motion.

## Dashboard artwork and audio

Use the actual Xbox dashboard artwork and sounds where identifiable: orb and background graphics, menu graphics, ambience, navigation and transition cues, and available startup media. Recompose them for 16:9. Create assets only for PC-specific states without a retail equivalent.

## Three.js: Home and Memory

The first Three.js slice covers **Home → Memory device selector → Home**. The goal is for both screens to feel like places in the same space: A moves past the Home orb into Memory, and B retraces the same camera path and lands on Home with Memory still highlighted. Start around the existing 650 ms transition target and tune the round trip against the existing sound cues. Moving focus between rows stays immediate.

- **Art:** Reconstruct the orb, translucent shell, luminous core, and curved cell wall with new Three.js geometry and materials. Use the [released dashboard captures](../reference/released-dashboard-contact-sheet.jpg) for composition and [Theseus and ogxweb](research/dashboard-sources.md) for motion and scene behavior. Keep the centered 16:9 stage. At idle, the orb's material drifts and the shell catches changing light while the camera and selection stay still.
- **Rendering:** Share one decorative canvas behind the semantic HTML controls in the browser and Tauri. The existing TypeScript owns navigation, input, focus, prompts, and audio cues. Keep the current CSS and still artwork available if WebGL 2 is unavailable, initialization fails, or the graphics context is lost. The intro skip never waits for Three.js.
- **Reduced motion:** Show a composed still at idle and use short fades for screen changes. Pause decorative rendering while the page is hidden or the desktop window is minimized.
- **Review:** Windows is the first performance target. Lower the canvas resolution before compromising input responsiveness or text clarity. See [Milestone 4](implementation-plan.md#milestone-4--threejs-home-and-memory) for acceptance checks and the review gate.

## TypeScript and Rust boundary

TypeScript owns screen state, focus, input interpretation, composition, transitions, and audio playback. Rust owns physical-controller acquisition, local persistence, and access to user-selected audio. Use Tauri's window and dialog APIs. Windows is the first validation platform. Theseus informs scene lifecycle; ogxweb informs WebGL framing and startup handoff. Validate adapted original artwork, motion, sound, and controller feel together in milestone 1.
