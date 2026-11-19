import { test, expect, type Page } from '@playwright/test';
import { openApp, insertLayer, savedProject, ptr, hold, openRight, stored, isPortrait, settle } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });

// The drawing layer (in portrait the inspector sheet folds while drawing, so read the saved project).
const selectedLayer = async (page: Page) => (await savedProject(page)).layers.find((l: any) => l.type === 'draw');

/** A stroke on the stage with the Pencil (pointerType pen), pressure rising along the stroke. */
async function pencilStroke(page: Page, pts: [number, number][], type: 'pen' | 'touch' = 'pen') {
  const o = (i: number) => ({ type, id: 31, pressure: .2 + .7 * i / (pts.length - 1), altitudeAngle: .9 });
  await ptr(page, 'pointerdown', pts[0][0], pts[0][1], o(0));
  for (let i = 1; i < pts.length; i++) await ptr(page, 'pointermove', pts[i][0], pts[i][1], o(i));
  await ptr(page, 'pointerup', pts[pts.length - 1][0], pts[pts.length - 1][1], o(pts.length - 1));
}
/** Points around a square on the stage centre, as screen coordinates. */
async function square(page: Page, half = 40): Promise<[number, number][]> {
  const s = (await page.locator('#stage').boundingBox())!;
  const cx = s.x + s.width * .3, cy = s.y + s.height * .3, out: [number, number][] = [];
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  // Go round one and a half times so the start of the stroke (light pressure, thin) is closed by the end.
  for (let c = 0; c < 6; c++) for (let i = 0; i < 8; i++) {
    const [ax, ay] = corners[c % 4], [bx, by] = corners[(c % 4) + 1], t = i / 8;
    out.push([cx + half * (ax + (bx - ax) * t), cy + half * (ay + (by - ay) * t)]);
  }
  return out;
}
const centreOf = async (page: Page): Promise<[number, number]> => { const s = (await page.locator('#stage').boundingBox())!; return [s.x + s.width * .3, s.y + s.height * .3]; };

async function newDrawing(page: Page) {
  await insertLayer(page, 'draw');
  await expect(page.locator('#brushbtn')).toHaveAttribute('aria-pressed', 'true'); // adding a drawing picks the brush
  await settle(page);
}

// Checklist: "Drawing: brush with pressure (simulate pointerType 'pen'), eraser, fill, cels, onion skin, flip."
test('brush with Pencil pressure and tilt records a stroke', async ({ page }) => {
  await newDrawing(page);
  await expect(page.locator('#bbar')).toHaveClass(/show/);
  await pencilStroke(page, await square(page));
  const l = await selectedLayer(page);
  expect(l.type).toBe('draw');
  expect(l.cels).toHaveLength(1);
  const s = l.cels[0].strokes[0];
  expect(s.k).toBe('brush');
  const pressures = s.pts.map((p: number[]) => p[2]);
  expect(Math.min(...pressures)).toBeLessThan(.4);
  expect(Math.max(...pressures)).toBeGreaterThan(.8);
  expect(s.pts[0][3]).toBe(.9); // altitude from the Pencil tilt
  await expect(page.locator(`#stage g[data-id="${l.id}"] image`).first()).toBeAttached();
});

test('pressure off records a flat width; brush presets and settings are saved', async ({ page }) => {
  await newDrawing(page);
  await page.locator('#bbar [data-act="btog"][data-k="pr"]').click();
  await expect(page.locator('#bbar [data-act="btog"][data-k="pr"]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#bbar [data-act="bpre"][data-v="marker"]').click();
  await pencilStroke(page, await square(page));
  const s = (await selectedLayer(page)).cels[0].strokes[0];
  expect(new Set(s.pts.map((p: number[]) => p[2]))).toEqual(new Set([.6]));
  expect(s.pre).toBe('marker');
  const b = await stored(page, 'brush');
  expect([b.pr, b.pre]).toEqual([false, 'marker']);
});

test('eraser and fill', async ({ page }) => {
  await newDrawing(page);
  await pencilStroke(page, await square(page));
  // Fill inside the closed square.
  await page.keyboard.press('g');
  const [cx, cy] = await centreOf(page);
  await ptr(page, 'pointerdown', cx, cy, { type: 'pen', id: 31 }); await ptr(page, 'pointerup', cx, cy, { type: 'pen', id: 31 });
  await expect(page.locator('#toast')).not.toContainText('not closed');
  let st = (await selectedLayer(page)).cels[0].strokes;
  expect(st.map((s: any) => s.k)).toEqual(['brush', 'fill']);
  // Erase across it.
  await page.keyboard.press('x');
  await expect(page.locator('#brushbtn')).toHaveAttribute('data-v', 'erase');
  await pencilStroke(page, [[cx - 60, cy], [cx, cy], [cx + 60, cy]]);
  st = (await selectedLayer(page)).cels[0].strokes;
  expect(st.map((s: any) => s.k)).toEqual(['brush', 'fill', 'erase']);
});

test('cels: blank, duplicate and clear; onion skin; flip', async ({ page }) => {
  await newDrawing(page);
  await pencilStroke(page, await square(page));
  // Step forward and add a duplicate cel from the timeline controls.
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await page.locator('#tl [data-act="celdup"]').click();
  let l = await selectedLayer(page);
  expect(l.cels).toHaveLength(2);
  expect(l.cels[1].strokes).toHaveLength(1);
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await page.locator('#tl [data-act="celadd"]').click();
  l = await selectedLayer(page);
  expect(l.cels).toHaveLength(3);
  expect(l.cels[2].strokes).toHaveLength(0);
  await expect(page.locator('#scrub .ck')).toHaveCount(3);

  // Onion skin: tap toggles, hold opens its settings.
  const on = page.locator('#tl [data-act="onion"]');
  const was = await on.getAttribute('aria-pressed');
  await on.click();
  await expect(on).not.toHaveAttribute('aria-pressed', was!);
  expect((await stored(page, 'onion')).on).toBe(was !== 'true');
  await hold(page, page.locator('#tl [data-act="onion"]'));
  await expect(page.locator('#layer-pop [data-act="onset"]').first()).toBeVisible();
  await page.keyboard.press('Escape');

  // Flip: hold works with two or more cels (no "needs two cels" toast).
  await hold(page, page.locator('#tl [data-flip]'), 300);
  await expect(page.locator('#toast')).not.toContainText('Flip needs');

  // Clear the current cel from the inspector.
  await page.keyboard.press('ArrowLeft');
  // Known quirk (ported as is): seeking does not re-render the inspector, so close and reopen it to refresh the cel buttons.
  await openRight(page, 'Properties');
  await page.locator('#rstrip [aria-label="Properties"]').click();
  await openRight(page, 'Properties');
  const clear = page.locator('#rpanel [data-act="celclear"]');
  await clear.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await clear.click();
  l = await selectedLayer(page);
  expect(l.cels[1].strokes).toHaveLength(0);
});

test('a finger on the canvas pans once the Pencil has been used', async ({ page }) => {
  await newDrawing(page);
  await pencilStroke(page, await square(page));
  const b0 = (await page.locator('#stage').boundingBox())!;
  const [cx, cy] = await centreOf(page);
  await pencilStroke(page, [[cx, cy + 80], [cx + 50, cy + 80], [cx + 100, cy + 80]], 'touch');
  const b1 = (await page.locator('#stage').boundingBox())!;
  expect(b1.x - b0.x).toBeGreaterThan(60);
  expect((await selectedLayer(page)).cels[0].strokes).toHaveLength(1);
});

test('portrait: picking a draw tool folds the inspector sheet', async ({ page }) => {
  test.skip(!(await isPortrait(page)), 'portrait only');
  await expect(page.locator('#rstrip [aria-label="Properties"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#brushbtn').click();
  await expect(page.locator('#rstrip [aria-label="Properties"]')).toHaveAttribute('aria-pressed', 'false');
});
