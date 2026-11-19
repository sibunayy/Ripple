// One-off: splits legacy/ripple-flow-console.html into the phase 1 Vite layout.
// Every byte of CSS and JS is copied verbatim; only the wrappers (<style>, <script>) change.
import fs from 'node:fs';
const src = fs.readFileSync('legacy/ripple-flow-console.html', 'utf8');
const L = src.split('\n');
const lines = (a, b) => L.slice(a - 1, b).join('\n') + '\n'; // 1-based, inclusive
const strip = (s, re) => s.replace(re, '');
fs.mkdirSync('src/styles', { recursive: true });
const hostCss = L[0].match(/<style>(.*?)<\/style>/)[1] + '\n';
const C = 12; // line offset of the main <style> block (line 13 is "<style>")
const css = {
  '00-host.css': hostCss,
  '01-misc.css': strip(lines(2, 9), /^<style>/),
  '02-tokens.css': lines(C + 2, C + 57),
  '03-shell.css': lines(C + 58, C + 110),
  '04-panels.css': lines(C + 111, C + 141),
  '05-inspector.css': lines(C + 142, C + 243),
  '06-lists.css': lines(C + 244, C + 290),
  '07-viewport.css': lines(C + 291, C + 347),
  '08-timeline.css': lines(C + 348, C + 397),
  '09-overlays.css': lines(C + 398, C + 507),
  '10-drawing.css': lines(C + 508, C + 531),
  '11-inspector-v8.css': lines(C + 532, C + 582),
};
if (L[C + 583 - 1] !== '</style>') throw new Error('main style block end moved: ' + L[C + 582]);
for (const [n, c] of Object.entries(css)) fs.writeFileSync('src/styles/' + n, c);
fs.writeFileSync('src/styles/index.css', '/* Cascade order is the source order. The v8 inspector pass must stay last. */\n' + Object.keys(css).map((n) => `@import './${n}';`).join('\n') + '\n');
// Check: concatenated CSS equals the source CSS.
const joined = Object.values(css).slice(1).join('');
const orig = strip(lines(2, 9), /^<style>/) + lines(C + 2, C + 582);
if (joined !== orig) throw new Error('CSS split is not lossless');
// DOM skeleton: from <div class="app"...> to the closing </div> before <script>.
const start = L.findIndex((l) => l.startsWith('<div class="app anim" id="app"')) + 1;
const scr = L.findIndex((l) => l === '<script>') + 1;
const dom = lines(start, scr - 2);
const end = L.findIndex((l, i) => i > scr && l === '</script>') + 1;
const js = lines(scr + 1, end - 1);
fs.writeFileSync('src/legacy-main.ts', '// @ts-nocheck\n// Phase 1: the prototype script, moved verbatim. Phase 2 splits it into modules.\nimport \'./styles/index.css\';\n\n' + js);
const title = L.find((l) => l.startsWith('<title>'));
const meta = L.find((l) => l.startsWith('<meta name="claude:'));
fs.writeFileSync('index.html', `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">
${title}
${meta}
</head><body>
<!-- Keep an element before #app: the prototype's <style> sat here, so #app is not :first-child (the .anim:first-child rule must not match it). -->
<noscript>RippleFlow needs JavaScript.</noscript>
${dom}
<script type="module" src="/src/legacy-main.ts"></script>
</body></html>
`);
console.log({ start, scr, end, cssFiles: Object.keys(css).length, jsLines: js.split('\n').length });
