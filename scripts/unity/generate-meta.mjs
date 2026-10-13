import {readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,extname} from 'node:path';
const root=resolve('unity');const assets=resolve(root,'Assets');
async function walk(path){
 for(const entry of await readdir(path,{withFileTypes:true})){
  if(entry.name.endsWith('.meta'))continue;
  const file=resolve(path,entry.name),meta=file+'.meta';
  try{await stat(meta);}catch{
   const guid=createHash('sha256').update('tiny-legion:'+relative(root,file)).digest('hex').slice(0,32);
   let importer=entry.isDirectory()?'folderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n':extname(file)==='.cs'?'MonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n':extname(file)==='.asmdef'?'AssemblyDefinitionImporter:\n  externalObjects: {}\n':'DefaultImporter:\n  externalObjects: {}\n';
   if(file.includes('/Resources/Art/')&&extname(file)==='.png')importer='TextureImporter:\n  internalIDToNameTable: []\n  externalObjects: {}\n  serializedVersion: 13\n  mipmaps:\n    enableMipMap: 0\n  textureFormat: 1\n  maxTextureSize: 2048\n  textureSettings:\n    serializedVersion: 2\n    filterMode: 1\n    wrapU: 1\n    wrapV: 1\n  spriteMode: 1\n  spritePixelsToUnits: 384\n  spriteAlignment: 7\n  spritePivot: {x: 0.5, y: 0}\n  alphaUsage: 1\n  alphaIsTransparency: 1\n  textureType: 8\n  platformSettings: []\n  spriteSheet:\n    serializedVersion: 2\n    sprites: []\n    outline: []\n    physicsShape: []\n';
   await writeFile(meta,`fileFormatVersion: 2\nguid: ${guid}\n${importer}  userData:\n  assetBundleName:\n  assetBundleVariant:\n`);
  }
  if(entry.isDirectory())await walk(file);
 }
}
await walk(assets);console.log('Preserved existing GUIDs and created deterministic metadata for new assets');
