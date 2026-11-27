# Xbox dashboard desktop app — implementation plan

Start only after approval of the [v1 spec](spec.md) and this plan. Use Windows and a physical Xbox-compatible controller for the first acceptance run. Source comparisons and the approved choices live in [dashboard research](research/dashboard-sources.md) and [design decisions](design-decisions.md).

## Milestone 1 — Controller-navigable Home and complete Memory flow

Boot a minimal Tauri + TypeScript shell directly to Home for this milestone. Reuse the original Home and Memory assets, adapt the scene framing to 16:9, and wire native controller state into the shared navigation rules. Implement the route stack and the app-owned sample-save store only as far as needed for Memory. Build the first forward and reverse scene transitions with the original cues. The remaining Home rows can be focused for layout/input testing and are visibly unavailable until their branches are implemented.

**Acceptance**

1. A Windows desktop build launches on Home with Music highlighted. One D-pad or stick step reaches Memory, A opens it, and another A opens the hard disk's sample-save list. B returns through the device selector, then to Home with Memory highlighted. Arrow keys, Enter, and Escape perform the same round trip.
2. Open a save's actions and its removal confirmation. It opens on Cancel; B and Confirm-on-Cancel preserve the save. Explicitly confirm removal to see the next surviving item focused. Remove the last entry to see a usable empty state; relaunch and confirm samples are not silently recreated.
3. A held direction follows the 300/120 ms schedule and stops at an edge. Holding A or B never double-activates across a transition. Unplug and reconnect the controller, or switch window focus while holding a direction; no stale action fires.
4. In a 16:9 window, real Home and Memory art stays undistorted, forward and reverse transitions convey depth, and focus, Confirm, and Back have audible original cues. Compare a capture of the same flow with the [released footage and upstream scenes](research/dashboard-sources.md) and list any asset or motion gaps.

**Review gate:** hand over the Windows build and this walkthrough. Tune controller thresholds, transition pacing, and visual fidelity with the user before building the remaining screen branches.

## Milestone 2 — Music, Settings, and Xbox Live

Complete the remaining Home branches. Add the native audio picker, a soundtrack backed by selected file references, track availability and local playback. Add localized settings wired to the native store, the read-only System Info view, and the offline Xbox Live entry. Implement Video's fullscreen and reduced-motion controls with the existing Memory transitions.

**Acceptance**

1. Music starts empty. Canceling the picker adds nothing. Add an MP3 and a WAV, play, pause, stop, and switch tracks. Back stops playback and restores soundtrack focus. Relaunch and play the same files without reselecting them.
2. Move a selected file out of its original location. The track reads as unavailable and can be removed or re-added; removing its reference never deletes the underlying file.
3. Change 12/24-hour format, language, volume/mute, and Video preferences. Each changed setting affects the app and survives relaunch. Clock does not change OS time. System Info displays the app version and reference.
4. Xbox Live opens offline and backs out to the focused Xbox Live row. No screens ask for account data or initiate network traffic.

## Milestone 3 — Startup, window behavior, and release verification

Integrate the skippable startup media and idle behavior. Verify native fullscreen and reduced motion across the app. Review the whole experience from a fresh install through relaunch with the actual production dashboard assets.

**Acceptance**

1. On first launch, both letting the intro finish and skipping it land on Home with Music focused. A skip press does not open Music. Dashboard startup still reaches Home if the intro cannot play.
2. Switch native fullscreen with F11 and from Video using the controller. The app preserves route and focus, restores the chosen mode on relaunch, and fits a centered 16:9 stage without distortion in both 16:9 and non-16:9 windows.
3. Idle motion never changes selection, decorative rendering pauses while minimized, and reduced motion replaces camera travel with a short fade. Mute silences the app and stays set after relaunch.
4. Run the entire screen map with both keyboard and a physical controller in a packaged Windows build. Verify error recovery for a failed persistence write and missing music; run offline to check that dashboard assets and screens are available without a service.

Add focused automated checks for deterministic navigation, held-input timing and release, persistence across relaunch, and file-access boundaries. Keep motion, audio, hardware dead zones, and packaged fullscreen on the manual walkthrough because those depend on the device and runtime.

## Milestone 4 — Three.js Home and Memory

Build the first Three.js slice around **Home → Memory device selector → Home**. Reconstruct the orb, translucent shell, luminous core, and curved cell wall with new geometry and materials. Use the [released dashboard captures](../reference/released-dashboard-contact-sheet.jpg) for composition and [Theseus and ogxweb](research/dashboard-sources.md) for motion. Share one decorative canvas behind the existing semantic controls in the browser and Tauri. See the [Three.js design decisions](design-decisions.md#threejs-home-and-memory).

**Acceptance**

1. Enter Memory with A or Enter and return with B or Escape. The camera moves past the Home orb on entry and retraces the same path on return. Start around 650 ms and tune against the existing sound cues. Home restores focus to Memory, row movement remains immediate, and holding A or B does not trigger a second action.
2. The centered 16:9 stage keeps the artwork undistorted. At idle, the orb's material drifts and the shell catches changing light while the camera and selection stay still. Reduced motion shows a composed still and short fades. Decorative rendering pauses when the page is hidden or the desktop window is minimized.
3. With WebGL 2 unavailable, renderer initialization failing, or the graphics context lost, the existing CSS and still artwork keep the dashboard usable. Skipping the intro never waits for Three.js.
4. Verify the round trip in the browser and packaged Windows WebView2 app, including a physical controller on Windows. Aim for 60 fps at 1080p on the Windows review machine. Cap the canvas drawing buffer and lower its resolution before sacrificing input responsiveness or HTML text clarity.

**Review gate:** Compare captures of both directions with the retail references and review the round trip on Windows before extending Three.js to other screens.
