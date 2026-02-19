# ✦ Auto Typer

A space-themed auto-typer that simulates keyboard input in any Windows app. Uses a persistent PowerShell process for smooth, jitter-free character-by-character typing.

## Features

- **Smooth letter-by-letter typing** — persistent PS process, no per-keystroke startup lag
- **Global hotkey** (F2 default) — works even when the app isn't focused
- **Escape to stop** at any time
- **Live progress bar** with percentage
- **Rebindable hotkey** — click the field and press any key or combo
- **Always-on-top** toggle
- **Animated starfield** UI with nebula glow effects

## Setup

```bash
npm install
npm start             # dev mode
npm run build         # → dist/AutoTyper.exe (portable, no installer)
npm run build-dir     # → dist/win-unpacked/ (unpackaged, for inspection)
```

## Size Optimizations

The build strips significant weight from the default Electron bundle:

| Optimization | Savings |
|---|---|
| Strip 50+ Chromium locale files (keep en-US) | ~40 MB |
| Remove license HTML, hi-dpi assets | ~5 MB |
| ASAR packing with max compression | ~10 MB |
| Exclude node_modules from bundle (no deps) | variable |
| Single-arch x64 only | ~50% vs dual |

**Expected output: ~65-80 MB** for the portable .exe (down from ~180-200 MB unoptimized). This is near the Electron floor since Chromium is bundled.

> For a truly tiny build (~5 MB), you'd need to switch to [Tauri](https://tauri.app/) which uses the OS webview instead of bundling Chromium.

## Usage

1. Launch the app
2. Paste text in the "Transmission" box
3. Set desired characters per second
4. Click the target window (Discord, Notepad, browser, etc.)
5. Press **F2** — typing begins after a brief delay
6. Press **Esc** to abort early

## Requirements

- **Windows 10/11** (uses PowerShell SendKeys)
- **Node.js 18+** for building
