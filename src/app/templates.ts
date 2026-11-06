// Starter templates (spec §12 M9): built in code from the same model functions the editor uses.
import { createProject, newId, type Project } from '../model/project';
import { createLayer, createShapeLayer, createTextLayer, type Layer, type Prop, type Vec2 } from '../model/layer';
import { TEMPLATES as TEXT_TPL, animatorProps } from '../text/animate';
import { createEffect, paramKey } from '../render/effects';
import { GALLERY, parseUniforms, syncUniformProps } from '../render/shader';
import { ellipsePath } from '../shape/path';

export interface StarterTemplate { id: string; name: string; description: string; build: () => Project }

const EO: [number, number, number, number] = [0.16, 1, 0.3, 1], EIO: [number, number, number, number] = [0.65, 0, 0.35, 1], BACK: [number, number, number, number] = [0.34, 1.56, 0.64, 1];
const keys = <T,>(...k: [number, T, Keyframe['ease']?][]) => ({ keys: k.map(([t, v, ease]) => ({ t, v, ease: ease ?? 'linear' })) }) as Prop<T>;
type Keyframe = { ease: 'linear' | 'hold' | [number, number, number, number] };

function base(name: string, bg: [number, number, number, number], frames = 150): Project {
  const p = createProject(name);
  p.settings = { ...p.settings, bg, duration: frames };
  return p;
}
const label = (l: Layer, name: string) => ((l.name = name), l);

function text(p: Project, content: string, size: number, pos: Vec2, o: { font?: string; bold?: boolean; color?: [number, number, number, number]; centre?: boolean } = {}): Layer {
  const l = createTextLayer(p.settings, 0, pos);
  l.name = content.slice(0, 24);
  l.text = { ...l.text!, text: content, font: o.font ?? 'Inter, system-ui, sans-serif', bold: o.bold ?? false, align: 'left' };
  l.props = { ...l.props, 'text.size': { value: size }, 'fill.color': { value: o.color ?? [1, 1, 1, 1] } };
  if (o.centre) l.transform.anchor = { value: [(content.length * size * 0.56) / 2, 0] }; // text boxes are left-anchored; centre on the estimate
  return l;
}
function animate(l: Layer, templateId: string, start: number, fps = 30): Layer {
  const tpl = TEXT_TPL.find((t) => t.id === templateId)!, id = newId();
  const n = Array.from(l.text!.text.replace(/\n/g, '')).length, frames = Math.round(Math.max(tpl.minSeconds, n * tpl.secondsPer) * fps);
  l.props = { ...l.props, ...animatorProps(id, tpl.start, tpl.end, tpl.props) };
  l.props[`ta:${id}:offset`] = keys<number>([start, -100 - tpl.end + tpl.start], [start + frames, 100]);
  l.text = { ...l.text!, animators: [{ id, name: tpl.label, unit: tpl.unit, shape: tpl.shape }] };
  return l;
}
function addFx(p: Project, l: Layer, type: string, over: Record<string, unknown> = {}): Layer {
  const c = createEffect(type, p.settings, newId())!;
  l.effects = [...(l.effects ?? []), c.effect];
  l.props = { ...l.props, ...c.props };
  for (const [k, v] of Object.entries(over)) l.props[paramKey(c.effect.id, k)] = (v && typeof v === 'object' && !Array.isArray(v) && ('value' in v || 'keys' in v) ? v : { value: v }) as Prop<any>;
  return l;
}

const logoReveal = (): Project => {
  const p = base('Logo reveal', [0.055, 0.07, 0.125, 1], 150);
  const ring = createShapeLayer('ellipse', p.settings, 0, [960, 430]);
  label(ring, 'Ring'); ring.shape = { ...ring.shape!, fill: null, trim: true, stroke: { cap: 'round', join: 'round', dash: 0, gap: 0, paint: ring.shape!.fill ?? { kind: 'solid', stops: [], from: [0, 0], to: [1, 0] } } };
  ring.props = { ...ring.props, 'shape.size': { value: [330, 330] }, 'stroke.color': { value: [0.49, 0.61, 1, 1] }, 'stroke.width': { value: 16 }, 'trim.end': keys<number>([0, 0, EIO], [48, 100]) };
  ring.transform.rotation = keys<number>([0, -90, EO], [60, 0]);
  addFx(p, ring, 'glow', { threshold: 20, radius: 30, intensity: 120 });
  const dot = createShapeLayer('ellipse', p.settings, 1, [960, 430]);
  label(dot, 'Core'); dot.props = { ...dot.props, 'shape.size': { value: [120, 120] }, 'fill.color': { value: [0.49, 0.61, 1, 1] } };
  dot.transform.scale = keys<Vec2>([30, [0, 0], BACK], [55, [100, 100]]);
  const title = animate(text(p, 'YOUR LOGO', 120, [960, 650], { font: '"Space Grotesk", system-ui, sans-serif', bold: true, centre: true }), 'rise', 50);
  const tag = animate(text(p, 'motion made simple', 40, [960, 800], { color: [0.7, 0.75, 0.9, 1], centre: true }), 'chars', 80);
  p.layers = [tag, title, dot, ring];
  return p;
};

const lowerThird = (): Project => {
  const p = base('Lower third', [0.1, 0.12, 0.18, 1], 150);
  const bar = createShapeLayer('rect', p.settings, 0, [380, 880]);
  label(bar, 'Bar'); bar.props = { ...bar.props, 'shape.size': { value: [660, 120] }, 'shape.round': { value: 10 }, 'fill.color': { value: [0.49, 0.61, 1, 1] } };
  bar.transform.position = keys<Vec2>([0, [-420, 880], EO], [22, [380, 880]], [110, [380, 880], EIO], [130, [-420, 880]]);
  const accent = createShapeLayer('rect', p.settings, 1, [60, 880]);
  label(accent, 'Accent'); accent.props = { ...accent.props, 'shape.size': { value: [16, 120] }, 'fill.color': { value: [1, 0.78, 0.3, 1] } };
  accent.transform.scale = keys<Vec2>([14, [100, 0], EO], [34, [100, 100]], [110, [100, 100], EIO], [124, [100, 0]]);
  const name = text(p, 'Alex Morgan', 54, [110, 836], { bold: true, color: [0.04, 0.06, 0.12, 1] });
  name.transform.opacity = keys<number>([20, 0, EO], [38, 100], [110, 100, EIO], [124, 0]);
  const role = text(p, 'Creative Director', 30, [112, 898], { color: [0.1, 0.13, 0.25, 1] });
  role.transform.opacity = keys<number>([28, 0, EO], [46, 100], [110, 100, EIO], [124, 0]);
  p.layers = [role, name, accent, bar];
  return p;
};

const kinetic = (): Project => {
  const p = base('Kinetic type', [0.04, 0.04, 0.09, 1], 150);
  const code = GALLERY.find((g) => g.name === 'Plasma')!.code;
  const bg = { ...createLayer('shader', p.settings, 0, 'Plasma'), shader: { code } };
  bg.props = syncUniformProps(undefined, 'sh:', parseUniforms(code)); bg.props['sh:scale'] = { value: 3 }; bg.props['sh:speed'] = { value: 0.5 };
  bg.transform.opacity = { value: 40 };
  const words: [string, number, string, number][] = [['MOVE', 250, 'rise', 5], ['WITH', 540, 'words', 28], ['RIPPLE', 830, 'rise', 52]];
  const ls = words.map(([w, y, tpl, t0]) => animate(text(p, w, 220, [960, y], { font: '"Space Grotesk", system-ui, sans-serif', bold: true, centre: true }), tpl, t0));
  p.layers = [...ls.reverse(), bg];
  return p;
};

const loader = (): Project => {
  const p = base('Loader', [0.97, 0.97, 0.99, 1], 60);
  const c = ellipsePath(34, 34);
  const dots = createShapeLayer('path', p.settings, 0, [960, 540], { closed: true, nodes: c.nodes.map((n) => ({ ...n, p: [n.p[0], n.p[1] - 150] as Vec2 })) });
  label(dots, 'Dots'); dots.shape = { ...dots.shape!, repeater: true };
  dots.props = { ...dots.props, 'fill.color': { value: [0.23, 0.36, 0.85, 1] }, 'rep.copies': { value: 12 }, 'rep.position': { value: [0, 0] }, 'rep.rotation': { value: 30 }, 'rep.opacityStart': { value: 100 }, 'rep.opacityEnd': { value: 12 } };
  dots.transform.rotation = keys<number>([0, 0, 'linear'], [60, 360]);
  p.layers = [dots];
  return p;
};

export const STARTERS: StarterTemplate[] = [
  { id: 'logo', name: 'Logo reveal', description: 'Draw-on ring, pop and rising title with glow', build: logoReveal },
  { id: 'lower-third', name: 'Lower third', description: 'Name bar that slides in and out', build: lowerThird },
  { id: 'kinetic', name: 'Kinetic type', description: 'Staggered words over a plasma shader', build: kinetic },
  { id: 'loader', name: 'Loader', description: 'Looping ring of fading dots (2 s)', build: loader },
];
