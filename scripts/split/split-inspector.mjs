// Phase 2, step 3: splits propsView (src/ui/inspector/props-view.ts) into one file per inspector
// section, following HANDOFF section 8. The template code is moved verbatim; the shared helpers
// (chip, capJoin, dashF, trimRow, htog) take the layer as their first argument instead of closing over it.
import ts from 'typescript';
import fs from 'node:fs';

const dir = 'src/ui/inspector/';
const src = fs.readFileSync(dir + 'props-view.ts', 'utf8');
const L = src.split('\n');
const ln = (a, b) => L.slice(a - 1, b).join('\n'); // 1-based, inclusive
const expect = (n, start) => { if (!L[n - 1].trimStart().startsWith(start)) throw new Error(`line ${n} moved: ${L[n - 1].slice(0, 60)}`); };
expect(21, 'const htog'); expect(22, 'const head'); expect(26, "if (l.type === 'audio')"); expect(34, '// Transform'); expect(38, 'const layerSec');
expect(39, 'const chip'); expect(43, 'const trimRow'); expect(44, 'let look'); expect(45, "if (l.type === 'text')"); expect(62, '} else if ([');
expect(74, "} else if (l.type === 'path')"); expect(81, "} else if (l.type === 'shader')");

const sf = ts.createSourceFile('p.ts', src, ts.ScriptTarget.ES2022, true);
const importOf = new Map();
for (const d of sf.statements.filter(ts.isImportDeclaration)) for (const e of d.importClause.namedBindings.elements) importOf.set(e.name.text, d.moduleSpecifier.text);
const local = { chip: './paint', grpHead: './paint', capJoin: './paint', dashF: './paint', trimRow: './paint' };
function idsIn(code) {
  const out = new Set();
  const f = ts.createSourceFile('x.ts', code, ts.ScriptTarget.ES2022, true);
  const visit = (n) => { if (ts.isIdentifier(n)) out.add(n.text); ts.forEachChild(n, visit); };
  visit(f);
  return out;
}
function importsFor(code, self) {
  const by = new Map();
  for (const id of idsIn(code)) {
    const spec = local[id] && local[id] !== self ? local[id] : importOf.get(id);
    if (!spec || spec === self) continue;
    if (!by.has(spec)) by.set(spec, new Set());
    by.get(spec).add(id);
  }
  return [...by].map(([s, n]) => `import { ${[...n].sort().join(', ')} } from '${s}';`).join('\n');
}
const withL = (code) => code.replace(/\bchip\(/g, 'chip(l, ').replace(/\bcapJoin\(\)/g, 'capJoin(l)').replace(/\bdashF\(\)/g, 'dashF(l)').replace(/\btrimRow\(\)/g, 'trimRow(l)');
const dedent = (code, n = 2) => code.split('\n').map((x) => x.replace(new RegExp('^ {0,' + n + '}'), '')).join('\n');
function write(name, doc, code) {
  const self = './' + name;
  fs.writeFileSync(dir + name + '.ts', `// @ts-nocheck\n${importsFor(code, self)}\n\n/** ${doc} */\n${code}\n`);
}

write('header', 'Inspector header: colour dot, layer type over the editable name, Hide / Lock / Solo toggles.',
  `export function inspectorHeader(l, multi) {\n${ln(21, 25)}\n  return head;\n}`);
const audio = ln(27, 32).replace('return { head, body: sec(', 'return sec(').replace(/\) \};$/, ');');
write('content-audio', 'Audio layers: the whole inspector body (volume, mute, length).', `export function audioBody(l) {\n${audio}\n}`);
write('transform', 'Transform section: position, scale, rotation, anchor; align to composition; flip and reset.',
  `export function transformSection(l, multi) {\n${ln(34, 37)}\n  return tf;\n}`);
write('layer', 'Layer section: opacity (can be keyframed) and blend mode.', `export function layerSection(l) {\n${ln(38, 38)}\n  return layerSec;\n}`);
const content = (fn, doc, a, b) => write('content-' + fn, doc,
  `export function ${fn}Content(l) {\n  let look, title, paint, paintTitle;\n${withL(dedent(ln(a, b), 2))}\n  return { title, look, paint, paintTitle };\n}`);
content('text', 'Text layers: content, font, size & spacing, paragraph; Fill & outline.', 46, 61);
content('shape', 'Shape layers (rect, ellipse, polygon, star, line, ring): geometry; Fill & stroke or Stroke.', 63, 73);
content('path', 'Path layers: smooth, closed, fill; Stroke.', 75, 80);

// Shared paint helpers move into paint.ts.
const helpers = ln(39, 43).split('\n').map((x) => x.trimStart()
  .replace(/^const chip = \(lbl, key\)/, 'export const chip = (l, lbl, key)')
  .replace(/^const grpHead = /, 'export const grpHead = ')
  .replace(/^const (capJoin|dashF|trimRow) = \(\)/, 'export const $1 = (l)')).join('\n');
let paint = fs.readFileSync(dir + 'paint.ts', 'utf8');
paint = paint.trimEnd() + '\n\n// Shared by the content sections. Each colour chip pairs with its own opacity field.\n' + withL(helpers.replace(/\bchip\(l, /g, 'chip(')) + '\n';
// Rebuild paint.ts imports from scratch (it had its own plus what the helpers need).
const paintSf = ts.createSourceFile('x.ts', paint, ts.ScriptTarget.ES2022, true);
for (const d of paintSf.statements.filter(ts.isImportDeclaration)) for (const e of d.importClause.namedBindings.elements) if (!importOf.has(e.name.text)) importOf.set(e.name.text, d.moduleSpecifier.text);
const paintBody = paint.split('\n').filter((x) => !x.startsWith('import ') && x !== '// @ts-nocheck').join('\n').replace(/^\n+/, '');
fs.writeFileSync(dir + 'paint.ts', `// @ts-nocheck\n${importsFor(paintBody, './paint')}\n\n${paintBody}`);

const view = [
  ln(18, 20),
  '  const head = inspectorHeader(l, multi);',
  "  if (l.type === 'audio') return { head, body: audioBody(l) };",
  '  const tf = transformSection(l, multi);',
  '  const layerSec = layerSection(l);',
  ln(44, 44),
  "  if (l.type === 'text') ({ title, look, paint, paintTitle } = textContent(l));",
  "  else if (['ellipse', 'ring', 'rect', 'star', 'polygon', 'line'].includes(l.type)) ({ title, look, paint, paintTitle } = shapeContent(l));",
  "  else if (l.type === 'path') ({ title, look, paint, paintTitle } = pathContent(l));",
  ln(81, 81).replace(/^  \} else if/, '  else if'),
  withL(ln(82, 95)),
].join('\n');
Object.assign(local, { inspectorHeader: './header', audioBody: './content-audio', transformSection: './transform', layerSection: './layer', textContent: './content-text', shapeContent: './content-shape', pathContent: './content-path' });
fs.writeFileSync(dir + 'props-view.ts', `// @ts-nocheck\n${importsFor(view, './props-view')}\n\n/** The Properties tab: header, then the sections in the v8 order (HANDOFF section 8). */\n${view}\n`);
console.log('inspector split done');
