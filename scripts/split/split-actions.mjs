// Phase 2, step 2: splits the action map A (src/actions/index.ts) into one file per domain under
// src/actions/map/, and rebuilds A in index.ts by merging them. Handler code is copied verbatim.
import ts from 'typescript';
import fs from 'node:fs';

const GROUPS = {
  app: 'undo redo menu insert export settings help close scrimclose toast theme glow tint perf mb pp autofold setdur resetproj left right sec cat acat',
  procedural: 'repon repalign modadd moddel modon animadd animdel animstart',
  presets: 'psave mypreset mypdel popt popreset preset',
  shader: 'shopaque shedit shimport shrevert shapply',
  pen: 'pendone penclose penundo pencancel pathsm pathcl pathfill',
  keys: 'copykeys pastekeys keysall keysdel kf kprev knext kgroup keyall ease qease ezcopy ezpaste ezrev autokey',
  export: 'queue excancel exsave expfmt expres expfps exptrans',
  drawing: 'tool pickdraw picksel pickshape bpre btog bcolour celadd celdup celclear onion onionpop onset celop flip flipseg',
  layers: 'sel vis lock solo allvis unlockall lqclear selall lmove dup group del move add msel compbg amute',
  inspector: 'fillon hue tset weight gtype gswap gradon trimin trimout align alignto anchorpick anchor colour cpsw eyedrop flipx flipy tfreset',
  effects: 'fxshut fxfold fxreset fxmenu fxbypass fxcopy fxpaste fxdup fxmv fxsolo addfx fxadd fxon fxdel',
  timeline: 'loopt wareset twirl play tlmode marker mkjump mkdel step',
  view: 'zoom fit zslide fitsel snap guide',
};
const TITLE = {
  app: 'App shell: history, menus, dialogs, panels, theme and settings', procedural: 'Duplicator, behaviours and text animators',
  presets: 'Motion presets and saved presets', shader: 'Shader layer code dialog', pen: 'Pen tool and path options',
  keys: 'Keyframes and easing', export: 'Export dialog', drawing: 'Tools, brush and drawing cels', layers: 'Layer list and layer management',
  inspector: 'Inspector property controls', effects: 'Effects stack', timeline: 'Timeline, playback and markers', view: 'Canvas view: zoom, fit, snap and guides',
};
const groupOf = new Map();
for (const [g, names] of Object.entries(GROUPS)) for (const n of names.split(' ')) { if (groupOf.has(n)) throw new Error('twice: ' + n); groupOf.set(n, g); }

const file = 'src/actions/index.ts';
const text = fs.readFileSync(file, 'utf8');
const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
const importDecls = sf.statements.filter(ts.isImportDeclaration);
const imported = new Map(); // name -> module specifier
for (const d of importDecls) for (const e of d.importClause.namedBindings.elements) imported.set(e.name.text, d.moduleSpecifier.text);
const stmt = sf.statements.find((s) => ts.isVariableStatement(s) && s.declarationList.declarations[0].name.text === 'A');
if (sf.statements.length !== importDecls.length + 1) throw new Error('actions/index.ts has more than the A map');
const obj = stmt.declarationList.declarations[0].initializer;

const seen = new Set();
const parts = Object.fromEntries(Object.keys(GROUPS).map((g) => [g, []]));
for (const p of obj.properties) {
  const name = p.name.getText();
  if (seen.has(name)) throw new Error('duplicate key ' + name); seen.add(name);
  const g = groupOf.get(name); if (!g) throw new Error('no group for ' + name);
  // Keep the comment lines just above the property.
  let t = text.slice(p.getFullStart(), p.end).replace(/^[ \t]*,?/, '').replace(/^\s*\n/, '');
  parts[g].push(t.trimEnd());
}
for (const n of groupOf.keys()) if (!seen.has(n)) throw new Error('unused group name ' + n);

// Identifiers used by a piece of code (scanner tokens, so strings and comments are ignored).
function idsIn(code) {
  const out = new Set();
  const f = ts.createSourceFile('x.ts', 'const __x = {\n' + code + '\n};', ts.ScriptTarget.ES2022, true);
  const visit = (n) => { if (ts.isIdentifier(n)) out.add(n.text); ts.forEachChild(n, visit); };
  visit(f);
  return out;
}
const fixPath = (spec) => (spec.startsWith('./') ? '.' + spec : spec.startsWith('../') ? '../' + spec : spec);
fs.mkdirSync('src/actions/map', { recursive: true });
const indexImports = [];
for (const [g, props] of Object.entries(parts)) {
  const code = props.map((p) => p.split('\n').map((l) => (l.startsWith('  ') ? l : '  ' + l)).join('\n')).join(',\n');
  const ids = idsIn(code);
  const bySpec = new Map();
  for (const id of ids) {
    if (id === 'A') { if (!bySpec.has('../index')) bySpec.set('../index', new Set()); bySpec.get('../index').add('A'); continue; }
    const spec = imported.get(id); if (!spec) continue;
    const s = fixPath(spec); if (!bySpec.has(s)) bySpec.set(s, new Set()); bySpec.get(s).add(id);
  }
  const imps = [...bySpec].map(([s, names]) => `import { ${[...names].sort().join(', ')} } from '${s}';`).join('\n');
  const varName = g + 'Actions';
  fs.writeFileSync(`src/actions/map/${g}.ts`, `// @ts-nocheck\n${imps}\n\n/** ${TITLE[g]}. Keys are data-act names. */\nexport const ${varName} = {\n${code},\n};\n`);
  indexImports.push([g, varName]);
}
fs.writeFileSync(file, `// @ts-nocheck
${indexImports.map(([g, v]) => `import { ${v} } from './map/${g}';`).join('\n')}

/**
 * Every tap action, keyed by its data-act name. events/delegate.ts calls A[el.dataset.act](el, event).
 * The handlers live in ./map/, one file per area.
 */
export const A = {
${indexImports.map(([, v]) => `  ...${v},`).join('\n')}
};
`);
console.log('split', seen.size, 'actions into', indexImports.length, 'files');
