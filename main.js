const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let isTyping = false;
let currentHotkey = "F2";
let psProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 620,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile("index.html");
  mainWindow.setAlwaysOnTop(true);
  mainWindow.on("closed", () => (mainWindow = null));
}

function ensurePS() {
  if (psProcess && !psProcess.killed) return;
  psProcess = spawn("powershell", ["-NoProfile", "-NoLogo", "-Command", "-"], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  psProcess.stdin.write("Add-Type -AssemblyName System.Windows.Forms\n");
  psProcess.on("exit", () => (psProcess = null));
}

function sendKey(skStr) {
  return new Promise((resolve) => {
    ensurePS();
    if (!psProcess) return resolve();
    const safe = skStr.replace(/'/g, "''");
    psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait('${safe}')\n`);
    setTimeout(resolve, 4);
  });
}

const SK = {
  "+": "{+}", "^": "{^}", "%": "{%}", "~": "{~}",
  "(": "{(}", ")": "{)}", "{": "{{}", "}": "{}}", "[": "{[}", "]": "{]}",
  "\n": "{ENTER}", "\r": "", "\t": "{TAB}",
};
const esc = (c) => (c in SK ? SK[c] : c);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function buildHumanProfile(cps, options = {}) {
  const baseCps = clamp(Number(cps) || 20, 1, 500);
  const pauseEveryMin = clamp(Number(options.pauseEveryMin) || 1, 1, 15);
  const pauseEveryMax = clamp(Number(options.pauseEveryMax) || 15, pauseEveryMin, 15);
  const pauseMsMin = clamp(Number(options.pauseMsMin) || 80, 20, 5000);
  const pauseMsMax = clamp(Number(options.pauseMsMax) || 420, pauseMsMin, 8000);
  const startupDelayMin = clamp(Number(options.startupDelayMin) || 300, 0, 10000);
  const startupDelayMax = clamp(Number(options.startupDelayMax) || 750, startupDelayMin, 10000);
  const typoRatePercent = clamp(Number(options.typoRatePercent) || 2, 0, 12);
  const correctionSpeed = clamp(Number(options.correctionSpeed) || 3, 1, 5);

  const speedScale = 2.1 - correctionSpeed * 0.32;

  return {
    enabled: options.humanized !== false,
    pauseEveryMin,
    pauseEveryMax,
    pauseMsMin,
    pauseMsMax,
    startupDelayMin,
    startupDelayMax,
    burstChance: 0.16,
    slowChance: 0.14,
    punctuationPauseChance: 0.85,
    punctuationExtraMin: 120,
    punctuationExtraMax: 420,
    wordPauseChance: 0.32,
    wordPauseMin: 30,
    wordPauseMax: 120,
    baseMs: 1000 / baseCps,
    typoChance: typoRatePercent / 100,
    correctionDelayMin: clamp(25 * speedScale, 8, 80),
    correctionDelayMax: clamp(120 * speedScale, 25, 220),
    postCorrectionMin: clamp(45 * speedScale, 12, 95),
    postCorrectionMax: clamp(150 * speedScale, 35, 260),
  };
}

function nextDelay(ch, profile) {
  let delay = profile.baseMs;

  if (!profile.enabled) {
    return delay;
  }

  if (Math.random() < profile.burstChance) {
    delay *= rand(0.35, 0.75);
  } else if (Math.random() < profile.slowChance) {
    delay *= rand(1.35, 2.6);
  } else {
    delay *= rand(0.82, 1.2);
  }

  if (/[,.!?;:]/.test(ch) && Math.random() < profile.punctuationPauseChance) {
    delay += rand(profile.punctuationExtraMin, profile.punctuationExtraMax);
  }

  if (ch === " " && Math.random() < profile.wordPauseChance) {
    delay += rand(profile.wordPauseMin, profile.wordPauseMax);
  }

  return clamp(delay, 4, 4000);
}

async function maybeTypoFix(ch, profile) {
  if (!profile.enabled) return;
  if (!/[a-zA-Z]/.test(ch)) return;
  if (Math.random() > profile.typoChance) return;

  const wrong = Math.random() > 0.5 ? "x" : "e";
  await sendKey(wrong);
  await sleep(rand(profile.correctionDelayMin, profile.correctionDelayMax));
  await sendKey("{BACKSPACE}");
  await sleep(rand(profile.postCorrectionMin, profile.postCorrectionMax));
}

async function doType(text, cps, options = {}) {
  isTyping = true;
  const len = text.length;
  const profile = buildHumanProfile(cps, options);
  let charsUntilPause = Math.floor(rand(profile.pauseEveryMin, profile.pauseEveryMax + 1));

  mainWindow?.webContents.send("typing-status", { state: "typing", total: len, done: 0 });

  for (let i = 0; i < len; i++) {
    if (!isTyping) {
      mainWindow?.webContents.send("typing-status", { state: "stopped" });
      return;
    }

    const rawCh = text[i];
    const ch = esc(rawCh);
    if (ch === "") continue;

    const t0 = Date.now();

    try {
      await maybeTypoFix(rawCh, profile);
      await sendKey(ch);
    } catch (_e) {
      mainWindow?.webContents.send("typing-status", { state: "error" });
      isTyping = false;
      return;
    }

    if (i % 3 === 0 || i === len - 1) {
      mainWindow?.webContents.send("typing-status", { state: "typing", total: len, done: i + 1 });
    }

    charsUntilPause -= 1;
    if (profile.enabled && charsUntilPause <= 0) {
      await sleep(rand(profile.pauseMsMin, profile.pauseMsMax));
      charsUntilPause = Math.floor(rand(profile.pauseEveryMin, profile.pauseEveryMax + 1));
    }

    const wait = nextDelay(rawCh, profile) - (Date.now() - t0);
    if (wait > 2) {
      await sleep(wait);
    }
  }

  isTyping = false;
  mainWindow?.webContents.send("typing-status", { state: "done", total: len, done: len });
}

function registerHotkey(key) {
  globalShortcut.unregisterAll();
  currentHotkey = key;

  const ok = globalShortcut.register(key, () => {
    if (isTyping) {
      isTyping = false;
      return;
    }
    mainWindow?.webContents.send("request-text");
  });

  globalShortcut.register("Escape", () => {
    if (isTyping) isTyping = false;
  });
  return ok;
}

ipcMain.handle("register-hotkey", (_e, key) => registerHotkey(key));

ipcMain.on("start-typing", (_e, payload) => {
  const text = payload?.text || "";
  const speed = payload?.speed;
  const options = payload?.options || {};
  if (!isTyping && text.trim()) {
    const profile = buildHumanProfile(speed, options);
    const startupDelay = Math.floor(rand(profile.startupDelayMin, profile.startupDelayMax + 1));
    setTimeout(() => doType(text, speed, options), startupDelay);
  }
});

ipcMain.on("stop-typing", () => (isTyping = false));
ipcMain.on("minimize-window", () => mainWindow?.minimize());
ipcMain.on("close-window", () => app.quit());

ipcMain.handle("toggle-aot", () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(next);
  return next;
});

app.whenReady().then(() => {
  createWindow();
  registerHotkey(currentHotkey);
  ensurePS();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (psProcess && !psProcess.killed) {
    psProcess.stdin.end();
    psProcess.kill();
  }
});

app.on("window-all-closed", () => app.quit());
