// Runs a command with KEY=value environment variables, on Windows and macOS alike (no extra dependency).
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2), env = { ...process.env };
while (args[0] && /^[A-Z_]+=/.test(args[0])) { const [k, ...v] = args.shift().split('='); env[k] = v.join('='); }
const r = spawnSync(args.join(' '), { stdio: 'inherit', env, shell: true });
process.exit(r.status ?? 1);
