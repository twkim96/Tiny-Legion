import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = await readFile(resolve(root, 'dist/src/fullscreen.js'), 'utf8');
const start = source.indexOf('export async function enterLandscapeFullscreen(');
const end = source.indexOf('export function bindRotationPrompt(', start);
if (start < 0 || end < 0) throw new Error('Missing maintained fullscreen entry point');
const enter = source.slice(start, end).trim().replace('export async function enterLandscapeFullscreen', 'async function');
const output = resolve(root, 'unity/Assets/Plugins/WebGL/TinyLegion.fullscreen.jslib');
await mkdir(resolve(root, 'unity/Assets/Plugins/WebGL'), { recursive: true });
await writeFile(output, `// Generated from dist/src/fullscreen.js by scripts/unity/export-platform.mjs.
// Edit the maintained browser function, then export; do not maintain a second copy.
mergeInto(LibraryManager.library, {
  $TL_EnterLandscapeFullscreen: ${enter},
  $TL_FullscreenHooks: {
    installed: false,
    unlock: function() { try { globalThis.screen?.orientation?.unlock?.(); } catch {} },
    install: function() {
      if (this.installed) return;
      this.installed = true;
      document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement) TL_FullscreenHooks.unlock();
      });
    }
  },
  TL_Fullscreen__deps: ['$TL_EnterLandscapeFullscreen', '$TL_FullscreenHooks'],
  TL_Fullscreen: function() {
    TL_FullscreenHooks.install();
    if (document.fullscreenElement) {
      Promise.resolve().then(function() { return document.exitFullscreen(); })
        .then(function() { TL_FullscreenHooks.unlock(); })
        .catch(function() { alert('전체 화면을 종료하지 못했습니다. 브라우저의 전체화면 종료 버튼을 사용해 주세요.'); });
      return;
    }
    // The maintained async function requests fullscreen during user activation.
    TL_EnterLandscapeFullscreen().then(function(result) {
      if (result.message) alert(result.message);
    }).catch(function() { alert('전체화면을 사용할 수 없습니다. 기기를 가로로 돌려 주세요.'); });
  }
});
`);
console.log('Exported the maintained browser fullscreen behavior to the Unity bridge');
