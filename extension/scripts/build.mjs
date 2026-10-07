// Builds the extension into extension/dist.
//   node scripts/build.mjs                      production build
//   node scripts/build.mjs --mode development   dev build (adds localhost:3000)
// Env: TROVE_URL sets the Trove Web URL baked in as the default and added to host_permissions.
//
// Plain Vite (no crxjs): content scripts must be classic, self-contained scripts so that
// capture.js runs synchronously at document_start in the MAIN world.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { iconPng } from "./icons.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "src");
const dist = resolve(root, "dist");

const modeArg = process.argv.indexOf("--mode");
const mode = modeArg !== -1 ? process.argv[modeArg + 1] : "production";
const dev = mode === "development";

const rawUrl = (process.env.TROVE_URL || (dev ? "http://localhost:3000" : "https://trove.vercel.app")).trim().replace(/\/+$/, "");
let troveOrigin;
try {
  troveOrigin = new URL(rawUrl).origin;
} catch {
  console.error(`TROVE_URL is not a valid URL: ${rawUrl}`);
  process.exit(1);
}

const define = {
  __TROVE_URL__: JSON.stringify(rawUrl),
  __DEV__: JSON.stringify(dev),
  "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"),
};

rmSync(dist, { recursive: true, force: true });

// 1. Popup and options pages (React + Tailwind).
await build({
  configFile: false,
  root: src,
  base: "./",
  mode,
  define,
  logLevel: "warn",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: dist,
    emptyOutDir: false,
    minify: !dev,
    sourcemap: dev ? "inline" : false,
    rollupOptions: {
      input: {
        popup: resolve(src, "popup/index.html"),
        options: resolve(src, "options/index.html"),
      },
    },
  },
});

// 2. Service worker and content scripts: one self-contained IIFE each.
for (const name of ["background", "capture", "bridge", "runner"]) {
  await build({
    configFile: false,
    root,
    mode,
    define,
    logLevel: "warn",
    build: {
      outDir: dist,
      emptyOutDir: false,
      minify: !dev,
      sourcemap: dev ? "inline" : false,
      copyPublicDir: false,
      rollupOptions: {
        input: resolve(src, `${name}.ts`),
        output: { format: "iife", entryFileNames: `${name}.js` },
      },
    },
  });
}

// 3. Icons.
const iconSizes = [16, 32, 48, 128];
mkdirSync(resolve(dist, "icons"), { recursive: true });
const icons = {};
for (const size of iconSizes) {
  writeFileSync(resolve(dist, `icons/icon${size}.png`), iconPng(size));
  icons[size] = `icons/icon${size}.png`;
}

// 4. Manifest.
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const hostPermissions = [
  "https://x.com/*",
  "https://twitter.com/*",
  `${troveOrigin}/*`,
  ...(dev ? ["http://localhost:3000/*"] : []),
].filter((v, i, a) => a.indexOf(v) === i);

const manifest = {
  manifest_version: 3,
  name: "XBookmarkVault",
  version: pkg.version,
  ...(dev ? { version_name: `${pkg.version} dev` } : {}),
  description: "Syncs your X bookmarks to XBookmarkVault when you ask it to.",
  minimum_chrome_version: "111",
  permissions: ["storage", "scripting", "tabs"],
  host_permissions: hostPermissions,
  background: { service_worker: "background.js" },
  action: { default_title: "XBookmarkVault", default_popup: "popup/index.html", default_icon: icons },
  options_ui: { page: "options/index.html", open_in_tab: true },
  icons,
  content_scripts: [
    { matches: ["https://x.com/*"], js: ["capture.js"], run_at: "document_start", world: "MAIN" },
    { matches: ["https://x.com/*"], js: ["bridge.js"], run_at: "document_start" },
  ],
};
writeFileSync(resolve(dist, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`XBookmarkVault extension built (${mode}) -> ${dist}`);
console.log(`  Site URL: ${rawUrl}`);
console.log(`  host_permissions: ${hostPermissions.join(", ")}`);
