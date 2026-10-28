/* Builds dist/classic-friends-demo.html — the whole app in ONE file (demo mode, no server needed).
   Run: npm run build:demo   → open dist/classic-friends-demo.html or host it anywhere (Netlify, GitHub Pages, S3). */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const read = p => fs.readFileSync(p, 'utf8');
const mime = { woff2: 'font/woff2', svg: 'image/svg+xml', png: 'image/png' };
const dataUri = p => `data:${mime[path.extname(p).slice(1)] || 'application/octet-stream'};base64,${fs.readFileSync(p).toString('base64')}`;

let html = read(path.join(APP, 'index.html'));

// 1. inline stylesheets (fonts become data URIs)
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  let css = read(path.join(APP, href));
  css = css.replace(/url\("\.\.\/assets\/fonts\/([^"]+)"\)/g, (mm, f) => `url("${dataUri(path.join(APP, 'assets/fonts', f))}")`);
  return `<style>\n${css}\n</style>`;
});
// 2. inline scripts, forcing demo mode right after config.js
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const file = src.startsWith('../') ? path.join(ROOT, src.slice(3)) : path.join(APP, src);
  let js = read(file);
  if (src.endsWith('config.js')) js += "\nwindow.CF_CONFIG.MODE = 'demo';";
  return `<script>\n${js}\n</script>`;
});
// 3. logo → data URI, drop manifest + service worker (single file has nothing to install)
const logo = dataUri(path.join(APP, 'assets/logo.svg'));
html = html.replace(/assets\/logo\.svg/g, logo);
html = html.replace(/<link rel="manifest"[^>]*>\n?/g, '').replace(/<script>\s*\/\/ Offline shell cache[\s\S]*?<\/script>/, '');
html = html.replace(/href="site\//g, 'href="../website/');
html = html.replace('<title>Classic Friends — Voice rooms & friends</title>', '<title>Classic Friends — Voice rooms & friends (demo)</title>');

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'classic-friends-demo.html');
fs.writeFileSync(out, html);
console.log(`built ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
