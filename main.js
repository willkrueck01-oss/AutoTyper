const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow = null;
let currentHotkey = "F2";
let isTyping = false;
let psProcess = null;

// ── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 560,
    resizable: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile("index.html");
  mainWindow.setAlwaysOnTop(true);
  mainWindow.on("closed", () => (mainWindow = null));
}

// ── Persistent PowerShell ───────────────────────────────────────────────────
// ONE process stays alive for the app's lifetime. We pipe SendKeys commands
// to its stdin, eliminating the ~150ms startup cost that caused jitter.

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

// ── SendKeys char escaping ──────────────────────────────────────────────────

const SK = {
  "+": "{+}", "^": "{^}", "%": "{%}", "~": "{~}",
  "(": "{(}", ")": "{)}", "{": "{{}", "}": "{}}", "[": "{[}", "]": "{]}",
  "\n": "{ENTER}", "\r": "", "\t": "{TAB}",
};
const esc = (c) => (c in SK ? SK[c] : c);

// ── Typing engine ───────────────────────────────────────────────────────────

async function doType(text, cps) {
  isTyping = true;
  const len = text.length;
  mainWindow?.webContents.send("typing-status", { state: "typing", total: len, done: 0 });

  const msPerChar = 1000 / cps;

  for (let i = 0; i < len; i++) {
    if (!isTyping) {
      mainWindow?.webContents.send("typing-status", { state: "stopped" });
      return;
    }

    const ch = esc(text[i]);
    if (ch === "") continue;

    const t0 = Date.now();
    try {
      await sendKey(ch);
    } catch (_e) {
      mainWindow?.webContents.send("typing-status", { state: "error" });
      isTyping = false;
      return;
    }

    // Progress updates (throttled)
    if (i % 4 === 0) {
      mainWindow?.webContents.send("typing-status", { state: "typing", total: len, done: i + 1 });
    }

    // Sleep remainder to maintain target CPS
    const wait = msPerChar - (Date.now() - t0);
    if (wait > 2) await new Promise((r) => setTimeout(r, wait));
  }

  isTyping = false;
  mainWindow?.webContents.send("typing-status", { state: "done", total: len, done: len });
}

// ── Hotkey management ───────────────────────────────────────────────────────

function registerHotkey(key) {
  globalShortcut.unregisterAll();
  currentHotkey = key;

  const ok = globalShortcut.register(key, () => {
    if (isTyping) { isTyping = false; return; }
    mainWindow?.webContents.send("request-text");
  });

  globalShortcut.register("Escape", () => { if (isTyping) isTyping = false; });
  return ok;
}

// ── IPC ─────────────────────────────────────────────────────────────────────

ipcMain.handle("register-hotkey", (_e, key) => registerHotkey(key));

ipcMain.on("start-typing", (_e, { text, speed }) => {
  if (!isTyping && text.trim()) setTimeout(() => doType(text, speed), 400);
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

// ── Lifecycle ───────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  registerHotkey(currentHotkey);
  ensurePS();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (psProcess && !psProcess.killed) { psProcess.stdin.end(); psProcess.kill(); }
});

app.on("window-all-closed", () => app.quit());
