import { readdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
let count = 0, failed = false;
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (['.js', '.mjs', '.cjs'].includes(extname(path))) {
      count++;
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) failed = true;
    }
  }
}
for (const directory of ['dist/src', 'server', 'scripts', 'tests']) await check(resolve(root, directory));
console.log(`Syntax checked ${count} source, server, script and test files`);
if (failed) process.exitCode = 1;
