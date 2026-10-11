// Move one slot between its neighbours; duplicates and empty slots stay intact.
export function moveSequenceItem(sequence, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= sequence.length || to >= sequence.length || from === to) return false;
  sequence.splice(to, 0, sequence.splice(from, 1)[0]);
  return true;
}
export function insertionIndex(rects, from, x, y) {
  const row = rects.reduce((best, rect) => Math.abs(y - (rect.top + rect.bottom) / 2) < Math.abs(y - (best.top + best.bottom) / 2) ? rect : best);
  const rowY = (row.top + row.bottom) / 2;
  const indices = rects.map((rect, index) => ({rect, index})).filter(({rect}) => Math.abs((rect.top + rect.bottom) / 2 - rowY) < 4);
  const next = indices.find(({rect}) => x < (rect.left + rect.right) / 2);
  const before = next?.index ?? indices.at(-1).index + 1;
  return {to: Math.max(0, Math.min(rects.length - 1, before > from ? before - 1 : before)), before};
}
export function bindSequenceDrag(container, onMove) {
  if (!container) return;
  const cards = [...container.querySelectorAll('[data-sequence-slot]')];
  let drag = null;
  const clear = () => {
    if (!drag) return;
    const active = drag;
    drag = null;
    active.card.classList.remove('dragging');
    active.card.style.removeProperty('transform');
    if (active.card.hasPointerCapture(active.id)) active.card.releasePointerCapture(active.id);
    cards.forEach(card => {card.classList.remove('insert-before', 'insert-after');});
  };
  container.addEventListener('pointerdown', event => {
    if (drag || event.button !== 0 || event.isPrimary === false || event.target.closest('button')) return;
    const card = event.target.closest('[data-sequence-slot]');
    if (!card) return;
    drag = {id:event.pointerId, card, from:Number(card.dataset.sequenceSlot), to:Number(card.dataset.sequenceSlot), x:event.clientX, y:event.clientY, moved:false, rects:cards.map(item=>item.getBoundingClientRect())};
    card.setPointerCapture(event.pointerId);
  });
  container.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    event.preventDefault();
    drag.moved = true;
    drag.card.classList.add('dragging');
    drag.card.style.transform = `translate(${dx}px, ${dy}px)`;
    const {to, before} = insertionIndex(drag.rects, drag.from, event.clientX, event.clientY);
    drag.to = to;
    cards.forEach(card => {card.classList.remove('insert-before', 'insert-after');});
    if (to !== drag.from) (cards[before] ?? cards.at(-1)).classList.add(before < cards.length ? 'insert-before' : 'insert-after');
  });
  container.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const {from, to, moved} = drag;
    const bounds = container.getBoundingClientRect();
    clear();
    if (moved && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom && from !== to) onMove(from, to);
  });
  container.addEventListener('pointercancel', clear);
  container.addEventListener('lostpointercapture', clear);
  container.addEventListener('keydown', event => {
    if (event.target.closest('button')) return;
    const card = event.target.closest('[data-sequence-slot]');
    const delta = {ArrowLeft:-1, ArrowRight:1, ArrowUp:-5, ArrowDown:5}[event.key];
    if (!card || !delta) return;
    const from = Number(card.dataset.sequenceSlot), to = from + delta;
    if (to < 0 || to >= cards.length) return;
    event.preventDefault();
    onMove(from, to);
    container.ownerDocument.querySelector(`[data-sequence-slot="${to}"]`)?.focus();
  });
}
