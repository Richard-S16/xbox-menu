# Windows release walkthrough

Use the NSIS installer from `src-tauri/target/release/bundle/nsis/`, a Windows test account with WebView2 installed, a physical Xbox-compatible controller, and disposable MP3 and WAV files. Use a fresh test profile for first-run checks. Run the screen map once with the keyboard and once with the controller. Repeat with networking disconnected after provisioning WebView2.

| Check | Walkthrough and expected result |
| --- | --- |
| Startup | Let the original clip finish. Home highlights Music. Relaunch and hold A, B, Enter, or Escape to skip; Home remains on Music until a new press. The clip keeps its aspect ratio. |
| Memory | Open Memory → Xbox Hard Disk → a save → Remove Save. Cancel is focused; Confirm-on-Cancel and Back preserve the save. Confirm removal, check the next surviving row, then remove the rest and relaunch to verify the empty state persists. Back restores the original Home row. |
| Music | From the empty collection, cancel Add Tracks, then add an MP3 and a WAV. Try Play, Pause, Stop, Previous, and Next. Back stops playback and restores Soundtrack focus. Relaunch and play the saved references. Move a test file, reenter the player, verify Unavailable, locate the moved file, then remove the reference and confirm the source file still exists. |
| Xbox Live | Open the offline screen, verify no account form or connection prompt, then Back to the focused Xbox Live row. |
| Settings | Change Clock format, Language, Audio volume/mute, and Video settings; check System Info. Relaunch and verify the choices persist. With reduced motion, startup goes directly to Home, orb and background stay still, and route changes use a short fade. With mute on, listen for silence during startup, navigation, and local playback. |
| Window and idle | Toggle F11 on a nested screen and toggle Window Mode with the controller in Video; the same control should stay focused. Relaunch in fullscreen. In windowed mode try 16:9 and a taller window; the stage stays centered with bars and artwork retains its proportions. Watch the idle orb and background with motion enabled, minimize and restore, and verify route and focus have not moved. |
| Held input | Hold a direction, check the 300/120 ms repeat and stop at an edge. Hold A or B through a scene transition. Disconnect or minimize while holding a direction, then reconnect or restore; held input is ignored until neutral. Check the stick around the 55% engage and 40% release thresholds. |

## Persistence failure

After changing a setting at least once, use PowerShell in the test account to hold the dashboard lock. Toggle Window Mode from Video; it should return to its previous mode, keep focus, and show an error. Once the lock is released, retry and verify it persists after relaunch.

```powershell
$path = Join-Path $env:LOCALAPPDATA 'com.xboxmenu.dashboard\dashboard.lock'
$lock = [IO.File]::Open($path, 'Open', 'ReadWrite', 'None')
try { Read-Host 'Exercise the failed setting update, then press Enter here' }
finally { $lock.Dispose() }
```

`npm test` covers the startup media failure path, held input, and directional navigation. `cargo test --manifest-path src-tauri/Cargo.toml` covers persistence and selected-file boundaries.
