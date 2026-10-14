import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bridge = await readFile(new URL('../unity/Assets/Plugins/WebGL/TinyLegion.fullscreen.jslib', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function browser({ unsupported = false, denied = false, lock, exit } = {}) {
  const calls = [], notices = [], listeners = [];
  const doc = {
    fullscreenElement: null,
    documentElement: {},
    addEventListener(name, handler) {
      assert.equal(name, 'fullscreenchange');
      listeners.push(handler);
    },
    exitFullscreen: exit ?? (() => {
      calls.push('exit');
      doc.fullscreenElement = null;
      listeners.forEach(handler => handler());
      return Promise.resolve();
    }),
  };
  if (!unsupported) doc.documentElement.requestFullscreen = () => {
    calls.push('request');
    if (denied) throw new Error('Fullscreen denied');
    doc.fullscreenElement = doc.documentElement;
    return Promise.resolve();
  };
  const orientation = {
    lock: lock ?? (direction => { calls.push(direction); return Promise.resolve(); }),
    unlock: () => calls.push('unlock'),
  };
  const library = {};
  const context = vm.createContext({
    document: doc, screen: { orientation }, alert: message => notices.push(message),
    LibraryManager: { library }, mergeInto: Object.assign,
  });
  vm.runInContext(bridge, context);
  // Emscripten exposes $library helpers without their leading dollar sign.
  for (const dependency of library.TL_Fullscreen__deps) context[dependency.slice(1)] = library[dependency];
  return { click: library.TL_Fullscreen, calls, notices, doc, listeners, context };
}

test('Unity unsupported fullscreen reports manual rotation without throwing or locking', async () => {
  const state = browser({ unsupported: true });
  assert.doesNotThrow(() => state.click());
  await flush();
  assert.deepEqual(state.calls, []);
  assert.match(state.notices[0], /지원하지/);
});

test('Unity requests fullscreen during the click, then locks landscape and releases on browser exit', async () => {
  const state = browser();
  state.click();
  assert.deepEqual(state.calls, ['request']);
  await flush();
  assert.deepEqual(state.calls, ['request', 'landscape']);
  assert.deepEqual(state.notices, []);
  state.doc.fullscreenElement = null;
  state.listeners.forEach(handler => handler());
  assert.equal(state.calls.at(-1), 'unlock');
  state.click();
  await flush();
  assert.equal(state.listeners.length, 1);
});

test('Unity fullscreen request rejection gives a retry notice and never locks orientation', async () => {
  const state = browser({ denied: true });
  state.click();
  await flush();
  assert.deepEqual(state.calls, ['request']);
  assert.match(state.notices[0], /다시 누르거나/);
});

test('Unity orientation denial preserves fullscreen and explains manual rotation', async () => {
  const state = browser({ lock: () => Promise.reject(new Error('Orientation denied')) });
  state.click();
  await flush();
  assert.equal(state.doc.fullscreenElement, state.doc.documentElement);
  assert.match(state.notices[0], /회전 잠금/);
});

test('Unity exit during pending landscape lock also releases a late lock', async () => {
  let finishLock;
  const state = browser({ lock: () => new Promise(resolve => { finishLock = resolve; }) });
  state.click();
  await flush();
  state.doc.fullscreenElement = null;
  state.listeners.forEach(handler => handler());
  finishLock();
  await flush();
  assert.equal(state.calls.filter(call => call === 'unlock').length, 2);
  assert.match(state.notices[0], /전체 화면이 종료/);
});

test('Unity fullscreen toggle exits and releases orientation', async () => {
  const state = browser();
  state.click();
  await flush();
  state.click();
  await flush();
  assert.equal(state.doc.fullscreenElement, null);
  assert.ok(state.calls.includes('exit'));
  assert.equal(state.calls.at(-1), 'unlock');
});

test('Unity failed exit reports browser controls and keeps the current screen', async () => {
  const state = browser({ exit: () => { throw new Error('Exit denied'); } });
  state.click();
  await flush();
  state.click();
  await flush();
  assert.equal(state.doc.fullscreenElement, state.doc.documentElement);
  assert.match(state.notices[0], /종료 버튼/);
  assert.ok(!state.calls.includes('unlock'));
});

test('Unity maps high DPI framebuffer pixels back to browser layout units', () => {
  const library = {};
  const context = vm.createContext({Module: {canvas: {width: 2440, clientWidth: 1220, clientHeight: 686.25}}, LibraryManager: {library}, mergeInto: Object.assign});
  vm.runInContext(bridge, context);
  assert.equal(library.TL_DisplayScale(), 2);
  context.Module.canvas.width = 667;
  context.Module.canvas.clientWidth = 667;
  context.Module.canvas.clientHeight = 375;
  assert.equal(library.TL_DisplayScale(), 1);
  context.Module.canvas.clientWidth = 0;
  assert.equal(library.TL_DisplayScale(), 1);
});

test('Unity narrow portrait canvas scales the whole landscape HUD instead of overlapping fixed controls', () => {
  const library = {};
  const context = vm.createContext({Module: {canvas: {width: 1074, clientWidth: 358, clientHeight: 358*9/16}}, LibraryManager: {library}, mergeInto: Object.assign});
  vm.runInContext(bridge, context);
  const scale=library.TL_DisplayScale();
  assert.ok(Math.abs(1074/scale-667)<.01);
  assert.ok(Math.abs(358*9/16*3/scale-375.1875)<.01);
  context.Module.canvas.width=358;
  assert.ok(library.TL_DisplayScale()<1);
});

test('Portrait HTML fullscreen button calls the shared request synchronously and restores its enabled state', async () => {
  const state=browser();
  const button={disabled:false,textContent:'전체 화면'},status={textContent:'가로 화면에서 플레이해 주세요.'};
  state.doc.getElementById=id=>id==='rotate-fullscreen'?button:id==='rotate-status'?status:null;
  const source=await readFile(new URL('../unity/Assets/WebGLTemplates/TinyLegion/fullscreen.js',import.meta.url),'utf8');
  vm.runInContext(source,state.context);
  vm.runInContext('TinyLegionFullscreen.bindRotationPrompt()',state.context);
  const completion=button.onclick();
  assert.deepEqual(state.calls,['request']);
  assert.equal(button.disabled,true);
  await completion;
  assert.equal(button.disabled,false);
  assert.equal(status.textContent,'');
});
