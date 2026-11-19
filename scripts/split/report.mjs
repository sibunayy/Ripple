// Prints what the split would need: cross-module writes and load-time order problems.
import { analyze } from './analyze-refs.mjs';
import { plan } from './plan.mjs';
const A = analyze();
const P = plan(A);
console.log('modules:', P.mods.length);
console.log('cross-module writes:');
for (const r of P.crossWrites) console.log(`  ${r.d.name} (${r.d.mod}) <- ${r.st.mod} L${A.lineOf(r.id.getStart())} ${r.write.kind}: ${r.write.node.getText().slice(0, 100).replace(/\n/g, ' ')}`);
console.log('load-time violations:');
for (const v of P.violations) console.log('  ' + v);
console.log('eval order:', P.evalOrder.join(' > '));
