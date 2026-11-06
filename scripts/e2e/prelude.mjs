// Injected into every page: scene builders + a synchronous render/readback helper (the GL buffer is only readable
// in the task that rendered it, so draw() renders and samples in one call).
export const PRELUDE = `
window.T = {
  prop: (v) => ({ value: v }),
  layer(type, o = {}) {
    const w = o.w ?? 64, h = o.h ?? 64, P = (v) => ({ value: v });
    return {
      id: o.id ?? Math.random().toString(36).slice(2, 10), name: o.name ?? type, type, in: 0, out: 1000, visible: true,
      size: [w, h], color: o.color ?? [1, 1, 1, 1],
      transform: { anchor: P(o.anchor ?? [0, 0]), position: P(o.pos ?? [0, 0]), scale: P(o.scale ?? [100, 100]), rotation: P(o.rot ?? 0), opacity: P(o.opacity ?? 100) },
      ...(o.extra ?? {}),
    };
  },
  /** layer extras for effects: fx([['invert'], ['gaussianBlur', { radius: 8 }]]) */
  fx(list, data) {
    const effects = [], props = {};
    list.forEach(([type, vals = {}], i) => { const id = 'e' + i; effects.push({ id, type, enabled: true, data: data?.[i] }); for (const [k, v] of Object.entries(vals)) props['fx:' + id + ':' + k] = { value: v }; });
    return { effects, props };
  },
  draw(layers, { w = 64, h = 64, bg = [0, 0, 0, 1], t = 0, comps = {}, linear = false } = {}, pts = []) {
    const r = window.__ripple.renderer;
    r.resize(w, h);
    r.render(layers, { width: w, height: h, bg, t, comps, fps: 30, linear });
    return pts.map(([x, y]) => r.readPixel(x, y));
  },
};
`;
