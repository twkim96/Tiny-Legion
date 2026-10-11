import { readFile, readdir, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..'), source = resolve(root, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const assets = {};
async function walk(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'server') continue;
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) await walk(resolve(directory, entry.name), path);
    else if (types[extname(entry.name)]) {
      if (extname(entry.name) === '.mp3') {
        assets[path] = { body: (await readFile(resolve(directory, entry.name))).toString('base64'), type: types['.mp3'], binary: true };
        continue;
      }
      let body = await readFile(resolve(directory, entry.name), 'utf8');
      if (path === '/index.html') body = body.replace('</head>', '<script>globalThis.TINY_LEGION_SERVER = true;</script></head>');
      assets[path] = { body, type: types[extname(entry.name)] };
    }
  }
}
await walk(source);
// dist/ is maintained source. Only these two generated subdirectories are replaced.
await mkdir(resolve(source, 'server'), { recursive: true });
await mkdir(resolve(source, '.openai'), { recursive: true });
await build({ entryPoints: [resolve(root, 'server/worker.js')], outfile: resolve(source, 'server/index.js'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  plugins: [{ name: 'embedded-game-assets', setup(build) {
    build.onResolve({ filter: /^__game_assets__$/ }, () => ({ path: 'assets', namespace: 'game' }));
    build.onLoad({ filter: /.*/, namespace: 'game' }, () => ({ contents: `export const assets = ${JSON.stringify(assets)};`, loader: 'js' }));
  } }],
});
const manifest = JSON.parse(await readFile(resolve(root, '.openai/hosting.json'), 'utf8'));
if (manifest.static || manifest.d1 !== 'DB') throw new Error('Worker hosting must bind DB and omit static');
await writeFile(resolve(source, '.openai/hosting.json'), JSON.stringify(manifest, null, 2));
await rm(resolve(source, '.openai/drizzle'), { recursive: true, force: true });
await cp(resolve(root, 'drizzle'), resolve(source, '.openai/drizzle'), { recursive: true });
const worker = (await import(`${resolve(source, 'server/index.js')}?build=${Date.now()}`)).default;
if (typeof worker?.fetch !== 'function') throw new Error('Invalid Worker fetch export');
const response = await worker.fetch(new Request('https://tiny-legion.test/'), {});
if (!response.ok || !(await response.text()).includes('TINY_LEGION_SERVER = true')) throw new Error('Missing hosted account bootstrap');
for (const path of Object.keys(assets).filter(path => path.endsWith('.mp3'))) {
  const audio = await worker.fetch(new Request(`https://tiny-legion.test${path}`), {});
  const bytes = new Uint8Array(await audio.arrayBuffer());
  if (!audio.ok || audio.headers.get('Content-Type') !== 'audio/mpeg' || bytes.length !== Buffer.from(assets[path].body, 'base64').length) throw new Error('Invalid audio asset');
  const ranged = await worker.fetch(new Request(`https://tiny-legion.test${path}`, { headers: { Range: 'bytes=0-99' } }), {});
  if (ranged.status !== 206 || !Buffer.from(await ranged.arrayBuffer()).equals(Buffer.from(bytes.slice(0, 100)))) throw new Error('Audio range response mismatch');
  const head = await worker.fetch(new Request(`https://tiny-legion.test${path}`, { method: 'HEAD' }), {});
  if (!head.ok || Number(head.headers.get('Content-Length')) !== bytes.length || (await head.arrayBuffer()).byteLength) throw new Error('Invalid audio HEAD');
}
console.log(`Worker built with ${Object.keys(assets).length} embedded game assets and D1 migrations`);
