# Xbox dashboard desktop app — v1 spec

Build a native Tauri desktop app with a TypeScript UI and Rust desktop integration. Recreate the familiar late-retail original Xbox dashboard with its original visual and audio assets, composed for 16:9. Validate Windows first. The [design decisions](design-decisions.md) record the agreed scope; the [source research](research/dashboard-sources.md) distinguishes retail evidence from port behavior.

5960 anchors the behavioral research; the exact revision number is not a fidelity target. Match the shipped **Memory, Music, Xbox Live, Settings** Home. Media, Launcher, Games, Movies, and High Scores are outside the screen map. V1 also excludes game launching, physical Memory Units, CD ripping, online accounts and networking, Parental Control, and Auto Off.

## Screen map

| Route | Screens and states |
| --- | --- |
| **Startup → Home** | Play a skippable intro and enter Home on Music. First run seeds sample saves and uses default preferences. There is no mandatory Clock or Language setup. |
| **Home → Memory → Device selector → Hard disk** | The selector offers the app's hard disk. Its save list shows sample titles and save details or a clear empty state. Select a save → **Save actions → Remove confirmation**. Cancel or Back returns to Save actions. Confirm removes only that save, returns to the list, and focuses the next surviving save, then the previous, then the empty-state control. A failed write shows an error and leaves the save intact. |
| **Home → Music → Soundtrack collection → Track list and player** | Start with an empty collection and a focusable Add Tracks action. A native file picker adds local tracks to a soundtrack. The player offers previous, play/pause, stop, next, and a track list; show stopped, playing, paused, and unavailable states. Removing a track removes its library reference only. Back from the player stops playback and returns to the originating soundtrack. |
| **Home → Xbox Live → Offline entry** | Show a recognizable Xbox Live screen with an offline status and a Back prompt. Do not accept credentials or attempt a connection. |
| **Home → Settings → Clock / Language / Audio / Video / System Info** | The scrollable Settings list opens each category. Clock displays PC time with a 12/24-hour option; Language switches all app text between English and Brazilian Portuguese; Audio changes app volume and mute; Video changes window mode and reduced motion; System Info shows the app version and retail reference. |

Back restores the origin control and, for scrollable lists, its visible position. A confirmation is modal and starts on **Cancel**. Canceling an OS picker makes no change; the originating action regains focus. Every empty state has a navigable way out.

## Input mapping

| Input | Dashboard behavior |
| --- | --- |
| D-pad / left stick / arrow keys | Move across the screen's defined directional neighbors; stop at the edge. The D-pad wins over the left stick. Use one stick axis at a time, chosen by strongest deflection, with an initial 55% engage and 40% release threshold. |
| Held direction | One immediate step, next step at 300 ms, then one every 120 ms. Use the same repeat clock for keyboard and controller. Ignore operating-system key repeat and coalesce simultaneous input for the same direction. |
| A / Enter | Confirm the focused action once per press. |
| B / Escape | Close the current confirmation or return one screen. No action at Home. |
| F11 | Toggle native fullscreen without changing the current route or selection. The same action is available to the controller in Video. |
| A, B, Enter, or Escape during startup | Skip and consume the press. Wait for release before accepting the next press. |
| Focus loss, disconnect, or native picker | Clear held state. On return or reconnect, require buttons and axes to return to neutral before treating them as new controller input. |

The dashboard accepts navigation when the destination is ready and does not replay held input across a scene change. Retain visible focus throughout the flow, restore it on return, and expose the app's interactive controls through semantic UI elements so keyboard focus and visual focus agree. Music as initial Home focus comes from Theseus's Xbox-target scene; it is an app choice rather than a verified 5960 cold-start observation.

## Presentation and media

- Fit a centered 16:9 stage in a resizable native window or native fullscreen. On a different aspect ratio, use bars; do not stretch the orb, typography, or controls. Start windowed on first launch, then restore the last chosen mode.
- Use the actual dashboard models, textures, menu graphics, ambience, sound cues, and available boot material. Track each asset's source and version where known. Supply new assets only where a PC-specific state has no retail equivalent. An unavailable original asset remains an explicit fidelity gap for review.
- Give opening and backing out of a scene distinct orb/camera motion, with approximately 650 ms as the first review target. Focus changes within a screen show and sound immediately. Preload Home during startup and hand off once its first frame is ready; if startup media fails, continue to Home.
- Let the orb and background animate subtly at idle with no change to route or focus. Pause decorative rendering while minimized. Reduced motion uses a short fade instead of camera travel and removes ambient motion. Volume and mute apply to the app.
- Start local playback support with MP3 and WAV. Persist the library, not the playback position. Do not copy or modify source files. A moved or unreadable track remains listed as unavailable until removed or re-added. Treat picker cancellation differently from an unreadable file.

## Rust–TypeScript boundary

| Owner | Responsibilities |
| --- | --- |
| **TypeScript / webview** | Route and focus state, directional neighbors, input mapping and repeat, scene lifecycle, semantic controls, translated UI strings, 16:9 layout and WebGL scene rendering, timing and playback of boot/menu audio and selected tracks. |
| **Rust / Tauri core** | Foreground physical-controller acquisition, app-data reads and writes, validation of save and track IDs, native picker, file access scoped to selected music, and app metadata. Use Tauri's native window API for fullscreen and focus/minimize state. |

- Feed controller connect/disconnect and changed button or axis state to TypeScript over an ordered [Tauri channel](https://v2.tauri.app/develop/calling-frontend/#channels). Rust does not emit navigation actions or implement repeat. Keyboard input takes the same path through the TypeScript navigation rules.
- Use [Tauri commands](https://v2.tauri.app/develop/calling-rust/) for reads and explicit mutations: bootstrap preferences and sample saves, patch preferences, remove a sample save by ID, pick/add audio, list tracks, remove a track reference, and resolve a playback URL by track ID. The webview gets display metadata and explicit results; it cannot browse arbitrary paths. Reauthorize only existing user-selected music at playback through narrowly scoped read-only access.
- Store preferences, sample-save records, and track references under app data. Seed sample saves only when no save store exists. Serialize writes and replace state atomically. A failed write leaves the last persisted state intact and surfaces an error in the current screen. Sample saves are records; removal does not expose a file deletion command.
- Adapt Theseus's active-scene lifecycle and focus-owning navigation to a TypeScript route stack. Use ogxweb's canvas sizing and first-frame handoff techniques. Start with targeted reuse of original scene data and relevant rendering code; consider isolating a reusable WebAssembly renderer only if the first visual slice needs it, with navigation still owned by TypeScript.

## Fidelity limits

The later retail captures and Theseus agree on the core screen families, and the early 4034 footage independently shows the Memory round trip. The exact cut timing, cold-start focus, and controller thresholds are not verified together on retail hardware. The 300/120 ms repeats come from Theseus's 5960 analysis; the analog thresholds, 16:9 recomposition, and shorter scene transitions are intentional desktop choices. The [implementation plan](implementation-plan.md) makes these observable in the first milestone.
