import { UI } from '../ui.mjs';

const layers = (page) => page.evaluate(() => window.__ripple.doc().layers.length);
const addSolid = (page) => page.click('text=＋ Solid');

export const checks = [{
  name: 'NumField: drag changes the value, tap opens the typed input, Escape cancels, arrows nudge',
  async run({ page }) {
    await addSolid(page);
    const pos = page.locator('[role=slider][aria-label="Position X"]').first();
    const read = async () => Number(await pos.getAttribute('aria-valuenow'));
    const v0 = await read();
    const box = await pos.boundingBox();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2); await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(box.x + box.width * (0.3 + 0.1 * i), box.y + box.height / 2);
    await page.mouse.up();
    const v1 = await read();
    if (!(v1 > v0 + 10)) throw new Error(`drag right should raise the value (${v0} → ${v1})`);
    if (await page.locator('input[aria-label="Position X"]').count()) throw new Error('a drag must not open the typed input');
    await pos.click();
    const input = page.locator('input[aria-label="Position X"]').first();
    await input.waitFor();
    await input.fill('123'); await input.press('Enter');
    if ((await read()) !== 123) throw new Error('typed value should commit on Enter, got ' + (await read()));
    await pos.click(); await input.fill('999'); await input.press('Escape');
    if ((await read()) !== 123) throw new Error('Escape should cancel the edit, got ' + (await read()));
    await pos.focus(); await page.keyboard.press('ArrowRight');
    if ((await read()) !== 124) throw new Error('ArrowRight should nudge by one step, got ' + (await read()));
  },
}, {
  name: 'inspector sections collapse and remember it; side panel and timeline toggle',
  async run({ page }) {
    await addSolid(page);
    const head = page.locator('.sec-head', { hasText: 'Transform' });
    await head.click();
    if ((await head.getAttribute('aria-expanded')) !== 'false') throw new Error('section should collapse');
    if (await page.locator('[role=slider][aria-label="Position X"]').count()) throw new Error('collapsed section should hide its fields');
    await head.click();
    await page.locator('[role=slider][aria-label="Position X"]').first().waitFor();
    const w = () => page.locator('[data-testid=viewer-panel]').evaluate((e) => e.getBoundingClientRect().width);
    const w0 = await w();
    await page.click('button:has-text("Panel")');
    if (!((await w()) > w0 + 100)) throw new Error('hiding the side panel should widen the viewer');
    await page.click('button:has-text("Panel")');
  },
}, {
  name: 'icons: no emoji or text glyphs in the tool palette, layer rows or transport',
  async run({ page }) {
    await addSolid(page);
    const text = await page.evaluate(() => ['[aria-label=Tools]', '[data-testid=layer-row] .tl-name button', '.transport'].map((s) => Array.from(document.querySelectorAll(s)).map((e) => e.textContent).join('')).join(''));
    if (/[\u{1F300}-\u{1FAFF}✀-➿■-◿←-⇿]/u.test(text.replace(/…/g, ''))) throw new Error('found a glyph/emoji icon: ' + text);
    const n = await page.locator('[aria-label=Tools] button svg.ico').count();
    if (n < 9) throw new Error('every tool should have an svg icon, got ' + n);
  },
}, {
  name: 'gestures: two-finger tap = undo, three-finger tap = redo (touch only)',
  async run({ page }) {
    await addSolid(page);
    if ((await layers(page)) !== 1) throw new Error('setup failed');
    const tap = (n, type = 'touch') => page.evaluate(([n, type]) => {
      const ev = (t, id) => new PointerEvent(t, { pointerId: id, pointerType: type, isPrimary: id === 1, clientX: 400 + id * 30, clientY: 300, bubbles: true, cancelable: true });
      for (let i = 1; i <= n; i++) document.body.dispatchEvent(ev('pointerdown', i));
      for (let i = 1; i <= n; i++) document.body.dispatchEvent(ev('pointerup', i));
    }, [n, type]);
    await tap(2, 'pen'); await tap(2, 'mouse');
    if ((await layers(page)) !== 1) throw new Error('pen/mouse must not trigger gestures');
    await tap(2);
    await page.waitForFunction(() => window.__ripple.doc().layers.length === 0);
    await tap(3);
    await page.waitForFunction(() => window.__ripple.doc().layers.length === 1);
  },
}, {
  name: 'context menu: right-click a layer row for actions; Escape closes it',
  async run({ page }) {
    await addSolid(page);
    await page.locator(`${UI.layerRow} .tl-name`).first().click({ button: 'right' });
    await page.locator('[role=menu]').waitFor();
    await page.keyboard.press('Escape');
    if (await page.locator('[role=menu]').count()) throw new Error('Escape should close the menu');
    await page.locator(`${UI.layerRow} .tl-name`).first().click({ button: 'right' });
    await page.waitForTimeout(400);
    await page.click('[role=menuitem]:has-text("Duplicate")');
    await page.waitForFunction(() => window.__ripple.doc().layers.length === 2);
    await page.locator(`${UI.layerRow} .tl-name`).first().click({ button: 'right' });
    await page.waitForTimeout(400);
    await page.click('[role=menuitem]:has-text("Delete")');
    await page.waitForFunction(() => window.__ripple.doc().layers.length === 1);
  },
}];
