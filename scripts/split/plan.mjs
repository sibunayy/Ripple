// Builds the module graph from the analysis and simulates ES module evaluation order.
export const setterName = (n) => 'set' + n[0].toUpperCase() + n.slice(1);

export function plan(A) {
  const { S, refs } = A;
  const mods = [...new Set(S.map((s) => s.mod))];
  const firstIdx = new Map();
  for (const st of S) if (!firstIdx.has(st.mod)) firstIdx.set(st.mod, st.i);
  const crossWrites = refs.filter((r) => r.write && r.st.mod !== r.d.mod);
  const writtenVars = new Map();
  for (const r of crossWrites) {
    if (r.d.kind !== 'let') throw new Error(`cross-module write to ${r.d.kind} ${r.d.name}`);
    writtenVars.set(r.d.name, r.d);
  }
  const imports = new Map(mods.map((m) => [m, new Map()]));
  const exportsOf = new Map(mods.map((m) => [m, new Set()]));
  const evalDeps = new Map(mods.map((m) => [m, new Set()]));
  const need = (m, from, name) => {
    const im = imports.get(m);
    if (!im.has(from)) im.set(from, new Set());
    im.get(from).add(name);
    exportsOf.get(from).add(name);
  };
  for (const r of refs) {
    if (r.st.mod === r.d.mod) continue;
    const plainAssign = r.write && r.write.kind === 'assign';
    if (r.write) need(r.st.mod, r.d.mod, setterName(r.d.name));
    if (!plainAssign) need(r.st.mod, r.d.mod, r.d.name);
    // Function declarations are ready before any module code runs, so they are safe even inside an import cycle.
    if (!r.inFn && !r.st.listener && !r.st.boot && r.d.kind !== 'function') evalDeps.get(r.st.mod).add(r.d.mod + ':' + r.d.name);
  }
  const order = (ms) => [...ms].sort((a, b) => firstIdx.get(a) - firstIdx.get(b));
  const state = new Map(), evalOrder = [], violations = [];
  function evaluate(m) {
    if (state.has(m)) return;
    state.set(m, 'busy');
    for (const dep of order(imports.get(m).keys())) evaluate(dep);
    for (const e of evalDeps.get(m)) {
      const [dm, name] = e.split(':');
      if (state.get(dm) !== 'done') violations.push(`${m} needs ${name} from ${dm} at load time, but ${dm} is ${state.get(dm) || 'not loaded'}`);
    }
    state.set(m, 'done');
    evalOrder.push(m);
  }
  // main.ts imports every module in source order (side-effect free apart from module data setup).
  for (const m of order(mods.filter((x) => x !== 'main'))) evaluate(m);
  evaluate('main');
  return { mods, firstIdx, crossWrites, writtenVars, imports, exportsOf, evalDeps, violations, evalOrder, order };
}
