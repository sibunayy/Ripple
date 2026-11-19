// Phase 2 analysis: resolves every identifier in the phase 1 script to its top-level declaration
// (with the TypeScript checker, so shadowed local names are never confused with globals).
import ts from 'typescript';
import path from 'node:path';
import { MAP } from './map.mjs';

export function analyze(fileArg = 'scripts/split/legacy-main.phase1.ts') {
  const file = path.resolve(fileArg);
  const prog = ts.createProgram([file], { allowJs: true, noEmit: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] });
  const checker = prog.getTypeChecker();
  const sf = prog.getSourceFile(file);
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  let body;
  sf.forEachChild((n) => {
    if (ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)) {
      let f = n.expression.expression;
      if (ts.isParenthesizedExpression(f)) f = f.expression;
      if (ts.isArrowFunction(f)) body = f.body;
    }
  });
  const modOf = (ln) => { let m = null; for (const [l, p] of MAP) if (l <= ln) m = p; return m; };
  const stmts = body.statements.filter((s) => !(ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression)));
  const S = stmts.map((s, i) => ({ node: s, i, mod: modOf(lineOf(s.getStart())), names: [], listener: false, boot: false }));

  const decl = new Map();
  for (const st of S) {
    const s = st.node;
    const add = (idNode, kind) => { const sym = checker.getSymbolAtLocation(idNode); decl.set(sym, { name: idNode.text, mod: st.mod, kind, st }); st.names.push(idNode.text); };
    if (ts.isVariableStatement(s)) {
      const kind = s.declarationList.flags & ts.NodeFlags.Let ? 'let' : 'const';
      for (const d of s.declarationList.declarations) { if (!ts.isIdentifier(d.name)) throw new Error('destructuring at top level, line ' + lineOf(d.getStart())); add(d.name, kind); }
    } else if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) && s.name) add(s.name, ts.isClassDeclaration(s) ? 'class' : 'function');
  }

  const isListenerExpr = (e) => {
    if (!ts.isCallExpression(e)) return false;
    const c = e.expression;
    if (ts.isIdentifier(c) && c.text === 'addEventListener') return true;
    if (ts.isPropertyAccessExpression(c) && c.name.text === 'addEventListener') return true;
    if (ts.isPropertyAccessExpression(c) && c.name.text === 'observe' && ts.isNewExpression(c.expression)) return true;
    return false;
  };
  for (const st of S) {
    const s = st.node;
    if (st.mod === 'main') { st.boot = true; continue; }
    if (ts.isExpressionStatement(s) && isListenerExpr(s.expression)) st.listener = true;
    if (ts.isIfStatement(s) && /document\.fonts/.test(s.getText())) st.listener = true;
  }

  const isFnLike = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n) || ts.isConstructorDeclaration(n);
  const isAssignOp = (k) => k >= ts.SyntaxKind.FirstAssignment && k <= ts.SyntaxKind.LastAssignment;
  function writeKind(id) {
    let n = id, p = id.parent;
    if (ts.isBinaryExpression(p) && p.left === n && isAssignOp(p.operatorToken.kind)) return { kind: p.operatorToken.kind === ts.SyntaxKind.EqualsToken ? 'assign' : 'compound', node: p };
    if ((ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken)) return { kind: 'incdec', node: p };
    while (p && (ts.isArrayLiteralExpression(p) || ts.isObjectLiteralExpression(p) || ts.isShorthandPropertyAssignment(p) || ts.isPropertyAssignment(p) || ts.isSpreadElement(p))) { n = p; p = p.parent; }
    if (n !== id && ts.isBinaryExpression(p) && p.left === n && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) return { kind: 'destructure', node: p };
    return null;
  }
  const refs = [];
  for (const st of S) {
    const visit = (n, inFn) => {
      if (ts.isIdentifier(n)) {
        let sym = checker.getSymbolAtLocation(n);
        const short = n.parent && ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n;
        if (short) sym = checker.getShorthandAssignmentValueSymbol(n.parent);
        const d = sym && decl.get(sym);
        const isDeclName = n.parent && (ts.isVariableDeclaration(n.parent) || ts.isFunctionDeclaration(n.parent) || ts.isClassDeclaration(n.parent)) && n.parent.name === n;
        if (d && !isDeclName) refs.push({ id: n, d, st, inFn, write: writeKind(n), short });
      }
      ts.forEachChild(n, (c) => visit(c, inFn || isFnLike(n)));
    };
    visit(st.node, false);
  }
  return { ts, sf, text: sf.text, S, decl, refs, lineOf };
}
