import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// docs/ui-contract.md: the engine must not depend on the UI, so the UI can be replaced without touching it.
const ENGINE = ['model', 'eval', 'anim', 'render', 'shape', 'text', 'lottie', 'export', 'io'];
const files = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : /\.tsx?$/.test(f) ? [join(d, f)] : []));

describe('layering', () => {
  it('engine modules never import src/app or src/ui', () => {
    const bad = ENGINE.flatMap((d) => files(join('src', d))).filter((f) => /from\s+['"](\.\.\/)+(app|ui)\//.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
