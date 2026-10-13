import { mkdir, readdir, readFile, writeFile, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const source=resolve(root,'unity/Assets/TinyLegion/Art/Svg');
const target=resolve(root,'unity/Assets/TinyLegion/Resources/Art');
await mkdir(target,{recursive:true});
for(const file of await readdir(source)) {
 if(!file.endsWith('.svg')) continue;
 const png=new Resvg(await readFile(resolve(source,file),'utf8'),{fitTo:{mode:'width',value:384}}).render().asPng();
 await writeFile(resolve(target,file.replace('.svg','.png')),png);
}
await cp(resolve(root,'dist/assets/music'),resolve(root,'unity/Assets/TinyLegion/Resources/Music'),{recursive:true});
console.log('Exported original character art and licensed music for Unity');
