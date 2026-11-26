# Original Xbox dashboard: retail reference and reconstruction sources

The [design decision](../design-decisions.md#reference-dashboard) uses the late-retail dashboard, anchored on 5960. The version-identified `1.00.4034.01` recording below is an early-retail comparison. [Theseus][theseus] supplies the 5960 engine model and editable scenes; [ogxweb][ogxweb] shows how to carry that engine into a browser.

## What the released dashboard shows

Source: [April 2002 Xbox with 4034, uploader's post][hardware] · [direct video][hardware-video]. Observations are from one-second samples of the 21-second recording and quarter-second samples of the Memory sequence; timestamps are approximate.

| Time | Observed on the 4034 hardware capture |
| --- | --- |
| 0–5 s | System Info scrolls past `K:1.00.4034.01` and `D:1.00.4034.01`. This identifies both the kernel and the dashboard in this capture. |
| ~7 s | Settings shows Language, Audio, Video, Parental Control, Auto Off and System Info in a scrolled view. This does not show the entire Settings list. |
| ~9–11 s | Home lists **Memory → Music → Settings**; Music is focused before the Music collection appears. An intervening view shows the orb and menu changing scale and position. |
| ~13–17.5 s | Home with Memory focused → Xbox Hard Disk device selector → saved-games list (visible ~16.75–17.5 s). Intermediate frames show depth, changing camera framing and orb imagery. |
| ~18.75–20.25 s | The return passes through the device selector (~18.75–19.0 s), then a second transition settles on Home with Memory focused (~20.25 s). Button presses are off-camera. |

Home places a large animated orb at left and a vertical menu at right. The selected row is brighter and is tied to an orb/pod on the left of the row; the bottom prompts identify A as Select and B as Back where shown. The clip starts inside System Info and never shows the controller. It establishes neither the cold-start default focus nor button repeat, dead zones, transition lockout or exact animation durations. Its filmed display is useful for composition, not precise color sampling. [Hardware video][hardware-video]

The [Microsoft PAL instruction manual][manual] (2002, printed pp. 11–14) documents D-pad move, A select, B cancel, first-time language and clock setup, soundtrack playback, copying saves to a Memory Unit and explicit Yes confirmations for deleting a save or entire title. Its Settings illustration shows Clock and omits Parental Control; the 4034 capture shows Parental Control in the scrolled list. The manual supports the broad retail flows but does not pin exact 4034 screen order, input thresholds or cold-start Home focus.

For a later comparison, [Martin Nobel's screenshot gallery][gallery] explicitly identifies its source as emulated. Its Home adds Xbox Live between Music and Settings, and it also shows the music player, Xbox Disk, Settings and Network Settings; it does not identify the dashboard build. [The Xemu + Insignia walkthrough][walkthrough] labels Settings at 0:54 and Xbox Live at 4:45 and gives no exact build. Its scaled renderer and restored service make it a later comparison, not a 4034 timing or network reference. The [local reference pack][pack] also contains production design boards, including Movies and High Scores; those are evidence of explored design, not retail routes.

The [stock-console Insignia setup video][stock-5960] checks the `D` build field for 5960 before proceeding on the retail dashboard. It is a useful version-identified comparison for System Info and the late-retail connection screens, with Insignia supplying the service. The [XboxLLR 5960 recording][llr-5960] is a recompiled presentation: sampled frames show the same late Settings list pattern (including Network Settings and Auto Sign-In) but only three Home entries. Its host limitations make it unsuitable for deciding the stock Home list or Xbox Live behavior.

## Theseus: what the engine and scenes establish

The repository's [heritage section][heritage] describes analysis of retail binaries from **4920 through 5960**. Its [reverse-engineering index][decomp] identifies **5960** as the primary and final retail binary it maps. This review read Theseus `9f2a46a` (`Configs/version` reports `0.4.3`); ogxweb uses the older `5fc7ddd` (`Configs/version` reports `0.5.250605` there). Both strings identify project builds, not Xbox dashboards. Theseus says most packed `Data/Xips` originated in the UIX Lite community set, with edited scripts split into `default-desktop`, `default-xbox` and editable scene directories. XAP is scene logic, `.xm` is geometry, `.xbx` is texture data, and `.xip` is the archive. Use the 5960 notes for claims about the retail engine and the XAP for claims about how Theseus drives it. [Current version][theseus-version] · [Pinned version][vendor-version] · [Scene inventory][xip]

| Area | What the source gives us | What can be carried over to 4034 |
| --- | --- | --- |
| Home | `UpdateMainMenu` supports 3/4/5 entries. Up/Down steps through visible slots without wrapping; focus changes highlight materials, moves the pod/strip and plays directional sounds. A plays a select and entry cue then dispatches to the active scene. The Xbox-target script initializes Music selected; optional attract and trigger shortcuts also exist. Both inspected configurations use **five** entries by default: Memory, Music, Media, Launcher and Settings. [Home scene][home] · [Controls][home-input] · [Initialization][home-init] · [Default config][config] · [Pinned config][vendor-config] | The three-slot branch is a useful structural analogue. Match the released 4034 Home order and use the clip for observed focus, rather than assuming Music was the 4034 cold-start default or carrying over launcher, attract or shortcut behavior. |
| Memory | The device selector opens `theFilesMenu` with A; its normal B route returns Home with `GoBackTo`, and it enables enumeration on arrival. The files scene handles direction input, removal, copy/delete and save metadata; the retail 5960 grid notes document later-version details. [Device selector][memory] · [Saved-game handlers][memory-files] · [5960 grid][saved-grid] | The device-to-saved-games hierarchy and two-step return to Home match the capture. The clip does not confirm removable-unit behavior, specific copy/delete flows or the physical inputs. |
| Music | `theMusicMenu` opens the track/player scene when there are entries; B resets local selection/scroll and normally returns Home. The player has separate playback controls and copy state. [Collection][music] · [Player][music-player] | The collection scene is visible in the 4034 capture. The later player is useful for researching deeper flows, which the clip does not show. |
| Settings | A six-row viewport separates selected row, scroll offset and total items and shows arrows when more rows exist. The Xbox script includes common console settings plus community additions such as Skins/Orbs and later Network/Live Today. [Settings list and scrolling][settings] | The scrolled capture corroborates the list-and-focus pattern and visible labels. It cannot establish the complete 4034 list; the later and community entries need separate evidence. |
| Xbox Live | Xbox-target scenes expose an account picker, passcode, and Live Today; the script includes Insignia branches. [Account selection][account] · [Live Today][live-today] | Useful for a later-retail comparison. Xbox Live is absent from the recorded 4034 Home. |

**Transition and focus model.** The 5960 notes describe distinct departing, arriving and current scenes, a tunnel/shell, camera viewpoint or camera path, and a controller owned by the active scene. On entry the engine detaches input, calls `OnActivate`, and after the transition and archive readiness binds the new controller and calls `OnArrival`. `GoBackTo` uses the departing scene's tunnel and can reverse a camera path; a viewpoint may be bound instead. The 5960 engine sets an overall one-second transition window and computes a 0.75-second fade ramp when fading is enabled. Camera position interpolates linearly, orientation uses quaternion slerp, and an optional small yaw/pitch wobble gives the view idle movement. The 4034 frames support the general depth-and-orb treatment; the late-engine timings and path implementation are hypotheses for 4034. [Level notes][levels] · [Level implementation][level-code] · [Camera notes][camera]

**Input and sound.** Theseus documents D-pad/stick movement, A select and B back. Its 5960 analysis describes a bound joystick, immediate directional events with repeat after 300 ms then every 120 ms, stick threshold around ±0.9, and waking the screen saver on the first event. The desktop and reconstructed Xbox paths differ from 5960 in their event/device handling. The pinned desktop adapter maps arrows to D-pad, WASD to stick, Enter/Space to A and Escape/B or Backspace to B/Back. Sound is tied to state: the XAP uses looping ambient beds, intermittent sound variants, distinct directional/confirm/back cues and per-scene in/out cues. [Retail and port input differences][input] · [Pinned keyboard adapter][keyboard] · [Sound script][sound] · [Retail audio notes][audio] · [Xbox Wire on the original transition master and boot sound][xbox-audio]

## ogxweb: browser techniques and deviations

Reviewed `042d227` on Codeberg, whose [vendor tree][vendor] pins Theseus `5fc7ddd`. It ports the engine via Emscripten/Wasm with a small replacement layer and [two tracked patches][patches] for unloadable levels and launch interception. It is neither a CSS remake nor an Xbox hardware emulator. [Project README][ogx-readme]

| Area | Technique and limit |
| --- | --- |
| Rendering | bgfx targets OpenGL ES on a WebGL 2 canvas with existing compiled `300_es` ESSL shaders. A replacement main loop advances and draws the real scene graph, including the orb, background mesh and menu strip. Browser layout centers a 4:3 viewport by default; canvas buffer and projection follow that box. Window fill is a distinct port option. [Renderer notes][porting] · [Frame loop][web-main] · [Framing][framing] |
| Boot and audio | The browser plays the upstream MP4 natively over the canvas while Wasm and assets load. The dashboard clock starts at handoff; it waits for a painted frame before removing the video. Natural end cuts from black; skip fades. The browser can start video muted after autoplay refusal and enables sound on a gesture. SDL_mixer remains for engine audio; a browser `<audio>` element and C++ bridge simulate an audio CD from files dropped into the page. The music visualizer is unported. These choices describe the web adaptation, not 4034 firmware pacing or CD behavior. [Boot coordinator][boot] · [SDL build flags][web-link] · [CD bridge][cd-bridge] · [Disc UI][disc] · [Scope][ogx-readme] |
| Input | An SDL window registers Emscripten's input callbacks without a second GL context; the frame loop pumps SDL events so the upstream desktop joystick can poll current keyboard and controller state. Authors report working keyboard navigation and explicitly mark physical gamepad behavior unverified. [SDL initialization][web-sdl] · [Frame loop][web-main] · [Scope][ogx-readme] |
| Assets and storage | A measured boot/background asset split fetches upstream assets through a manifest into case-insensitive MEMFS; content hashes key both URL and Cache API. IDBFS persists selected writable trees. This separates asset delivery and persistence from the scenes. [Asset staging][asset-staging] · [Loader][asset-loader] · [Case-insensitive filesystem][fs] · [Persistence][persist] |
| Home and Xbox Live | The asset build rewrites the pinned menu to **Memory → Music → Xbox Live → Media → Settings**, replacing the launcher slot and restoring Live entry. It also rewrites strings and scene routes and supplies a local mock account; some buttons are incomplete, and it does not connect to the original service. Five items in ogxweb and four in the later emulated gallery are different references. [Menu patches][web-menu] · [Live scene patches][web-live] · [Local mock][mock] · [Scope][ogx-readme] |

## Open fidelity questions

1. Use the 5960 notes for depth, focus ownership and state-aware audio. The 4034 footage helps corroborate the shared Memory flow; it is not evidence of late-retail Live or Settings behavior.
2. Distinguish the 5960 engine constants from observed end-to-end behavior. The listed footage does not independently verify cold-start Home focus, exact transition timings, or controller repeat; ogxweb's physical gamepad support is unverified.
3. Confirm what “original visuals and audio” means. The [local reference pack][pack] calls for newly authored artwork, typography and sound; original retail media is a different deliverable. Theseus's community scenes, ogxweb's [asset statement][notice] and [mark provenance][mark], and the [Xbox Wire audio reference][xbox-audio] describe separate sources. They do not establish which retail revision a particular in-repo asset matches.

[hardware]: https://www.reddit.com/r/originalxbox/comments/rt5bs7/april_2002_xbox_sporting_original_4034_dash_and/
[hardware-video]: https://v.redd.it/wwr0lafpiy881/DASH_480.mp4
[manual]: https://git.nox-rhea.org/Retro/Awesome-Retro-Docs/raw/branch/master/User_Manual/01_Microsoft_Xbox_%28PAL%29-Manual.pdf
[gallery]: https://www.martinnobel.com/techresearch/original-xbox-dashboard-screenshots
[walkthrough]: https://www.youtube.com/watch?v=zQWEV8k39OA
[stock-5960]: https://www.youtube.com/watch?v=cgc7mBG3Alg
[llr-5960]: https://1379.tech/xboxllr-beta-blinx-jet-set-radio-future/#xbox-dashboard
[pack]: ../../reference/README.md
[xbox-audio]: https://news.xbox.com/en-us/2012/11/15/audio-of-the-original-xbox-dashboard/
[theseus]: https://github.com/MrMilenko/Theseus
[heritage]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/README.md#heritage
[decomp]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/docs/decomp/README.md
[theseus-version]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/Configs/version
[vendor-version]: https://github.com/MrMilenko/Theseus/blob/5fc7ddddd03b4b5a7e6233769ad6a8fe46009965/Configs/version
[xip]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/README.md
[home]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/default-xbox/default.xap#L1239-L1687
[home-input]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/default-xbox/default.xap#L1865-L1966
[home-init]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/default-xbox/default.xap#L2228-L2236
[config]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/Configs/config.ini#L6-L19
[vendor-config]: https://github.com/MrMilenko/Theseus/blob/5fc7ddddd03b4b5a7e6233769ad6a8fe46009965/Configs/config.ini#L6-L19
[memory]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/default-xbox/memory3.xap#L1571-L1709
[memory-files]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/default-xbox/memory3.xap#L1012-L1340
[saved-grid]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/docs/decomp/SavedGameGrid.md
[music]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/default-xbox/music2.xap#L2402-L2554
[music-player]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/default-xbox/music2.xap#L1801-L2228
[settings]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/default-xbox/settings3.xap#L3390-L3550
[account]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/default-xbox/AccountSelection.xap
[live-today]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/default-xbox/LiveToday.xap
[levels]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/docs/decomp/SceneGroups.md#clevel-1
[level-code]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/theseus/render/scene_groups.cpp#L1864-L2030
[camera]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/docs/decomp/Camera.md
[input]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/docs/decomp/Input.md
[keyboard]: https://github.com/MrMilenko/Theseus/blob/5fc7ddddd03b4b5a7e6233769ad6a8fe46009965/theseus/desktop/joystick.cpp#L449-L489
[sound]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/xips-source/default-xbox/default.xap#L12-L195
[audio]: https://github.com/MrMilenko/Theseus/blob/9f2a46aed3983837cdc6dc8264bc18dfc77001ef/docs/decomp/AudioSystem.md
[ogxweb]: https://codeberg.org/devcheckra1n/ogxweb
[vendor]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/vendor
[ogx-readme]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/README.md
[patches]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/patches/theseus/README.md
[porting]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/docs/porting-notes.md
[web-main]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/src/web_main.cpp#L228-L343
[web-sdl]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/src/web_main.cpp#L508-L541
[framing]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/web/framing.js
[boot]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/web/boot-video.js
[web-link]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/tools/link-surface.sh#L98-L110
[cd-bridge]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/src/compat/cdaudio_web.cpp
[disc]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/web/disc.js
[asset-staging]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/tools/make-assets.py#L10-L105
[asset-loader]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/web/asset-loader.js
[fs]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/web/fs-ci.js
[persist]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/web/persist.js
[web-menu]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/tools/make-assets.py#L286-L330
[web-live]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/tools/make-assets.py#L125-L245
[mock]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/src/compat/live_accounts_web.cpp
[notice]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/NOTICE
[mark]: https://codeberg.org/devcheckra1n/ogxweb/src/commit/042d227455bb6710b56996a383dbf1a3e52bdc55/docs/assets.md
