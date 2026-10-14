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
export function bindNativeBack(handler, target = window) {
  let plugin;
  try { plugin = androidPlugin(); } catch { return false; }
  if (!plugin) return false;
  target.addEventListener('tiny-legion-back', handler);
  void plugin.ready().catch(() => {});
  return true;
}
