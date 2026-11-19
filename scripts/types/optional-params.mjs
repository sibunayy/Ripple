// Phase 3 helper: the prototype often calls a function with fewer arguments than it declares
// (the missing ones are undefined on purpose). TypeScript reports these as TS2554. This marks the
// trailing parameters of each such function optional (`name?`). Types only; no runtime change.
import ts from 'typescript';
import fs from 'node:fs';

const cfg = ts.getParsedCommandLineOfConfigFile('tsconfig.json', {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
const prog = ts.createProgram(cfg.fileNames, cfg.options);
const checker = prog.getTypeChecker();
const diags = ts.getPreEmitDiagnostics(prog).filter((d) => d.code === 2554 && d.file);
const edits = new Map(); // file -> Map(pos -> text)
const findNode = (sf, pos) => { let found; const visit = (n) => { if (pos >= n.getStart(sf) && pos < n.end) { found = n; ts.forEachChild(n, visit); } }; visit(sf); return found; };
let marked = 0;
for (const d of diags) {
  let n = findNode(d.file, d.start);
  while (n && !ts.isCallExpression(n) && !ts.isNewExpression(n)) n = n.parent;
  if (!n) continue;
  const sig = checker.getResolvedSignature(n);
  const decl = sig && sig.declaration;
  if (!decl || !decl.parameters) continue;
  const given = (n.arguments || []).length;
  const sf = decl.getSourceFile();
  for (let i = given; i < decl.parameters.length; i++) {
    const p = decl.parameters[i];
    if (p.questionToken || p.initializer || p.dotDotDotToken) continue;
    if (!edits.has(sf.fileName)) edits.set(sf.fileName, new Map());
    edits.get(sf.fileName).set(p.name.end, '?');
  }
}
for (const [f, m] of edits) {
  let t = fs.readFileSync(f, 'utf8');
  for (const pos of [...m.keys()].sort((a, b) => b - a)) { t = t.slice(0, pos) + '?' + t.slice(pos); marked++; }
  fs.writeFileSync(f, t);
}
console.log(`marked ${marked} parameters optional in ${edits.size} files`);
