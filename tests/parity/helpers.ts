import { expect, type Page, type Locator } from '@playwright/test';

/**
 * Shared helpers for the parity tests.
 *
 * The app keeps its state inside a closure, so the tests only use the page itself:
 * the DOM, ARIA attributes, the SVG stage and localStorage. That way the same tests
 * run unchanged against the legacy file and the ported app.
 */

export const LS = (k: string) => `rfp-${k}`;

/** Errors seen in the page. Tests assert this stays empty. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

/**
 * Synthetic pointers (touch, Pencil, multi-touch) need setPointerCapture to accept pointer ids the
 * browser did not create. This shim only swallows that error and remembers the capture target so
 * moves can be routed like a real capture would. It does not change app code.
 */
const pointerShim = () => {
  const cap = new Map<number, Element>();
  (window as any).__rfCapture = cap;
  const set = Element.prototype.setPointerCapture, rel = Element.prototype.releasePointerCapture, has = Element.prototype.hasPointerCapture;
  Element.prototype.setPointerCapture = function (id: number) { cap.set(id, this); try { set.call(this, id); } catch { /* synthetic pointer */ } };
  Element.prototype.releasePointerCapture = function (id: number) { cap.delete(id); try { rel.call(this, id); } catch { /* synthetic pointer */ } };
  Element.prototype.hasPointerCapture = function (id: number) { return cap.get(id) === this || (() => { try { return has.call(this, id); } catch { return false; } })(); };
};

export async function openApp(page: Page, opts: { clear?: boolean; storage?: Record<string, unknown> } = {}) {
  const errors = trackErrors(page);
  await page.addInitScript(pointerShim);
  const url = process.env.RF_URL!;
  if (opts.clear !== false || opts.storage) {
    // Start from a clean slate, then seed any requested keys, before the app script reads them.
    await page.addInitScript(({ storage }) => {
      if (sessionStorage.getItem('__rfSeeded')) return;
      sessionStorage.setItem('__rfSeeded', '1');
      localStorage.clear();
      for (const [k, v] of Object.entries(storage || {})) localStorage.setItem('rfp-' + k, JSON.stringify(v));
    }, { storage: opts.storage || {} });
  }
  await page.goto(url);
  await expect(page.locator('#rpanel .phead, #tl .peek').first()).toBeVisible();
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // Two frames so the first layoutStage/placeSel in requestAnimationFrame has run.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return errors;
}

/** Reads a project value from localStorage (written by commit/saveProj). */
export async function savedProject(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('rfp-project') || 'null'));
}
export async function stored(page: Page, key: string) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), LS(key));
}

export const isPortrait = (page: Page) => page.evaluate(() => document.getElementById('app')!.classList.contains('portrait'));

type PtrOpts = { id?: number; type?: 'touch' | 'pen' | 'mouse'; pressure?: number; altitudeAngle?: number; shiftKey?: boolean };

/** Dispatches one synthetic pointer event at client (x, y). Moves and ups go to the capture target when there is one. */
export async function ptr(page: Page, kind: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel', x: number, y: number, o: PtrOpts = {}) {
  await page.evaluate(({ kind, x, y, o }) => {
    const id = o.id ?? 11, type = o.type ?? 'touch';
    const cap = (window as any).__rfCapture as Map<number, Element>;
    const tgt = (kind !== 'pointerdown' && cap.get(id)) || document.elementFromPoint(x, y) || document.body;
    const init: any = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: id, pointerType: type, isPrimary: id === 11 || id === 1,
      button: kind === 'pointermove' ? -1 : 0, buttons: kind === 'pointerup' || kind === 'pointercancel' ? 0 : 1, pressure: kind === 'pointerup' ? 0 : (o.pressure ?? .5), shiftKey: !!o.shiftKey, width: 1, height: 1 };
    const ev = new PointerEvent(kind, init);
    if (o.altitudeAngle != null) Object.defineProperty(ev, 'altitudeAngle', { value: o.altitudeAngle });
    tgt.dispatchEvent(ev);
    if (kind === 'pointerup' || kind === 'pointercancel') {
      cap.delete(id);
      // A real tap ends with a click on the element under the finger.
      if (kind === 'pointerup' && (o as any).click) (document.elementFromPoint(x, y) as HTMLElement | null)?.click();
    }
  }, { kind, x, y, o });
}

/** A press-move-release gesture with intermediate steps. */
export async function drag(page: Page, from: [number, number], to: [number, number], o: PtrOpts & { steps?: number; holdMs?: number } = {}) {
  const steps = o.steps ?? 8;
  await ptr(page, 'pointerdown', from[0], from[1], o);
  if (o.holdMs) await page.waitForTimeout(o.holdMs);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await ptr(page, 'pointermove', from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, o);
  }
  await ptr(page, 'pointerup', to[0], to[1], o);
}

/** A touch tap: pointerdown, pointerup, then click (the app reads actions from click). */
export async function tap(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const b = (await target.boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await ptr(page, 'pointerdown', x, y);
  await ptr(page, 'pointerup', x, y);
  await target.click();
}

/** Press and hold on an element (long press is 450 ms in the app). */
export async function hold(page: Page, target: Locator, ms = 600) {
  const b = (await target.boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await ptr(page, 'pointerdown', x, y);
  await page.waitForTimeout(ms);
  await ptr(page, 'pointerup', x, y);
}

/** Multi-finger tap, as the window-level touch listeners see it. */
export async function fingerTap(page: Page, fingers: number) {
  await page.evaluate((n) => {
    const fake = (type: string, count: number) => { const ev = new Event(type, { bubbles: true }); Object.defineProperty(ev, 'touches', { value: { length: count } }); return ev; };
    window.dispatchEvent(fake('touchstart', n));
    window.dispatchEvent(fake('touchend', 0));
  }, fingers);
}

export const center = async (l: Locator): Promise<[number, number]> => { const b = (await l.boundingBox())!; return [b.x + b.width / 2, b.y + b.height / 2]; };

/** The stage group for a layer id. */
export const layerG = (page: Page, id: string) => page.locator(`#stage g[data-id="${id}"]`);
/** A numeric field in the inspector by its aria-label. */
export const field = (page: Page, label: string) => page.locator(`#rpanel .fld[aria-label="${label}"]`).first();
export const fieldValue = async (page: Page, label: string) => Number(await field(page, label).getAttribute('aria-valuenow'));

/** Opens a right-panel tab (Properties, Effects, Easing, Presets) if it is not open yet. */
export async function openRight(page: Page, name: 'Properties' | 'Effects' | 'Easing' | 'Presets') {
  const b = page.locator(`#rstrip [aria-label="${name}"]`);
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
  await expect(b).toHaveAttribute('aria-pressed', 'true');
}
export async function openLeft(page: Page, name: 'Layers' | 'Assets') {
  const b = page.locator(`#lstrip [aria-label="${name}"]`);
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
  await expect(b).toHaveAttribute('aria-pressed', 'true');
}

/** Sets the playhead by stepping with the arrow keys from the current frame. */
export async function gotoFrame(page: Page, f: number) {
  const cur = Number(await page.locator('#scrub').getAttribute('aria-valuenow'));
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const d = f - cur, key = d > 0 ? 'ArrowRight' : 'ArrowLeft';
  for (let i = 0; i < Math.abs(d); i++) await page.keyboard.press(key);
  await expect(page.locator('#scrub')).toHaveAttribute('aria-valuenow', String(f));
}

/** Expands the timeline to the dope sheet with the handle tap. */
export async function expandTimeline(page: Page) {
  if ((await page.locator('#tl .tl-tools').count()) === 0) await page.locator('#tlh').click();
  await expect(page.locator('#tl .tl-tools')).toBeVisible();
  await settle(page); // the timeline grows with a transition; measure rows after it ends
}

export const toast = (page: Page) => page.locator('#toast');

/** Waits until CSS transitions and animations have finished, plus two frames. */
export async function settle(page: Page) {
  await page.waitForFunction(() => document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getComputedTiming().iterations ?? 1) !== Infinity).length === 0, null, { timeout: 5000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Finds a screen point where a tap lands on the given layer (not on a handle or another layer). */
export async function hitPoint(page: Page, id: string): Promise<[number, number]> {
  const p = await page.evaluate((id) => {
    const r = document.querySelector(`#stage g[data-id="${id}"]`)!.getBoundingClientRect();
    const c: [number, number][] = [];
    for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) c.push([r.x + r.width * i / 12, r.y + r.height * j / 12]);
    c.sort((a, b) => Math.hypot(a[0] - r.x - r.width / 2, a[1] - r.y - r.height / 2) - Math.hypot(b[0] - r.x - r.width / 2, b[1] - r.y - r.height / 2));
    return c.find(([x, y]) => (document.elementFromPoint(x, y)?.closest('g[data-id]') as SVGGElement | null)?.dataset.id === id) || null;
  }, id);
  if (!p) throw new Error(`No tappable point on layer ${id}`);
  return p;
}

/** Tap a field to type an exact value (the field turns into a text input), then press Enter. */
export async function typeExact(page: Page, fld: Locator, value: string) {
  await fld.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  // Wait until the panel has stopped scrolling or re-rendering before reading the field's position.
  await expect.poll(async () => { const a = await fld.boundingBox(); await page.waitForTimeout(50); const b = await fld.boundingBox(); return !!a && !!b && a.y === b.y; }).toBe(true);
  const [x, y] = await center(fld);
  await ptr(page, 'pointerdown', x, y);
  await ptr(page, 'pointerup', x, y);
  const inp = fld.locator('input');
  await expect(inp).toBeFocused();
  await inp.fill(value);
  await inp.press('Enter');
}
/** An object field (data-o) in the inspector, by its key. */
export const ofield = (page: Page, key: string, o = 'lp') => page.locator(`#rpanel .fld[data-o="${o}"][data-k="${key}"]`).first();
/** Adds a layer from the Insert popover. */
export async function insertLayer(page: Page, type: string) {
  await page.locator('#lstrip [data-act="insert"]').click();
  await page.locator(`#layer-pop [data-act="add"][data-v="${type}"]`).click();
  await expect(page.locator('#layer-pop .pop')).toHaveCount(0);
}
/** The saved document of the selected layer. */
export async function selectedLayer(page: Page) {
  const name = await page.locator('#lname').inputValue();
  const pj = await savedProject(page);
  return pj.layers.find((l: any) => l.name === name);
}
/** Expands an inspector section if it is folded. */
export async function unfold(page: Page, v: string) {
  const h = page.locator(`#rpanel .sec-h[data-v="${v}"]`);
  if ((await h.getAttribute('aria-expanded')) === 'false') await h.click();
  await expect(h).toHaveAttribute('aria-expanded', 'true');
}
