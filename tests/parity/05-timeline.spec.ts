import { test, expect, type Page } from '@playwright/test';
import { openApp, expandTimeline, savedProject, drag, center, ptr, stored } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });

const lay = async (page: Page, id: string) => (await savedProject(page)).layers.find((l: any) => l.id === id);
// Demo keyframes (before anything is saved, localStorage has no project yet).
const DEMO: Record<string, Record<string, number[]>> = { logo: { scale: [70, 100], op: [0, 100] }, tag: { y: [760, 718], op: [0, 100] }, core: { scale: [0, 100] }, ring: { scale: [40, 100], rot: [-120, 0], op: [0, 100] } };
const frame = async (page: Page) => Number(await page.locator('#scrub').getAttribute('aria-valuenow'));

// Checklist: "Timeline: expand by drag or tap; dope sheet; graph editor drag; keyframe drag-retime; marquee select;
// layer slide (hold the bar); trim handles; work area; markers; loop."
test('expand by tap, collapse by tap, and the state is saved', async ({ page }) => {
  await page.locator('#tlh').click();
  await expect(page.locator('#tl .tl-tools')).toBeVisible();
  await expect(page.locator('#tlh')).toHaveAttribute('aria-label', 'Collapse timeline');
  await expect.poll(() => stored(page, 'tl')).toBe('mid');
  await page.locator('#tlh').click();
  await expect(page.locator('#tl .tl-tools')).toHaveCount(0);
  await expect.poll(() => stored(page, 'tl')).toBe('peek');
});

test('expand by dragging the handle up', async ({ page }) => {
  const [x, y] = await center(page.locator('#tlh'));
  const H = page.viewportSize()!.height;
  await drag(page, [x, y], [x, y - H * .62], { steps: 12 });
  await expect(page.locator('#tl .tl-tools')).toBeVisible();
  expect(await stored(page, 'tl')).toBe('tall');
});

test('scrub and step the playhead; play and pause', async ({ page }) => {
  const sc = page.locator('#scrub'), b = (await sc.boundingBox())!;
  await drag(page, [b.x + b.width * .5, b.y + b.height / 2], [b.x + b.width * .8, b.y + b.height / 2]);
  expect(Math.abs((await frame(page)) - 120)).toBeLessThanOrEqual(2);
  const f0 = await frame(page);
  await page.locator('#tl [data-act="step"][data-v="1"]').click();
  expect(await frame(page)).toBe(f0 + 1);
  await page.locator('#tl [data-act="play"]').click();
  await expect.poll(() => frame(page)).not.toBe(f0 + 1);
  await page.locator('#tl [data-act="play"]').click();
  await expect(page.locator('#tl [data-act="play"]')).toHaveAttribute('aria-label', 'Play');
});

test('dope sheet: tap a keyframe selects it; drag retimes it', async ({ page }) => {
  await expandTimeline(page);
  const dk = page.locator('#tlrows .dk[data-dk="one"][data-l="logo"][data-p="scale"][data-i="1"]');
  await expect(dk).toBeVisible();
  const [x, y] = await center(dk);
  const w = (await page.locator('#tlrows .ttrack[data-l="logo"]').boundingBox())!.width;
  await drag(page, [x, y], [x + w * 20 / 150, y], { steps: 10 });
  const keys = (await lay(page, 'logo')).p.scale.keys;
  expect(keys[1].t).toBeGreaterThanOrEqual(72);
  expect(keys[1].t).toBeLessThanOrEqual(76);
});

test('dope sheet: marquee selects keyframes', async ({ page }) => {
  await expandTimeline(page);
  const tag = (await page.locator('#tlrows .ttrack[data-l="tag"]').boundingBox())!;
  const logo = (await page.locator('#tlrows .ttrack[data-l="logo"]').boundingBox())!;
  // Start on empty track space past the last keyframe and sweep left and down over the first two rows.
  await drag(page, [tag.x + tag.width * .95, tag.y + 3], [tag.x + 2, logo.y + logo.height - 3], { steps: 10 });
  await expect(page.locator('#toast')).toContainText('keyframes selected');
  await expect(page.locator('#tlrows .dk.on, #tlrows .dk.sel').first()).toBeVisible();
});

test('layer slide: hold the bar, then drag', async ({ page }) => {
  await expandTimeline(page);
  const trk = page.locator('#tlrows .ttrack[data-l="core"]'), tb = (await trk.boundingBox())!;
  // A layer that fills the whole timeline has no room to slide, so trim its out point first.
  const [ox, oy] = await center(trk.locator('[data-trim="out"]'));
  await drag(page, [ox, oy], [tb.x + tb.width * .8, oy]);
  const x = tb.x + tb.width * .5, y = tb.y + tb.height / 2;
  await drag(page, [x, y], [x + tb.width * .1, y], { holdMs: 550, steps: 10 });
  const core = await lay(page, 'core');
  expect(core.inP).toBeGreaterThanOrEqual(13);
  expect(core.inP).toBeLessThanOrEqual(17);
  expect(core.p.scale.keys[0].t).toBe(8 + core.inP);
});

test('trim handles set in and out points', async ({ page }) => {
  await expandTimeline(page);
  const trk = page.locator('#tlrows .ttrack[data-l="logo"]'); // Ring has a keyframe on frame 0, over the in handle
  const tb = (await trk.boundingBox())!;
  const tin = trk.locator('[data-trim="in"]'), tout = trk.locator('[data-trim="out"]');
  const [ix, iy] = await center(tin);
  await drag(page, [ix, iy], [tb.x + tb.width * .2, iy]);
  const [ox, oy] = await center(tout);
  await drag(page, [ox, oy], [tb.x + tb.width * .8, oy]);
  const l = await lay(page, 'logo');
  expect(Math.abs(l.inP - 30)).toBeLessThanOrEqual(2);
  expect(Math.abs(l.outP - 120)).toBeLessThanOrEqual(2);
});

test('work area handles, full range and loop toggle', async ({ page }) => {
  await expandTimeline(page);
  const sc = (await page.locator('#scrub').boundingBox())!;
  const [x, y] = await center(page.locator('#scrub [data-wa="1"]'));
  await drag(page, [x, y], [sc.x + sc.width * .6, y]);
  await expect(page.locator('#scrub [data-wa="1"]')).toHaveAttribute('aria-label', /Loop end 00:03:00/);
  await expect(page.locator('#tl [data-act="wareset"]')).toBeVisible();
  await page.locator('#tl [data-act="wareset"]').click();
  await expect(page.locator('#scrub [data-wa="1"]')).toHaveAttribute('aria-label', /Loop end 00:05:00/);
  await page.locator('#tl [data-act="loopt"]').click();
  await expect(page.locator('#tl [data-act="loopt"]')).toHaveAttribute('aria-pressed', 'false');
});

test('markers: add at the playhead', async ({ page }) => {
  await expandTimeline(page);
  await expect(page.locator('#scrub .mk')).toHaveCount(2);
  await page.locator('#tl [data-act="marker"]').click();
  await expect(page.locator('#scrub .mk')).toHaveCount(3);
  const pj = await savedProject(page);
  expect(pj.markers.map((m: any) => m.f)).toEqual([30, 42, 86]);
});

test('graph editor: drag a keyframe', async ({ page }) => {
  await expandTimeline(page);
  await page.locator('#tl [data-act="tlmode"][data-v="graph"]').click();
  await expect(page.locator('#gsvg')).toBeVisible();
  const gk = page.locator('#gsvg [data-gk]').last();
  await expect(gk).toBeAttached();
  const p = (await gk.getAttribute('data-p'))!, i = Number(await gk.getAttribute('data-i'));
  const v0 = DEMO.logo[p][i];
  const [x, y] = await center(gk);
  await drag(page, [x, y], [x, y + 40], { steps: 10 }); // down: the last key may already sit at its maximum
  const v1 = (await lay(page, 'logo')).p[p].keys[i].v;
  expect(v1).not.toBe(v0);
});

test('timeline twirl shows property sub-rows; auto-key toggles', async ({ page }) => {
  await expandTimeline(page);
  await page.locator('#tlrows [data-act="twirl"][data-v="ring"]').click();
  await expect(page.locator('#tlrows [data-dk="one"][data-l="ring"]').first()).toBeVisible();
  await page.locator('#tl [data-act="autokey"]').click();
  await expect(page.locator('#tl [data-act="autokey"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('k');
  await expect(page.locator('#tl [data-act="autokey"]')).toHaveAttribute('aria-pressed', 'false');
});

test('hold the step button jumps to the next keyframe', async ({ page }) => {
  const b = page.locator('#tl [data-act="step"][data-v="1"]');
  const [x, y] = await center(b);
  await ptr(page, 'pointerdown', x, y);
  await page.waitForTimeout(600);
  await ptr(page, 'pointerup', x, y);
  expect(await frame(page)).toBe(44);
});
