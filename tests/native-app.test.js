import test from 'node:test';
import assert from 'node:assert/strict';
import { exportNativeSave, backgroundNativeApp, bindNativeBack } from '../dist/src/native-app.js';

test('ordinary web exports stay on the browser path', async () => {
  assert.equal(await exportNativeSave('{"gold":20}'),null);
});
test('Android export preserves the snapshot and cancellation and wires native Back', async () => {
  const calls=[];
  const plugin={
    exportSave:async options=>{calls.push(options.contents);return {cancelled: calls.length===1};},
    background:async()=>calls.push('background'), ready:async()=>calls.push('ready'),
  };
  globalThis.Capacitor={getPlatform:()=> 'android',isPluginAvailable:()=>true,registerPlugin:()=>plugin};
  try {
    assert.equal((await exportNativeSave('{"gold":20}')).cancelled,true);
    assert.equal((await exportNativeSave('{"gold":21}')).cancelled,false);
    assert.deepEqual(calls,['{"gold":20}','{"gold":21}']);
    const target=new EventTarget();let backs=0;
    bindNativeBack(()=>backs++,target);target.dispatchEvent(new Event('tiny-legion-back'));
    assert.equal(backs,1);await backgroundNativeApp();assert.deepEqual(calls.slice(2),['ready','background']);
  } finally { delete globalThis.Capacitor; }
});
test('missing Android integration fails explicitly instead of silently attempting a browser download', async () => {
  globalThis.Capacitor={getPlatform:()=> 'android',isPluginAvailable:()=>false};
  try {
    await assert.rejects(exportNativeSave('{}'),/unavailable/);
    assert.equal(bindNativeBack(()=>{},new EventTarget()),false);
  }
  finally {delete globalThis.Capacitor;}
});
test('the injected Android bridge works without the separately bundled registerPlugin API', async () => {
  let contents;
  globalThis.Capacitor={getPlatform:()=> 'android',isPluginAvailable:()=>true,
    Plugins:{NativeGame:{exportSave:async options=>{contents=options.contents;return {cancelled:false};}}}};
  try {
    assert.equal((await exportNativeSave('{"gold":30}')).cancelled,false);
    assert.equal(contents,'{"gold":30}');
  } finally {delete globalThis.Capacitor;}
});
