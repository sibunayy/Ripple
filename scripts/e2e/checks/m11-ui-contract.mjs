// The UI contract (docs/ui-contract.md): what any redesign must keep so behaviour, tests and a11y don't regress.
import { UI } from '../ui.mjs';

const ARIA = ['Back to library', 'Composition viewer', 'Tools', 'Zoom in', 'Zoom out', 'Performance overlay', 'Add solid layer', 'Add composition'];

export const checks = [{
  name: 'landmarks and required accessible controls exist in the editor',
  async run({ page }) {
    for (const k of ['editor', 'topbar', 'viewerPanel', 'stage', 'sidePanel', 'timeline']) {
      if ((await page.locator(UI[k]).count()) !== 1) throw new Error(`landmark ${k} (${UI[k]}) must exist exactly once`);
    }
    await page.click('text=＋ Solid');
    if (!(await page.locator(UI.layerRow).count())) throw new Error('layer rows need data-testid=layer-row');
    for (const label of ARIA) if (!(await page.locator(`[aria-label="${label}"]`).count())) throw new Error(`missing control with aria-label "${label}"`);
    for (const label of ['Hide layer', 'Solo layer', 'Lock layer', 'Mark layer shy', 'Layer name']) if (!(await page.locator(`${UI.layerRow} [aria-label="${label}"]`).count())) throw new Error(`layer row missing "${label}"`);
  },
}, {
  name: 'engine hooks, themes and touch rules the shell must preserve',
  async run({ page }) {
    const r = await page.evaluate(() => ({
      hooks: ['renderer', 'doc', 'load', 'save'].filter((k) => typeof window.__ripple?.[k] === 'undefined'),
      scrolls: document.documentElement.scrollHeight > innerHeight + 1 || document.body.scrollHeight > innerHeight + 1,
      tokens: ['--bg', '--surface', '--surface-2', '--line', '--text', '--muted', '--accent', '--accent-text', '--danger', '--radius', '--hit', '--name-w'].filter((t) => !getComputedStyle(document.documentElement).getPropertyValue(t).trim()),
      canvas: !!document.querySelector('[data-testid=stage] canvas[aria-label="Composition viewer"]'),
      overlay: !!document.querySelector('[data-testid=stage] svg.overlay'),
    }));
    if (r.hooks.length) throw new Error('window.__ripple missing: ' + r.hooks.join(', '));
    if (r.scrolls) throw new Error('the page itself must never scroll');
    if (r.tokens.length) throw new Error('theme tokens missing: ' + r.tokens.join(', '));
    if (!r.canvas || !r.overlay) throw new Error('stage must contain the GL canvas and the SVG overlay');
  },
}, {
  name: 'light and dark themes both render the editor with readable text',
  async run({ page }) {
    for (const scheme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme: scheme });
      const [bg, fg] = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color]);
      if (bg === fg) throw new Error(`${scheme}: text and background are identical`);
    }
  },
}];
