import {cp,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=resolve('dist'), target=resolve('.sites-local/android-web');
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
await cp(source,target,{recursive:true,filter:path=>!['server','.openai'].includes(path.slice(source.length+1).split('/')[0])});
console.log('Prepared local game assets for Android (no remote server URL).');
