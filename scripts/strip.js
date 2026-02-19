"use strict";

const fs = require("fs/promises");
const path = require("path");

const KEEP_LOCALES = new Set(["en-US.pak"]);
const FILES_TO_REMOVE = [
  "LICENSE",
  "LICENSES.chromium.html",
  "chrome_100_percent.pak",
  "chrome_200_percent.pak",
  "vk_swiftshader_icd.json",
];

async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function removePath(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function pruneLocales(localesDir) {
  const st = await safeStat(localesDir);
  if (!st || !st.isDirectory()) return;

  const entries = await fs.readdir(localesDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && !KEEP_LOCALES.has(entry.name))
      .map((entry) => removePath(path.join(localesDir, entry.name)))
  );
}

async function stripBuild(context) {
  const appOutDir = context?.appOutDir;
  const electronPlatformName = context?.electronPlatformName;

  if (!appOutDir) {
    console.log("[afterPack] Skipping strip: missing appOutDir");
    return;
  }

  if (electronPlatformName !== "win32") {
    console.log(`[afterPack] Skipping strip for platform: ${electronPlatformName || "unknown"}`);
    return;
  }

  const localesDir = path.join(appOutDir, "locales");
  await pruneLocales(localesDir);

  await Promise.all(
    FILES_TO_REMOVE.map((fileName) => removePath(path.join(appOutDir, fileName)))
  );

  console.log("[afterPack] Build output stripped successfully");
}

module.exports = stripBuild;
