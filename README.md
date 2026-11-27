# xbox-menu

A native desktop recreation of the original Xbox dashboard, using Tauri, Rust, and TypeScript.

- [V1 spec](docs/spec.md)
- [Implementation plan](docs/implementation-plan.md)
- [Design decisions](docs/design-decisions.md)
- [Dashboard research](docs/research/dashboard-sources.md)
- [Glossary](GLOSSARY.md)

## Run the dashboard on Windows

With Node.js 22.12+ (or 24+), Rust, Visual Studio C++ build tools, and WebView2 installed:

```powershell
npm ci
npm run tauri dev
```

To create an installer, run `npm run tauri build`. On Home, move up from Music to **Memory** and select **Xbox Hard Disk**. Open any sample save to try its actions. Use the D-pad, left stick, or arrow keys to move, **A / Enter** to select, and **B / Escape** to go back. In a removal confirmation, move right from **Cancel** to **Remove**. Confirmed removals persist in the app's own save store.

In **Music**, use **Add Tracks** to select local MP3 or WAV files. In the soundtrack, move right from the track list to reach playback controls and **Track Options**. Select an unavailable track to locate its file or remove its reference. **Settings** saves clock, language, audio, and video preferences; **F11** toggles fullscreen. **Xbox Live** is offline.

The original artwork and sounds used by this build are listed in the [asset notes](docs/milestone-1-assets.md).
