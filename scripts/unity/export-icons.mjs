import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { icon } from '../../dist/src/art.js';

const source = await readFile('dist/src/art.js', 'utf8');
const definitions = source.slice(source.indexOf('const iconPaths ='), source.indexOf('export function icon('));
const names = new Function(definitions + '\nreturn Object.keys(iconPaths);')();
const directory = resolve('unity/Assets/TinyLegion/Resources/Icons');
await mkdir(directory, { recursive: true });
for (const name of names) {
  const svg = icon(name).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replaceAll('currentColor', '#343e2c');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 96 } }).render().asPng();
  await writeFile(resolve(directory, name + '.png'), png);
}
console.log('Exported maintained browser icons for Unity');
