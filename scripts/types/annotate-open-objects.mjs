// Phase 3 helper: the prototype often builds an object as `{}` or a literal and adds fields later.
// TypeScript reports each later field as TS2339 ("does not exist on type"). For every such error
// whose object is a local variable without a type, this adds `: any` to that variable's declaration.
// Types only; no runtime change.
import ts from 'typescript';
import fs from 'node:fs';

const cfg = ts.getParsedCommandLineOfConfigFile('tsconfig.json', {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
const prog = ts.createProgram(cfg.fileNames, cfg.options);
const checker = prog.getTypeChecker();
const diags = ts.getPreEmitDiagnostics(prog).filter((d) => d.code === 2339 && d.file && /on type '\{/.test(ts.flattenDiagnosticMessageText(d.messageText, '\n')));
const edits = new Map();
const findNode = (sf, pos) => { let found; const visit = (n) => { if (pos >= n.getStart(sf) && pos < n.end) { found = n; ts.forEachChild(n, visit); } }; visit(sf); return found; };
for (const d of diags) {
  let n = findNode(d.file, d.start);
  while (n && !ts.isPropertyAccessExpression(n)) n = n.parent;
  if (!n) continue;
  let obj = n.expression;
  const sym = checker.getSymbolAtLocation(obj);
  const decl = sym && sym.valueDeclaration;
  if (!decl || !ts.isVariableDeclaration(decl) || decl.type || !ts.isIdentifier(decl.name)) continue;
  const sf = decl.getSourceFile();
  if (!edits.has(sf.fileName)) edits.set(sf.fileName, new Set());
  edits.get(sf.fileName).add(decl.name.end);
}
let n = 0;
for (const [f, set] of edits) {
  let t = fs.readFileSync(f, 'utf8');
  for (const pos of [...set].sort((a, b) => b - a)) { t = t.slice(0, pos) + ': any' + t.slice(pos); n++; }
  fs.writeFileSync(f, t);
}
console.log(`annotated ${n} declarations in ${edits.size} files`);
