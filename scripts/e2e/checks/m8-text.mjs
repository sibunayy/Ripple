import { UI } from '../ui.mjs';
export const checks = [{
  name: 'text animator reveals characters as its offset sweeps; hidden text draws nothing',
  async run({ page }) {
    const frames = await page.evaluate(() => {
      const mk = () => {
        const l = T.layer('solid', { w: 200, h: 64 }); l.type = 'text';
        l.text = { text: 'WWWW', font: 'sans-serif', align: 'left', bold: true, italic: false, animators: [{ id: 'a1', name: 'x', unit: 'chars', shape: 'ramp' }] };
        l.shape = { kind: 'path', fill: { kind: 'solid', stops: [], from: [0, 0], to: [1, 0] }, stroke: null, trim: false, repeater: false };
        l.props = { 'fill.color': { value: [1, 1, 1, 1] }, 'text.size': { value: 36 }, 'ta:a1:start': { value: 0 }, 'ta:a1:end': { value: 25 }, 'ta:a1:opacity': { value: 0 },
          'ta:a1:offset': { keys: [{ t: 0, v: -125, ease: 'linear' }, { t: 30, v: 100, ease: 'linear' }] } };
        return l;
      };
      const pts = []; for (let y = 4; y < 44; y += 4) for (let x = 2; x < 120; x += 3) pts.push([x, y]);
      const count = (t) => T.draw([mk()], { w: 200, h: 64, t }, pts).filter((p) => p[0] > 40).length;
      return { start: count(0), mid: count(20), end: count(30) };
    });
    if (frames.start !== 0) throw new Error('all characters should be hidden at the start: ' + frames.start);
    if (!(frames.end > 60)) throw new Error('all characters should be visible at the end: ' + frames.end);
    if (!(frames.mid > 0 && frames.mid < frames.end)) throw new Error('mid-sweep should show some characters: ' + JSON.stringify(frames));
  },
}, {
  name: 'UI: animate-in template adds an animator with keyframes',
  async run({ page }) {
    const st = await page.locator(UI.stage).boundingBox();
    await page.keyboard.press('t'); await page.mouse.click(st.x + 200, st.y + 100);
    await page.waitForSelector('textarea.tbox');
    await page.keyboard.type('Hello world'); await page.keyboard.press('Escape');
    await page.click('button:has-text("Fade by character")');
    await page.waitForSelector('.mask.on >> text=Start %');
    const rows = await page.locator('.tl-row.sub').count();
    if (rows < 1) throw new Error('expected an animated offset row, got ' + rows);
    const label = await page.locator('.tl-row.sub .propname').first().textContent();
    if (!/offset/.test(label)) throw new Error('unexpected row label ' + label);
  },
}];
