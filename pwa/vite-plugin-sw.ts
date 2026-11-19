import fs from 'node:fs';
import crypto from 'node:crypto';
import type { Plugin } from 'vite';

/**
 * Build-time only: writes sw.js next to index.html with the list of files to cache for offline use
 * and a version made from their contents, so each new build replaces the old cache.
 */
export function serviceWorker(): Plugin {
  return {
    name: 'rippleflow-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const pub = (dir: string, base = ''): string[] => fs.readdirSync(dir, { withFileTypes: true })
        .flatMap((d) => (d.isDirectory() ? pub(dir + '/' + d.name, base + d.name + '/') : [base + d.name]));
      const files = ['./', ...Object.keys(bundle), ...pub('public')].filter((f) => f !== 'sw.js' && !f.endsWith('.map')).sort();
      const hash = crypto.createHash('sha256');
      for (const f of Object.keys(bundle).sort()) { const c = bundle[f]; hash.update(f).update(c.type === 'chunk' ? c.code : c.source); }
      for (const f of pub('public')) hash.update(f).update(fs.readFileSync('public/' + f));
      const code = fs.readFileSync('pwa/sw.template.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__FILES__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code });
    },
  };
}
