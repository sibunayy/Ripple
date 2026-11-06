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
  /** Shape layer builder: kind rect|ellipse|polygon|star|path; fill/stroke as [r,g,b] (0-1). */
  shape(kind, o = {}) {
    const P = (v) => ({ value: v });
    const l = T.layer('null', { pos: o.pos ?? [64, 64], rot: o.rot, scale: o.scale, opacity: o.opacity, extra: o.extra });
    l.type = 'shape'; l.size = [0, 0]; if (o.name) l.name = o.name;
    l.props = { 'fill.color': P([...(o.fill ?? [1, 1, 1]), 1]), 'fill.opacity': P(100), 'stroke.color': P([...(o.stroke?.color ?? [1, 1, 1]), 1]), 'stroke.width': P(o.stroke?.w ?? 4), 'stroke.opacity': P(100),
      'trim.start': P(o.trim?.[0] ?? 0), 'trim.end': P(o.trim?.[1] ?? 100), 'trim.offset': P(0),
      'rep.copies': P(o.rep?.copies ?? 3), 'rep.position': P(o.rep?.pos ?? [30, 0]), 'rep.rotation': P(0), 'rep.scale': P([100, 100]), 'rep.opacityStart': P(100), 'rep.opacityEnd': P(100), ...(o.props ?? {}) };
    if (kind === 'rect') { l.props['shape.size'] = P(o.size ?? [60, 40]); l.props['shape.round'] = P(o.round ?? 0); }
    if (kind === 'ellipse') l.props['shape.size'] = P(o.size ?? [60, 60]);
    if (kind === 'polygon' || kind === 'star') { l.props['shape.points'] = P(o.points ?? 5); l.props['shape.outer'] = P(o.outer ?? 30); l.props['shape.inner'] = P(o.inner ?? 12); }
    const paint = { kind: 'solid', stops: [], from: [0, 0], to: [1, 0] };
    l.shape = { kind, path: o.path, fill: o.fill === null ? null : (o.gradient ?? paint), stroke: o.stroke ? { cap: 'butt', join: 'miter', dash: 0, gap: 0, paint } : null, trim: !!o.trim, repeater: !!o.rep };
    l.transform.anchor = P([0, 0]);
    return l;
  },
  project(layers, o = {}) {
    return { v: 3, id: 'x', name: 'scene', created: 0, modified: 0, settings: { width: 128, height: 128, fps: 30, duration: 60, bg: [0, 0, 0, 1], colorSpace: 'srgb', linearLight: false }, layers, markers: [], workArea: null, comps: o.comps ?? {}, assets: {} };
  },
  draw(layers, { w = 64, h = 64, bg = [0, 0, 0, 1], t = 0, comps = {}, linear = false } = {}, pts = []) {
    const r = window.__ripple.renderer;
    r.resize(w, h);
    r.render(layers, { width: w, height: h, bg, t, comps, fps: 30, linear });
    return pts.map(([x, y]) => r.readPixel(x, y));
  },
};
`;
