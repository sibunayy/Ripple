// Round-trip suite: RippleFlow render vs lottie-web render of the exported JSON, per feature (±24/255 per channel).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const LOTTIE_JS = readFileSync(require.resolve('lottie-web/build/player/lottie.min.js'), 'utf8');

const TOL = 24;
const P = (v) => ({ value: v });
const nodes = (pts) => pts.map(([x, y]) => ({ p: [x, y], i: [0, 0], o: [0, 0] }));

/** name, builder source (runs in the page with T), sample points [x,y], time */
const scenes = [
  { name: 'rect fill', t: 0, pts: [[64, 64], [10, 10], [40, 64], [95, 64]], build: `[T.shape('rect', { fill: [1, 0, 0], size: [60, 40] })]` },
  { name: 'ellipse stroke only (ring)', t: 0, pts: [[64, 64], [94, 64], [34, 64], [64, 94], [120, 120]], build: `[T.shape('ellipse', { fill: null, size: [60, 60], stroke: { w: 8, color: [1, 1, 1] } })]` },
  { name: 'star fill', t: 0, pts: [[64, 64], [64, 40], [10, 120], [64, 36]], build: `[T.shape('star', { fill: [0.2, 0.4, 1], outer: 30, inner: 12 })]` },
  { name: 'polygon fill', t: 0, pts: [[64, 64], [64, 40], [8, 8]], build: `[T.shape('polygon', { fill: [0, 1, 0.4], points: 6, outer: 30 })]` },
  { name: 'position keyframes (bézier ease) + scale', t: 10, pts: [[30, 64], [60, 64], [100, 64], [20, 64]], build: `(() => { const l = T.shape('rect', { fill: [1, 0.5, 0], size: [30, 30], pos: [20, 64] });
      l.transform.position = { keys: [{ t: 0, v: [20, 64], ease: [0.42, 0, 0.58, 1] }, { t: 20, v: [100, 64], ease: 'linear' }] }; return [l]; })()` },
  { name: 'opacity keyframes', t: 15, pts: [[64, 64], [10, 10]], build: `(() => { const l = T.shape('rect', { fill: [1, 0, 0], size: [60, 60] }); l.transform.opacity = { keys: [{ t: 0, v: 0, ease: 'linear' }, { t: 30, v: 100, ease: 'linear' }] }; return [l]; })()` },
  { name: 'parenting with rotation', t: 0, pts: [[64, 94], [94, 64], [64, 64], [34, 64]], build: `(() => { const par = T.layer('null', { id: 'p', pos: [64, 64], rot: 90 }); const c = T.shape('rect', { fill: [0, 1, 1], size: [20, 20], pos: [30, 0] }); c.parent = 'p'; return [c, par]; })()` },
  { name: 'trim paths on an open path', t: 0, pts: [[40, 64], [60, 64], [90, 64], [104, 64]],
    build: `[T.shape('path', { fill: null, stroke: { w: 10, color: [1, 1, 1] }, trim: [0, 50], pos: [64, 64], path: { closed: false, nodes: ${JSON.stringify(nodes([[-40, 0], [40, 0]]))} } })]` },
  { name: 'repeater copies', t: 0, pts: [[34, 64], [64, 64], [94, 64], [10, 64], [124, 64]], build: `[T.shape('rect', { fill: [1, 1, 0], size: [16, 16], pos: [34, 64], rep: { copies: 3, pos: [30, 0] } })]` },
  { name: 'precomp with scale', t: 0, pts: [[64, 64], [20, 20], [100, 100]],
    build: `(() => { const pc = T.layer('precomp', { w: 64, h: 64, pos: [64, 64], anchor: [32, 32], scale: [100, 100], extra: { precomp: { comp: 'c1', offset: 0 } } }); return [pc]; })()`,
    comps: `({ c1: { id: 'c1', name: 'C1', width: 64, height: 64, fps: 30, duration: 60, layers: [T.shape('rect', { fill: [1, 0, 0.5], size: [40, 40], pos: [32, 32] })] } })` },
  { name: 'mask (add) on a solid', t: 0, pts: [[64, 64], [10, 10], [100, 64]],
    build: `(() => { const s = T.layer('solid', { w: 128, h: 128, color: [1, 1, 1, 1] }); s.masks = [{ id: 'k', name: 'M', mode: 'add', invert: false, path: { closed: true, nodes: ${JSON.stringify(nodes([[32, 32], [96, 32], [96, 96], [32, 96]]))} } }]; return [s]; })()` },
  { name: 'alpha track matte', t: 0, pts: [[64, 64], [10, 10], [100, 100]],
    build: `(() => { const m = T.shape('ellipse', { id: 'mt', fill: [1, 1, 1], size: [50, 50] }); m.id = 'mt'; const c = T.layer('solid', { w: 128, h: 128, color: [0, 1, 0, 1] }); c.matte = { layer: 'mt', mode: 'alpha' }; return [c, m]; })()` },
  { name: 'multiply blend', t: 0, pts: [[64, 64], [10, 10]],
    build: `(() => { const top = T.shape('rect', { fill: [0.5, 0.5, 0.5], size: [60, 60] }); top.blend = 'multiply'; const below = T.layer('solid', { w: 128, h: 128, color: [1, 0.2, 0.2, 1] }); return [top, below]; })()` },
  { name: 'linear gradient fill', t: 0, pts: [[34, 64], [64, 64], [94, 64]],
    build: `[T.shape('rect', { size: [80, 40], gradient: { kind: 'linear', stops: [{ at: 0, c: [1, 0, 0, 1] }, { at: 1, c: [0, 0, 1, 1] }], from: [-40, 0], to: [40, 0] } })]` },
];

const checks = scenes.map((sc) => ({
  name: `lottie round trip · ${sc.name}`,
  async run({ page, ctx }) {
    const built = await page.evaluate(async ([build, comps]) => {
      const layers = eval(build); const cs = comps ? eval(comps) : {};
      const p = T.project(layers, { comps: cs });
      window.__ripple.load(p);
      return { project: p, lottie: await window.__ripple.lottie() };
    }, [sc.build, sc.comps ?? null]);
    const ours = await page.evaluate(([p, t, pts]) => { window.__ripple.load(p); return T.draw(p.layers, { w: 128, h: 128, t, comps: p.comps }, pts); }, [built.project, sc.t, sc.pts]);

    const lp = await ctx.newPage();
    await lp.setContent('<div id="d" style="position:absolute;left:0;top:0;width:128px;height:128px"></div>');
    await lp.addScriptTag({ content: LOTTIE_JS });
    const theirs = await lp.evaluate(async ([json, t, pts]) => {
      const anim = lottie.loadAnimation({ container: document.getElementById('d'), renderer: 'canvas', loop: false, autoplay: false, animationData: json, rendererSettings: { clearCanvas: true } });
      await new Promise((r) => setTimeout(r, 150));
      anim.goToAndStop(t, true);
      await new Promise((r) => setTimeout(r, 80));
      const c = document.querySelector('#d canvas');
      // lottie output is transparent: composite over our black background
      const off = document.createElement('canvas'); off.width = 128; off.height = 128; const og = off.getContext('2d'); og.fillStyle = '#000'; og.fillRect(0, 0, 128, 128); og.drawImage(c, 0, 0, 128, 128);
      return pts.map(([x, y]) => Array.from(og.getImageData(x, y, 1, 1).data));
    }, [built.lottie, sc.t, sc.pts]);
    await lp.close();

    const bad = [];
    sc.pts.forEach(([x, y], i) => { for (let ch = 0; ch < 3; ch++) if (Math.abs(ours[i][ch] - theirs[i][ch]) > TOL) bad.push(`(${x},${y}) ch${ch}: RippleFlow ${ours[i].slice(0, 3)} vs lottie-web ${theirs[i].slice(0, 3)}`); });
    if (bad.length) throw new Error([...new Set(bad)].join('\n'));
  },
}));

export { checks };
