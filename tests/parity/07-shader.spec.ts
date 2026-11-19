import { test, expect } from '@playwright/test';
import { openApp, insertLayer, savedProject, openRight, unfold } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });

const shaderLayer = async (page: any) => (await savedProject(page)).layers.find((l: any) => l.type === 'shader');

// Checklist: "Shader layer: preset runs (WebGL2 fallback when WebGPU is missing); the code dialog applies and reverts."
test('a shader preset runs and the placeholder hides', async ({ page }) => {
  await insertLayer(page, 'shader');
  const l = await shaderLayer(page);
  const g = page.locator(`#stage g[data-id="${l.id}"]`);
  await expect(g.locator('.shfo')).toBeAttached();
  // When the runtime starts (WebGPU, or the WebGL2 fallback), the gradient placeholder is hidden.
  await expect(g.locator('.shph').first()).toHaveCSS('display', 'none');
  await expect(g.locator('.shfo canvas, .shfo .shcv').first()).toBeAttached();
});

test('shader presets switch from the inspector', async ({ page }) => {
  await insertLayer(page, 'shader');
  await openRight(page, 'Properties');
  await unfold(page, 'app');
  const sel = page.locator('#rpanel select[data-sel="shp"]');
  const opts = await sel.locator('option').evaluateAll((o) => o.map((e) => (e as HTMLOptionElement).value).filter((v) => v !== '__custom'));
  expect(opts.length).toBeGreaterThan(3);
  await sel.selectOption(opts[2]);
  expect((await shaderLayer(page)).preset).toBe(opts[2]);
});

test('the code dialog applies custom GLSL and reverts to the preset', async ({ page }) => {
  await insertLayer(page, 'shader');
  await openRight(page, 'Properties');
  await unfold(page, 'app');
  await page.locator('#rpanel [data-act="shedit"]').click();
  const ta = page.locator('#dlg #shcode');
  await expect(ta).toBeVisible();
  await expect(page.locator('#dlg')).toContainText('GLSL');
  const code = '// Flat red\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(1.0, 0.0, 0.0, 1.0); }';
  await ta.fill(code);
  await page.locator('#dlg [data-act="shapply"]').click();
  await expect(page.locator('#toast')).toContainText(/Shader running \((WebGL|WebGPU)\)/);
  await expect(page.locator('#dlg')).toHaveCount(0);
  expect((await shaderLayer(page)).code).toBe(code);

  // Code without mainImage is refused.
  await page.locator('#rpanel [data-act="shedit"]').click();
  await page.locator('#dlg #shcode').fill('void main() {}');
  await page.locator('#dlg [data-act="shapply"]').click();
  await expect(page.locator('#toast')).toContainText('No mainImage function found');

  // Back to preset.
  await page.locator('#dlg [data-act="shrevert"]').click();
  await expect(page.locator('#dlg')).toHaveCount(0);
  expect((await shaderLayer(page)).code).toBeUndefined();
});
