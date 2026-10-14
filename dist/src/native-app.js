let nativeGame;
function androidPlugin() {
  const cap = globalThis.Capacitor;
  if (cap?.getPlatform() !== 'android') return null;
  if (!cap.isPluginAvailable('NativeGame')) throw new Error('Android integration unavailable');
  if (cap.Plugins?.NativeGame) return cap.Plugins.NativeGame;
  return nativeGame ??= cap.registerPlugin('NativeGame');
}
export async function exportNativeSave(contents) {
  const plugin = androidPlugin();
  if (!plugin) return null;
  return plugin.exportSave({ contents });
}
export async function backgroundNativeApp() {
  await androidPlugin()?.background();
}
export function bindNativeExportResults(onResult, target = window) {
  let plugin;
  try { plugin = androidPlugin(); } catch { return false; }
  if (!plugin) return false;
  let running = false, pending = false;
  const drain = async () => {
    pending = true;
    if (running) return;
    running = true;
    try {
      do {
        pending = false;
        const result = await plugin.consumeExportResult();
        if (['saved','cancelled','failed'].includes(result?.status)) onResult(result.status);
      } while (pending);
    } catch { /* A normal browser or older QA plugin has no restored result. */ }
    finally { running = false; }
  };
  target.addEventListener('tiny-legion-export-restored', drain);
  void drain();
  return true;
}
export function bindNativeBack(handler, target = window) {
  let plugin;
  try { plugin = androidPlugin(); } catch { return false; }
  if (!plugin) return false;
  target.addEventListener('tiny-legion-back', handler);
  void plugin.ready().catch(() => {});
  return true;
}
