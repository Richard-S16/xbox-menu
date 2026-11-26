# Milestone 1 assets and fidelity

The bundle uses offline assets. It does not load ogxweb or require a network connection. Original Xbox ADPCM audio is decoded to PCM WAV for WebView2.

| Bundled assets | Source |
| --- | --- |
| Home orb, pod, four Home labels, app icon | Original dashboard artwork isolated from [the released Home capture](../reference/released-dashboard/01-home-music-focused.webp), sourced by the pack from Martin Nobel. |
| Hard disk orb and cell-wall texture | Original artwork cropped from [the released device selector capture](../reference/released-dashboard/03-memory-device-selector.webp). |
| `up.wav`, `down.wav`, `move.wav`, `select.wav`, `back.wav`, `remove.wav` | [Theseus `Data/Audio/MainAudio`](https://github.com/MrMilenko/Theseus/tree/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/Data/Audio/MainAudio), respectively: `Global Main MenuBack3ver2`, `Global Main MenuFwd3ver2`, `Global Scroll Beep`, `Global A Button Select`, `Global B Button Back`, `Global Delete_Destroy`. |
| `disk.wav` | [Theseus `Memory Controller Select.wav`](https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/Data/Audio/MemoryAudio/Memory%20Controller%20Select.wav). |
| `in.wav`, `out.wav` | [Theseus `Data/Audio/TransitionAudio`](https://github.com/MrMilenko/Theseus/tree/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/Data/Audio/TransitionAudio), `Games Main Menu In_LR` and `Games Main Menu Out_LR`. |
| `ambient.wav` | [Theseus `AMB_05_ENGINEROOM_LR.wav`](https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/Data/Audio/AmbientAudio/AMB_05_ENGINEROOM_LR.wav). |

Compared with the [retail footage](research/dashboard-sources.md#what-the-released-dashboard-shows), Home preserves the orb, pods, labels, and focused strip, and Memory retains the hard disk artwork and device-to-save hierarchy. The orb crops are composited with live controls; the source meshes, original Memory list font/layout, full ambient layering, and original 3D tunnel are not reproduced. The first transition uses forward/reverse depth scaling through the orb with the original cues. Its timing and the analog thresholds are review targets.
