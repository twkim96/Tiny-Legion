// Native app state and document visibility can arrive independently or twice.
export function bindGameVisibility(onChange, doc = document, target = window) {
  let nativeActive = true;
  let visible = !doc.hidden;
  const update = () => {
    const next = nativeActive && !doc.hidden;
    if (next === visible) return;
    visible = next;
    onChange(visible);
  };
  doc.addEventListener('visibilitychange', update);
  target.addEventListener('tiny-legion-app-state', event => {
    if (typeof event.detail?.isActive !== 'boolean') return;
    nativeActive = event.detail.isActive;
    update();
  });
  return () => !visible;
}
