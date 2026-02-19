# ✦ Auto Typer

A desktop auto-typer for Windows with advanced pacing controls, live run analytics, and utility tools for preparing text before typing.

## Features

- **Humanized letter-by-letter typing** with bursts/slows, punctuation pauses, and optional typo correction.
- **WPM persistence control** to tune how tightly the typing speed adheres to your configured target.
- **Live session analytics** including elapsed time, mistake count, lowest WPM, and highest WPM.
- **Resizable window** with on-demand width/height controls in-app.
- **Theme selector** (8 styles including Cozy, Diamond, Onyx, Synthwave, and more).
- **Command Center tools panel** with 22 one-click operations for cleaning, formatting, extracting, and organizing docs.
- **Doc-centric utilities** including sentence case, outline builder, meeting note formatter, slugify, line sorters, reading time, and deep text stats.
- **Global hotkey** (F2 by default), plus Escape abort and always-on-top toggle.

## Setup

```bash
npm install
npm start             # dev mode
npm run build         # → dist/AutoTyper.exe (portable, no installer)
npm run build-dir     # → dist/win-unpacked/ (unpackaged, for inspection)
```

## Usage

1. Launch the app.
2. Paste text into the **Text** panel.
3. Configure base speed and optional persistence in **Flow**.
4. Use **Tools** if needed to transform/clean text.
5. Focus your target app (Notepad, browser, Discord, etc.).
6. Press **F2** or click **Start**.
7. Review timing, mistakes, and WPM range in **Stats**.

## Requirements

- **Windows 10/11** (typing backend uses PowerShell SendKeys).
- **Node.js 18+** for development/building.
