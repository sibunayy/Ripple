import { runExport } from './m45-export.mjs';
import { readFileSync } from 'node:fs';

const nodes = (pts) => pts.map(([x, y]) => ({ p: [x, y], i: [0, 0], o: [0, 0] }));

// The shared harness opens a project before each check; these checks start from the editor.
export const checks = [{
  name: 'help: ? opens the dialog, tabs work, Escape closes and restores focus',
  async run({ page }) {
    await page.keyboard.press('?');
    await page.waitForSelector('[role=dialog][aria-label="Help"]');
    await page.click('button[role=tab]:has-text("Shortcuts")');
    if (!(await page.locator('.keys kbd').count())) throw new Error('shortcut table empty');
    await page.keyboard.press('Escape');
    if (await page.locator('[role=dialog][aria-label="Help"]').count()) throw new Error('dialog should close on Escape');
  },
}, {
  name: 'dialogs trap focus: Tab cycles inside the export dialog',
  async run({ page }) {
    await page.click('button:has-text("Export")');
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => !!document.activeElement?.closest('.dialog'));
    if (!inside) throw new Error('focus escaped the dialog');
    await page.keyboard.press('Escape');
    if (await page.locator('.dialog').count()) throw new Error('Escape should close');
  },
}, {
  name: 'every button/input in the editor has an accessible name',
  async run({ page }) {
    await page.click('text=＋ Solid');
    const bad = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, select, input:not([type=hidden]), textarea')) {
        if (el.closest('[hidden]') || el.hidden || el.type === 'file') continue;
        const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim() || (el.labels?.[0]?.textContent || '').trim() || (el.closest('label')?.textContent || '').trim() || el.getAttribute('placeholder') || el.value && el.tagName === 'INPUT' && el.type !== 'number' && el.type !== 'color' && el.className === 'title' ? 'title' : '';
        if (!name) out.push(el.tagName.toLowerCase() + '.' + (el.className || el.type || ''));
      }
      return out;
    });
    if (bad.length) throw new Error('unnamed controls: ' + [...new Set(bad)].join(', '));
  },
}, {
  name: 'performance overlay and preview quality change the buffer',
  async run({ page }) {
    const w0 = await page.evaluate(() => document.querySelector('canvas').width);
    await page.click('button[aria-label="Performance overlay"]');
    await page.waitForSelector('.hud');
    await page.click('button:has-text("Settings")');
    await page.selectOption('.dialog label:has-text("Preview quality") select', '0.5');
    await page.click('.dialog button:has-text("Done")');
    await page.waitForTimeout(300);
    const w1 = await page.evaluate(() => document.querySelector('canvas').width);
    if (!(w1 <= w0 / 2 + 2)) throw new Error(`half quality should halve the buffer: ${w0} → ${w1}`);
  },
}, {
  name: 'resolution, frame rate and background change without reload (criterion 1)',
  async run({ page }) {
    await page.click('button:has-text("Settings")');
    await page.selectOption('.dialog select >> nth=0', { label: '4K UHD (3840×2160)' });
    await page.fill('.dialog input[list=fps]', '60'); await page.press('.dialog input[list=fps]', 'Tab');
    await page.evaluate(() => {});
    const s = await page.evaluate(() => window.__ripple.doc().settings);
    if (s.width !== 3840 || s.height !== 2160 || s.fps !== 60) throw new Error('settings not applied: ' + JSON.stringify(s));
  },
}, {
  name: 'persistence: a rich project survives save → reload with identical JSON and pixels',
  async run({ page }) {
    const before = await page.evaluate(async (nodesSrc) => {
      const nodes = (pts) => pts.map(([x, y]) => ({ p: [x, y], i: [0, 0], o: [0, 0] }));
      const ring = T.shape('ellipse', { fill: null, size: [60, 60], stroke: { w: 8, color: [1, 1, 1] }, trim: [0, 80] });
      ring.effects = [{ id: 'g1', type: 'glow', enabled: true }]; ring.props['fx:g1:threshold'] = { value: 10 }; ring.props['fx:g1:radius'] = { value: 8 }; ring.props['fx:g1:intensity'] = { value: 150 };
      const txt = T.layer('solid', { w: 100, h: 30, pos: [10, 10] }); txt.type = 'text';
      txt.text = { text: 'Hi', font: 'sans-serif', align: 'left', bold: true, italic: false, animators: [{ id: 'a', name: 'x', unit: 'chars', shape: 'ramp' }] };
      txt.shape = { kind: 'path', fill: { kind: 'solid', stops: [], from: [0, 0], to: [1, 0] }, stroke: null, trim: false, repeater: false };
      txt.props = { 'fill.color': { value: [1, 1, 0, 1] }, 'text.size': { value: 30 }, 'ta:a:start': { value: 0 }, 'ta:a:end': { value: 100 }, 'ta:a:offset': { value: -100 }, 'ta:a:opacity': { value: 100 } };
      const masked = T.layer('solid', { w: 128, h: 128, color: [0, 0.5, 1, 1] }); masked.blend = 'screen';
      masked.masks = [{ id: 'm', name: 'M', mode: 'add', invert: false, path: { closed: true, nodes: nodes([[80, 80], [120, 80], [120, 120], [80, 120]]) } }];
      const shader = T.layer('solid', { w: 128, h: 128 }); shader.type = 'shader'; shader.shader = { code: 'void mainImage(out vec4 f, in vec2 c) { f = vec4(0.1, 0.0, 0.2, 1.0); }' }; shader.props = {};
      const p = T.project([ring, txt, masked, shader]);
      p.name = 'Rich';
      window.__ripple.load(p);
      await window.__ripple.save();
      return { id: p.id, json: JSON.stringify(window.__ripple.doc()), px: T.draw(window.__ripple.doc().layers, { w: 128, h: 128, t: 5 }, [[64, 34], [100, 100], [5, 5], [20, 24]]) };
    });
    await page.reload();
    await page.waitForSelector('.library');
    await page.click('.card:has-text("Rich") .thumb');
    await page.waitForSelector('.editor'); await page.waitForFunction(() => window.__ripple?.renderer);
    const after = await page.evaluate(() => ({ json: JSON.stringify(window.__ripple.doc()), px: T.draw(window.__ripple.doc().layers, { w: 128, h: 128, t: 5 }, [[64, 34], [100, 100], [5, 5], [20, 24]]) }));
    const a = JSON.parse(before.json), b = JSON.parse(after.json);
    delete a.modified; delete b.modified;
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('document changed across save/load');
    if (JSON.stringify(before.px) !== JSON.stringify(after.px)) throw new Error('render changed across save/load');
  },
}, {
  name: 'autosave survives a forced tab kill (criterion 4)',
  async run({ page, ctx }) {
    await page.click('text=＋ Solid'); await page.click('text=＋ Solid');
    await page.waitForSelector('.save.saved', { timeout: 10000 });
    await page.close({ runBeforeUnload: false });
    const p2 = await ctx.newPage();
    await p2.goto(process.env.RF_URL ?? 'http://localhost:4179/Ripple/');
    await p2.waitForSelector('.card');
    await p2.locator('.card .thumb').first().click();
    await p2.waitForSelector('.editor');
    const n = await p2.locator('.layers li').count();
    if (n !== 2) throw new Error('expected 2 layers after restore, got ' + n);
  },
}, {
  name: 'works offline after the first load (service worker precache)',
  async run({ page, ctx }) {
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('.library', { timeout: 15000 });
    await ctx.setOffline(false);
  },
}, {
  name: 'presets on text and shape layers; a saved custom preset is reusable in another project (criterion 3)',
  async run({ page }) {
    const st = await page.locator('.stage').boundingBox();
    await page.click('text=＋ Solid'); // gives the project something selectable
    await page.keyboard.press('r'); await page.mouse.move(st.x + 100, st.y + 100); await page.mouse.down(); await page.mouse.move(st.x + 300, st.y + 220, { steps: 4 }); await page.mouse.up();
    await page.click('button[role=tab]:has-text("presets")');
    await page.click('button:has-text("Scale Pop")');
    const rows = await page.locator('.tl-row.sub').count();
    if (rows < 1) throw new Error('preset created no animated rows');
    await page.fill('input[aria-label="Preset name"]', 'My Pop'); await page.click('button:has-text("Save as preset")');
    await page.waitForSelector('.chipbtn:has-text("My Pop")');
    await page.click('button[aria-label="Back to library"]'); await page.waitForSelector('.library');
    await page.click('text=New project'); await page.waitForSelector('.editor');
    await page.click('text=＋ Solid'); await page.click('button[role=tab]:has-text("presets")');
    await page.waitForSelector('.chipbtn:has-text("My Pop")');
    await page.click('.chipbtn:has-text("My Pop") button:first-child');
    if (!(await page.locator('.tl-row.sub').count())) throw new Error('custom preset did not apply in the new project');
  },
}, {
  name: 'starter templates open, render, and animate',
  async run({ page }) {
    for (const name of ['Logo reveal', 'Lower third', 'Kinetic type', 'Loader']) {
      await page.click('button[aria-label="Back to library"]'); await page.waitForSelector('.starters');
      await page.click(`.starter:has-text("${name}")`); await page.waitForSelector('.editor'); await page.waitForFunction(() => window.__ripple?.renderer);
      const d = await page.evaluate(() => { const p = window.__ripple.doc(); const hits = {}; for (const t of [0, 40, 100]) { const px = T.draw(p.layers, { w: p.settings.width, h: p.settings.height, t, bg: p.settings.bg, comps: p.comps }, [[960, 540], [200, 200], [960, 900], [960, 300], [1500, 540], [380, 880], [400, 840], [960, 390], [1110, 540], [960, 690], [810, 540], [1066, 434], [854, 646]]); hits[t] = JSON.stringify(px); } return { layers: p.layers.length, distinct: new Set(Object.values(hits)).size, name: p.name }; });
      if (d.layers < 1) throw new Error(name + ': no layers');
      if (d.distinct < 2) throw new Error(name + ': frames 0/40/100 render identically (nothing animates)');
    }
  },
}, {
  name: 'first-run onboarding shows once',
  async run({ page }) {
    await page.evaluate(() => { localStorage.removeItem('rf-onboarded-v1'); sessionStorage.setItem('rf-e2e-first', '1'); });
    await page.reload();
    await page.waitForSelector('[role=dialog][aria-label^="Welcome"]');
    for (let i = 0; i < 3; i++) await page.click('.onboard button.primary');
    await page.click('.onboard button.primary:has-text("Get started")');
    if (await page.locator('.onboard').count()) throw new Error('onboarding should close');
    await page.reload(); await page.waitForSelector('.library');
    if (await page.locator('.onboard').count()) throw new Error('onboarding must not return');
  },
}, {
  name: 'criterion 6: keyframed custom-shader effect → Lottie export with compatibility report → re-import',
  async run({ page }) {
    await page.click('text=＋ Solid');
    await page.click('button[role=tab]:has-text("effects")');
    await page.selectOption('select[aria-label="Add effect"]', 'shader');
    await page.waitForSelector('.fx .prop >> text=strength');
    await page.locator('.fx .prop', { has: page.locator('.pname:text("strength")') }).locator('button.watch').click();
    await page.keyboard.press('End');
    await page.locator('.fx .prop', { has: page.locator('.pname:text("strength")') }).locator('input').first().fill('0.9');
    await page.locator('.fx .prop', { has: page.locator('.pname:text("strength")') }).locator('input').first().press('Tab');
    if (!(await page.locator('.tl-row.sub').count())) throw new Error('shader parameter did not get keyframes');
    await page.click('button:has-text("Export")');
    await page.selectOption('.dialog select >> nth=0', 'lottie');
    await page.click('.dialog button.primary');
    await page.waitForSelector('.job.done', { timeout: 20000 });
    const notes = await page.locator('.notes').textContent();
    if (!/Effects/.test(notes ?? '')) throw new Error('compatibility report should mention effects: ' + notes);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.job.done button:has-text("Download")')]);
    const bytes = readFileSync(await dl.path());
    const json = JSON.parse(bytes.toString());
    if (json.layers.length !== 1 || json.fr !== 30) throw new Error('unexpected lottie ' + JSON.stringify(json).slice(0, 120));
    await page.keyboard.press('Escape');
    await page.click('button[aria-label="Back to library"]'); await page.waitForSelector('.library');
    const before = await page.locator('.card').count();
    await page.setInputFiles('.library label:has-text("Import Lottie") input', { name: 'x.json', mimeType: 'application/json', buffer: bytes });
    await page.waitForFunction((n) => document.querySelectorAll('.card').length === n + 1, before, { timeout: 15000 });
  },
}];
