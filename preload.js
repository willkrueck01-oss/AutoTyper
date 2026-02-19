const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  registerHotkey: (key) => ipcRenderer.invoke("register-hotkey", key),
  startTyping: (text, speed, options) => ipcRenderer.send("start-typing", { text, speed, options }),
  stopTyping: () => ipcRenderer.send("stop-typing"),
  minimize: () => ipcRenderer.send("minimize-window"),
  close: () => ipcRenderer.send("close-window"),
  toggleAOT: () => ipcRenderer.invoke("toggle-aot"),
  onTypingStatus: (cb) => ipcRenderer.on("typing-status", (_e, d) => cb(d)),
  onRequestText: (cb) => ipcRenderer.on("request-text", () => cb()),
});
