/* Renders the HTML guides to PDF with Chromium (Playwright).
   node build-guides.js            → builds all guides (add a file name to build one)
   Requires: npm i -D playwright  (and a Chromium build: npx playwright install chromium) */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { execSync } = require('child_process');

const HERE = __dirname;
const GUIDES = [
  { html: 'user-guide.html', out: 'Classic-Friends-User-Guide.pdf', footer: 'Classic Friends · User Guide' },
  { html: 'admin-guide.html', out: 'Classic-Friends-Admin-Console-Guide.pdf', footer: 'Classic Friends · Admin Console Guide' },
  { html: 'hosting-guide.html', out: 'Classic-Friends-Installation-Hosting-Guide.pdf', footer: 'Classic Friends · Installation & Hosting Guide' }
];
const ONLY = process.argv[2];   // optional: build a single guide, e.g. node build-guides.js hosting-guide.html
const footerTemplate = label => `<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7.5px;color:#8E86B3;padding:0 18mm;display:flex;justify-content:space-between;align-items:center"><span>${label}</span><span>Page <span class="pageNumber"></span></span></div>`;

async function renderBody(browser, file, label, tocMap) {
  const page = await browser.newPage();
  await page.goto('file://' + path.join(HERE, file) + '?part=body', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; });
  if (tocMap) await page.evaluate(map => { document.querySelectorAll('[data-toc]').forEach(el => { const n = map[el.dataset.toc]; if (n) el.parentElement.querySelector('.p').textContent = n; }); }, tocMap);
  const pdf = await page.pdf({ format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footerTemplate(label), margin: { top: '16mm', bottom: '16mm', left: '18mm', right: '18mm' }, preferCSSPageSize: false });
  await page.close();
  return pdf;
}
async function renderCover(browser, file) {
  const page = await browser.newPage();
  await page.goto('file://' + path.join(HERE, file) + '?part=cover', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; });
  const pdf = await page.pdf({ width: '210mm', height: '297mm', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 }, pageRanges: '1' });
  await page.close();
  return pdf;
}
// find the page (1-based, within the body PDF) where each TOC title first appears as a chapter heading
function pageMap(pdfPath, titles) {
  const text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  const pages = text.split('\f');
  const map = {};
  titles.forEach((t, idx) => {
    const re = new RegExp('CHAPTER ' + (idx + 1) + '\\b');   // chapter banner text, not a mention in body copy
    for (let i = 1; i < pages.length; i++) {   // skip the TOC page itself (page 1)
      const norm = pages[i].replace(/\s+/g, ' ');
      if (re.test(norm) && norm.includes(t)) { map[t] = String(i + 1); break; }
    }
  });
  return map;
}

(async () => {
  const browser = await chromium.launch();
  for (const g of GUIDES) {
    if (ONLY && g.html !== ONLY) continue;
    if (!fs.existsSync(path.join(HERE, g.html))) { console.log('skip', g.html); continue; }
    const tmpBody = path.join(HERE, '.body.pdf'), tmpCover = path.join(HERE, '.cover.pdf');
    // pass 1: body without TOC numbers → learn page numbers
    fs.writeFileSync(tmpBody, await renderBody(browser, g.html, g.footer, null));
    const titles = [...fs.readFileSync(path.join(HERE, g.html), 'utf8').matchAll(/data-toc="([^"]+)"/g)].map(m => m[1]);
    const map = pageMap(tmpBody, titles);
    // pass 2: with TOC numbers
    fs.writeFileSync(tmpBody, await renderBody(browser, g.html, g.footer, map));
    fs.writeFileSync(tmpCover, await renderCover(browser, g.html));
    const out = path.join(HERE, g.out);
    execSync(`qpdf --empty --pages "${tmpCover}" "${tmpBody}" -- "${out}"`);
    fs.unlinkSync(tmpBody); fs.unlinkSync(tmpCover);
    const pages = execSync(`qpdf --show-npages "${out}"`, { encoding: 'utf8' }).trim();
    console.log(`built ${g.out} — ${pages} pages, ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
