# Xbox Menu

<img width="1152" height="682" alt="Menu" src="https://github.com/user-attachments/assets/8981061a-4ebe-401a-9280-57f17118e243" />


A recreation of the original Xbox dashboard, available as a **web app** and a **native Windows desktop app**. Both share the TypeScript dashboard; the desktop app uses Tauri and Rust.

- [V1 spec](docs/spec.md)
- [Implementation plan](docs/implementation-plan.md)
- [Design decisions](docs/design-decisions.md)
- [Dashboard research](docs/research/dashboard-sources.md)
- [Glossary](GLOSSARY.md)

## Web app

With Node.js 22.12+ (or 24+):

```sh
npm ci
npm run dev
```

Open `http://localhost:1420`. To deploy on Vercel, import this repository and use the **Vite** preset with the repository root, `npm run build`, and `dist` as the output directory. The site is static and needs no environment variables or backend.

Use the keyboard, mouse, or a browser-supported standard gamepad. Sample saves and settings stay in that browser for the site's origin. Music plays from files you select for the current session; the app never uploads them. Enter fullscreen from **Settings → Video** where the browser supports it.

## Native Windows desktop app

With Node.js 22.12+ (or 24+), Rust, Visual Studio C++ build tools, and WebView2 installed:

```powershell
npm ci
npm run tauri dev
```

To create an installer, run `npm run tauri build`. Skip the startup animation with **A / Enter** or **B / Escape**. On Home, move up from Music to **Memory** and select **Xbox Hard Disk**. Open any sample save to try its actions. Use the D-pad, left stick, or arrow keys to move, **A / Enter** to select, and **B / Escape** to go back. In a removal confirmation, move right from **Cancel** to **Remove**. Confirmed removals persist in the app's own save store.

In **Music**, use **Add Tracks** to select local MP3 or WAV files. In the soundtrack, move right from the track list to reach playback controls and **Track Options**. Select an unavailable track to locate its file or remove its reference. **Settings** saves clock, language, audio, and video preferences; **F11** toggles fullscreen. **Xbox Live** is offline.

See the [asset notes](docs/milestone-1-assets.md) for sources and the [Windows walkthrough](docs/windows-release-walkthrough.md) for release checks.
