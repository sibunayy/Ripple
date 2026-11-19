import { test, expect } from '@playwright/test';
import { openApp, hold, drag, ptr, center, fingerTap, fieldValue, layerG, savedProject, openLeft, settle, hitPoint, isPortrait } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });

// Checklist: "Tool strip: every tool selects. Holding Select, Shape or Brush opens its flyout."
test('every tool in the strip selects', async ({ page }) => {
  const tools = page.locator('#lstrip [data-act="tool"]');
  const n = await tools.count();
  expect(n).toBe(6);
  for (let i = 0; i < n; i++) {
    await tools.nth(i).click();
    await expect(tools.nth(i)).toHaveAttribute('aria-pressed', 'true');
  }
  // Keyboard shortcuts pick the same tools.
  await page.keyboard.press('h');
  await expect(page.locator('#lstrip [data-v="hand"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('v');
  await expect(page.locator('#selbtn')).toHaveAttribute('aria-pressed', 'true');
});

for (const [btn, act, pick] of [['#selbtn', 'picksel', 'lasso'], ['#shapebtn', 'pickshape', 'star'], ['#brushbtn', 'pickdraw', 'erase']] as const) {
  test(`holding ${btn} opens its flyout`, async ({ page }) => {
    await hold(page, page.locator(btn));
    const item = page.locator(`#layer-pop [data-act="${act}"][data-v="${pick}"]`);
    await expect(item).toBeVisible();
    await item.click();
    await expect(page.locator('#layer-pop .pop')).toHaveCount(0);
    await expect(page.locator(btn)).toHaveAttribute('data-v', pick);
    await expect(page.locator(btn)).toHaveAttribute('aria-pressed', 'true');
  });
}

// Checklist: "Canvas: tap selects, drag moves (snap guides appear at the centre), corner handle scales,
// knob rotates, pinch zooms, two-finger tap undoes."
test('tap on the canvas selects a layer', async ({ page }) => {
  // The rotate knob of the selected Logo sits on Core's centre, so find a spot that hits Core itself.
  // In portrait the inspector sheet covers Core, so fold it first (tap Properties).
  if (await isPortrait(page)) { await page.locator('#rstrip [aria-label="Properties"]').click(); await settle(page); }
  if (await isPortrait(page)) { // the selected Logo's rotate knob covers small Core here, so clear the selection first
    const v = (await page.locator('#vp').boundingBox())!;
    await ptr(page, 'pointerdown', v.x + 20, v.y + 200); await ptr(page, 'pointerup', v.x + 20, v.y + 200);
    await expect(page.locator('#selbox')).toBeHidden();
  }
  const [x, y] = await hitPoint(page, 'core');
  await ptr(page, 'pointerdown', x, y); await ptr(page, 'pointerup', x, y);
  if (await isPortrait(page)) await page.locator('#rstrip [aria-label="Properties"]').click();
  await expect(page.locator('#lname')).toHaveValue('Core');
  // Tapping empty canvas clears the selection.
  const vp = (await page.locator('#vp').boundingBox())!;
  await ptr(page, 'pointerdown', vp.x + 20, vp.y + vp.height - 20); await ptr(page, 'pointerup', vp.x + 20, vp.y + vp.height - 20);
  await expect(page.locator('#selbox')).toBeHidden();
});

test('drag moves the layer and shows the centre snap guide', async ({ page }) => {
  const [x, y] = await center(layerG(page, 'logo'));
  const x0 = await fieldValue(page, 'Position X'), y0 = await fieldValue(page, 'Position Y');
  await ptr(page, 'pointerdown', x, y);
  for (let i = 1; i <= 6; i++) await ptr(page, 'pointermove', x + 2, y + i * 6);
  await expect(page.locator('#gv')).toBeVisible(); // x stays on 960, so the vertical guide shows
  await ptr(page, 'pointerup', x + 2, y + 36);
  await expect(page.locator('#gv')).toBeHidden();
  expect(await fieldValue(page, 'Position X')).toBe(x0); // snapped to the centre
  expect(await fieldValue(page, 'Position Y')).toBeGreaterThan(y0 + 50);
  const pj = await savedProject(page);
  expect(pj.layers.find((l: any) => l.id === 'logo').p.y.v).toBe(await fieldValue(page, 'Position Y'));
});

test('corner handle scales and knob rotates', async ({ page }) => {
  const s0 = await fieldValue(page, 'Scale');
  const corner = page.locator('#selbox i[data-hd="s"]').nth(2);
  const [cx, cy] = await center(corner);
  const [ox, oy] = await center(layerG(page, 'logo'));
  await drag(page, [cx, cy], [cx + (cx - ox) * .5, cy + (cy - oy) * .5]);
  expect(await fieldValue(page, 'Scale')).toBeGreaterThan(s0 + 20);

  const knob = page.locator('#selbox b[data-hd="r"]');
  const [kx, ky] = await center(knob);
  await drag(page, [kx, ky], [kx + 120, ky + 60]);
  expect(Math.abs(await fieldValue(page, 'Rotation'))).toBeGreaterThan(10);
});

test('pinch zooms the canvas', async ({ page }) => {
  const pct = page.locator('#zoom [data-act="fit"]');
  const before = parseInt((await pct.textContent())!);
  const vp = (await page.locator('#vp').boundingBox())!;
  // A spot on empty canvas that no panel covers in either orientation.
  const cx = vp.x + vp.width * .35, cy = vp.y + 200;
  await ptr(page, 'pointerdown', cx - 40, cy, { id: 21 });
  await ptr(page, 'pointerdown', cx + 40, cy, { id: 22 });
  for (let i = 1; i <= 6; i++) {
    await ptr(page, 'pointermove', cx - 40 - i * 15, cy, { id: 21 });
    await ptr(page, 'pointermove', cx + 40 + i * 15, cy, { id: 22 });
  }
  await ptr(page, 'pointerup', cx - 130, cy, { id: 21 });
  await ptr(page, 'pointerup', cx + 130, cy, { id: 22 });
  await expect.poll(async () => parseInt((await pct.textContent())!)).toBeGreaterThan(before * 1.5);
});

test('two-finger tap undoes and three-finger tap redoes', async ({ page }) => {
  // A hidden layer's stage group gets opacity 0.
  await page.locator('#rpanel .phead [data-act="vis"]').click();
  await expect(layerG(page, 'logo')).toHaveAttribute('opacity', '0');
  await fingerTap(page, 2);
  await expect(layerG(page, 'logo')).toHaveAttribute('opacity', '1');
  await fingerTap(page, 3);
  await expect(layerG(page, 'logo')).toHaveAttribute('opacity', '0');
});

test('keyboard undo and redo, and the strip buttons', async ({ page }) => {
  const undo = page.locator('#lstrip [data-act="undo"]'), redo = page.locator('#lstrip [data-act="redo"]');
  await expect(undo).toBeDisabled();
  // Known quirk (ported as is): Lock only re-renders the panels, so the strip buttons may lag; the keys still work.
  await page.locator('#rpanel .phead [data-act="lock"]').click();
  await page.keyboard.press('Control+z');
  await expect(page.locator('#rpanel .phead [data-act="lock"]')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('#rpanel .phead [data-act="lock"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control+z');
  await expect(page.locator('#rpanel .phead [data-act="lock"]')).toHaveAttribute('aria-pressed', 'false');
  // Duplicate re-renders everything, so the strip's undo button is current.
  await page.locator('#qbar [data-act="dup"]').dispatchEvent('click');
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(page.locator('#stage g[data-id]')).toHaveCount(4);
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(page.locator('#stage g[data-id]')).toHaveCount(5);
});

test('shape tool: drag draws a rectangle sized by the drag', async ({ page }) => {
  await page.locator('#shapebtn').click(); // default shape is the rectangle
  const vp = (await page.locator('#vp').boundingBox())!;
  const a: [number, number] = [vp.x + vp.width * .2, vp.y + vp.height * .72];
  await drag(page, a, [a[0] + 120, a[1] + 60]);
  await expect(page.locator('#stage g[data-id]')).toHaveCount(5);
  await expect(page.locator('#lname')).toHaveValue('Rectangle 1');
  await expect(page.locator('#selbtn')).toHaveAttribute('aria-pressed', 'true'); // returns to Select
  const pj = await savedProject(page);
  const r = pj.layers.find((l: any) => l.name === 'Rectangle 1');
  expect(r.w).toBeGreaterThan(200);
});

test('text tool places a text layer; pen tool draws a path', async ({ page }) => {
  const vp = (await page.locator('#vp').boundingBox())!;
  await page.locator('#lstrip [data-v="text"]').click();
  await ptr(page, 'pointerdown', vp.x + 120, vp.y + vp.height - 80); await ptr(page, 'pointerup', vp.x + 120, vp.y + vp.height - 80);
  await expect(page.locator('#stage g[data-id]')).toHaveCount(5);
  await expect(page.locator('#rpanel .ity')).toHaveText('Text layer');
  await expect(page.locator('#lname')).toHaveValue('Your text'); // a text layer is named after its content

  await page.locator('#lstrip [data-v="pen"]').click();
  for (const [dx, dy] of [[100, 100], [220, 90], [180, 190]]) { await ptr(page, 'pointerdown', vp.x + dx, vp.y + dy); await ptr(page, 'pointerup', vp.x + dx, vp.y + dy); }
  await expect(page.locator('#ovl circle, #ovl path').first()).toBeAttached();
  await expect(page.locator('#qbar [data-act="pendone"]')).toBeAttached();
  await page.keyboard.press('Enter');
  await expect(page.locator('#lname')).toHaveValue('Path 1');
  await expect(page.locator('#stage g[data-id]')).toHaveCount(6);
});

test('hand tool pans and zoom buttons zoom', async ({ page }) => {
  const stage = page.locator('#stage');
  const b0 = (await stage.boundingBox())!;
  await page.locator('#lstrip [data-v="hand"]').click();
  const vp = (await page.locator('#vp').boundingBox())!;
  await drag(page, [vp.x + 60, vp.y + vp.height - 60], [vp.x + 160, vp.y + vp.height - 20]);
  const b1 = (await stage.boundingBox())!;
  expect(b1.x - b0.x).toBeGreaterThan(80);
  const pct = page.locator('#zoom [data-act="fit"]'), z0 = parseInt((await pct.textContent())!);
  await page.locator('#zoom [data-act="zoom"][data-v="1.25"]').click();
  await expect.poll(async () => parseInt((await pct.textContent())!)).toBeGreaterThan(z0);
});

test('safe-area and thirds overlays, snap toggle', async ({ page }) => {
  await page.locator('#zoom [aria-label="Safe areas"]').click();
  await expect(page.locator('#stage .gd')).toHaveCount(1);
  await expect(page.locator('#zoom [aria-label="Safe areas"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#zoom [aria-label="Thirds grid"]').click();
  await expect(page.locator('#zoom [aria-label="Thirds grid"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#zoom [aria-label="Thirds grid"]').click();
  await expect(page.locator('#stage .gd')).toHaveCount(0);
  await page.locator('#zoom [data-act="snap"]').click();
  await expect(page.locator('#zoom [data-act="snap"]')).toHaveAttribute('aria-pressed', 'false');
});

test('quick action bar: duplicate and delete', async ({ page }) => {
  await expect(page.locator('#qbar')).toHaveClass(/show/);
  // In portrait the inspector sheet overlaps the bar, so dispatch the tap on the button itself.
  await page.locator('#qbar [data-act="dup"]').dispatchEvent('click');
  await expect(page.locator('#stage g[data-id]')).toHaveCount(5);
  await page.locator('#qbar [data-act="del"]').dispatchEvent('click');
  await expect(page.locator('#stage g[data-id]')).toHaveCount(4);
  await expect(page.locator('#toast')).toBeVisible();
});

test('marquee selects several layers', async ({ page }) => {
  await page.keyboard.press('m');
  const st = (await page.locator('#stage').boundingBox())!;
  await drag(page, [st.x + 4, st.y + 4], [st.x + st.width - 4, st.y + st.height - 4]);
  await expect(page.locator('#rpanel .ity')).toContainText('layers');
});

test('layers panel: select by tap, hide, reorder with hold-and-drag', async ({ page }) => {
  await openLeft(page, 'Layers');
  await settle(page);
  const row = (id: string) => page.locator(`#lpanel .lrow[data-v="${id}"]`);
  await row('ring').click();
  // In portrait, picking a row closes the drawer; reopen it to check.
  await openLeft(page, 'Layers');
  await expect(row('ring')).toHaveClass(/\bsel\b/);
  const ids = () => page.locator('#lpanel .lrow[data-v]').evaluateAll((r) => r.map((e) => (e as HTMLElement).dataset.v));
  const order0 = await ids();
  const grip = page.locator('#lpanel .lrow[data-v="tag"] [data-grip]');
  const [gx, gy] = await center(grip);
  await drag(page, [gx, gy], [gx, gy + 120], { holdMs: 500, steps: 12 });
  await expect.poll(ids).not.toEqual(order0);
});
