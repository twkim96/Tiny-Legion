// Export current Canvas scenery, including original castles, without a browser.
import {createCanvas,Image} from '@napi-rs/canvas';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SPEEDRUN_SCENES} from '../../dist/src/speedrun.js';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
globalThis.Image=Image;
const source=await readFile(resolve(root,'dist/src/renderer.js'),'utf8');
const helperStart=source.indexOf('function path('), helperEnd=source.indexOf('export class Renderer');
const helpers=source.slice(helperStart,helperEnd);
const output=resolve(root,'unity/Assets/TinyLegion/Resources/Scenery');await mkdir(output,{recursive:true});
for(const enemy of [false,true]) {
 const canvas=createCanvas(320,420);
 new Function('c',`${helpers}\ncastle(c,160,385,260,${enemy},0);`)(canvas.getContext('2d'));
 await writeFile(resolve(output,`${enemy?'enemy':'player'}-castle.png`),canvas.toBuffer('image/png'));
}
const bodyStart=source.indexOf('  drawBackground() {')+'  drawBackground() {'.length;
const bodyEnd=source.indexOf('  resetForBattle(',bodyStart);
const body=source.slice(bodyStart,bodyEnd).replace(/}\s*$/,'');
for(const scene of [null,...Object.keys(SPEEDRUN_SCENES)]) {
 const canvas=createCanvas(1280,720);const renderer={bg:canvas,width:1280,height:720,dpr:1,scene};
 new Function('SPEEDRUN_SCENES',`${helpers}\nreturn function(){${body}};`)(SPEEDRUN_SCENES).call(renderer);
 await writeFile(resolve(output,`background-${scene??'normal'}.png`),canvas.toBuffer('image/png'));
}
console.log('Exported original castles and mode scenery');
