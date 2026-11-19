// Phase 2 codemod: writes src/**/*.ts from the phase 1 script.
// - Every statement keeps its original text (and the comments just above it).
// - Top-level names used by other modules are exported; users import them.
// - A variable that another module assigns gets a setter (setX), and those assignments call it.
// - Event-listener registrations move into an exported listen() per module; main.ts calls them
//   in the original order, so listeners are registered in exactly the same sequence.
import fs from 'node:fs';
import path from 'node:path';
import { analyze } from './analyze-refs.mjs';
import { plan, setterName } from './plan.mjs';

const A = analyze();
const { ts, text, S, refs } = A;
const P = plan(A);
if (P.violations.length) throw new Error('load-order violations:\n' + P.violations.join('\n'));
const allNames = new Set(S.flatMap((s) => s.names));
for (const n of P.writtenVars.keys()) if (allNames.has(setterName(n))) throw new Error('setter name clash: ' + setterName(n));
if (allNames.has('listen')) throw new Error('listen() name clash');

const OUT = 'src';
const rel = (from, to) => { let r = path.posix.relative(path.posix.dirname(from), to); if (!r.startsWith('.')) r = './' + r; return r; };

// Text of one statement with edits applied: cross-module writes become setter calls.
function stmtText(st, exported) {
  const start = st.node.getFullStart(), end = st.node.end;
  const edits = [];
  for (const r of refs) {
    if (r.st !== st || !r.write || r.d.mod === st.mod) continue;
    if (r.write.kind !== 'assign') throw new Error(`unsupported cross-module ${r.write.kind} of ${r.d.name} at line ${A.lineOf(r.id.getStart())}`);
    const b = r.write.node; // name = value
    edits.push({ at: b.getStart(), to: b.right.getStart(), s: setterName(r.d.name) + '(' });
    edits.push({ at: b.end, to: b.end, s: ')' });
  }
  if (exported) edits.push({ at: st.node.getStart(), to: st.node.getStart(), s: 'export ' });
  edits.sort((a, b) => b.at - a.at || b.to - a.to);
  let t = text.slice(start, end);
  for (const e of edits) t = t.slice(0, e.at - start) + e.s + t.slice(e.to - start);
  return t.replace(/^\s*\n/, '');
}

const files = new Map();
const listenOrder = [];
for (const m of P.mods) {
  const mine = S.filter((s) => s.mod === m);
  const exp = P.exportsOf.get(m);
  const lines = [];
  const listeners = [];
  let prev = null;
  for (const st of mine) {
    const t = stmtText(st, st.names.some((n) => exp.has(n)));
    const bucket = st.listener ? listeners : lines;
    // Statements that shared a line in the source stay on one line.
    const sameLine = prev && prev.st.i === st.i - 1 && prev.bucket === bucket && !/\n/.test(text.slice(st.node.getFullStart(), st.node.getStart()));
    if (sameLine) bucket[bucket.length - 1] += text.slice(st.node.getFullStart(), st.node.getStart()) + t.replace(/^\s+/, '');
    else bucket.push(t);
    prev = { st, bucket };
  }
  for (const [n, d] of P.writtenVars) if (d.mod === m) lines.push(`export function ${setterName(n)}(v) { return (${n} = v); }`);
  if (listeners.length) {
    lines.push('/** Registers this module\'s event listeners. main.ts calls it once, in the original order. */\nexport function listen() {\n' + listeners.map((l) => l.split('\n').map((x) => (x ? '  ' + x : x)).join('\n')).join('\n') + '\n}');
    listenOrder.push([mine.find((s) => s.listener).i, m]);
  }
  files.set(m, { lines, imports: P.imports.get(m) });
}

const header = '// @ts-nocheck\n';
for (const [m, f] of files) {
  if (m === 'main') continue;
  const imp = P.order(f.imports.keys()).map((from) => `import { ${[...f.imports.get(from)].sort().join(', ')} } from '${rel(m, from)}';`);
  const src = header + (imp.length ? imp.join('\n') + '\n\n' : '\n') + f.lines.join('\n') + '\n';
  fs.mkdirSync(path.dirname(path.join(OUT, m + '.ts')), { recursive: true });
  fs.writeFileSync(path.join(OUT, m + '.ts'), src);
}

// main.ts: CSS, every module in source order (module data is set up in that order), listeners, boot.
const main = files.get('main');
const mainImports = main.imports;
listenOrder.sort((a, b) => a[0] - b[0]);
const lmods = new Set(listenOrder.map(([, m]) => m));
const alias = (m) => 'listen' + m.split(/[/-]/).map((x) => x[0].toUpperCase() + x.slice(1)).join('');
const mainLines = [
  '// @ts-nocheck',
  '// RippleFlow entry point. Loads the styles, the modules, registers the event listeners in the',
  '// original order, then boots the app.',
  "import './styles/index.css';",
];
for (const m of P.order(P.mods.filter((x) => x !== 'main'))) {
  const names = [...(mainImports.get(m) || [])].sort();
  if (lmods.has(m)) names.push(`listen as ${alias(m)}`);
  mainLines.push(names.length ? `import { ${names.join(', ')} } from './${m}';` : `import './${m}';`);
}
mainLines.push('', ...listenOrder.map(([, m]) => `${alias(m)}();`), '', ...main.lines);
fs.writeFileSync(path.join(OUT, 'main.ts'), mainLines.join('\n') + '\n');
console.log('wrote', files.size, 'modules; listeners in', listenOrder.map(([, m]) => m).join(', '));
