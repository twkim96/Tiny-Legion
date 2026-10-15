import { modalLayout } from './modal-ui.js';

// Navigation and DOM state live here; callers own game permissions and content.
export class ModalController {
  constructor({ getElement, document, canOpen = () => true, cleanup = () => {}, hideTooltip = () => {} }) {
    this.$ = getElement;
    this.document = document;
    this.canOpen = canOpen;
    this.cleanup = cleanup;
    this.hideTooltip = hideTooltip;
    this.history = [];
    this.lastFocused = null;
  }

  get kind() { return this.history.at(-1)?.kind ?? null; }

  rememberPosition() {
    const frame = this.history.at(-1);
    if (!frame) return;
    frame.scroll = ['modal-content', 'companion-summary', 'companion-abilities']
      .map(id => [id, this.$(id)?.scrollTop ?? 0]);
    frame.focusId = this.document.activeElement?.id;
  }

  display(frame) {
    this.cleanup();
    this.hideTooltip();
    this.$('modal-backdrop').dataset.kind = frame.kind;
    this.$('modal-backdrop').dataset.layout = frame.layout;
    this.$('modal-title').textContent = frame.title;
    this.$('modal-backdrop').hidden = false;
    this.$('close-modal').hidden = frame.kind === 'onboarding';
    this.$('back-modal').hidden = frame.kind === 'onboarding' || this.history.length < 2;
    frame.render();
    // Rendering may navigate to a required guide or another modal.
    if (this.history.at(-1) !== frame) return;
    for (const [id, top] of frame.scroll ?? []) if (this.$(id)) this.$(id).scrollTop = top;
    if (frame.kind !== 'onboarding') {
      const focus = frame.focusId && this.$(frame.focusId);
      (focus && !focus.disabled ? focus : this.$('back-modal').hidden ? this.$('close-modal') : this.$('back-modal')).focus();
    }
  }

  open(title, kind, render, { layout = modalLayout(kind), navigation = 'push' } = {}) {
    if (!this.canOpen(kind)) return;
    const root = this.$('modal-backdrop').hidden || navigation === 'root';
    if (root) {
      if (this.$('modal-backdrop').hidden) this.lastFocused = this.document.activeElement;
      this.history.length = 0;
    } else this.rememberPosition();
    if (kind === 'onboarding') this.history.length = 0;
    else if (!root && navigation === 'replace') this.history.pop();
    const frame = { title, kind, render, layout };
    this.history.push(frame);
    this.display(frame);
  }

  back() {
    if (this.kind === 'onboarding' || this.history.length < 2) return false;
    this.history.pop();
    this.display(this.history.at(-1));
    return true;
  }

  returnTo(title, kind, render) {
    const index = this.history.slice(0, -1).findLastIndex(frame =>
      frame.kind === kind && (frame.render === render || !['codex', 'gems'].includes(kind)));
    if (index >= 0) {
      this.history.length = index + 1;
      this.display(this.history[index]);
    } else this.open(title, kind, render, { navigation: 'root' });
  }

  close(force = false) {
    if (this.kind === 'onboarding' && force !== true) return;
    if (this.$('modal-backdrop').hidden) return;
    this.$('modal-backdrop').hidden = true;
    this.cleanup();
    this.history.length = 0;
    this.$('close-modal').hidden = false;
    this.$('back-modal').hidden = true;
    this.lastFocused?.focus?.();
    this.hideTooltip();
  }

  trapFocus(event) {
    if (event.key !== 'Tab') return;
    const focusables = [...this.$('modal').querySelectorAll(
      'button:not(:disabled),a[href],input:not([hidden]),select:not(:disabled),[tabindex="0"]',
    )].filter(element => element.getClientRects().length > 0);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables.at(-1);
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  bindControls() {
    this.$('back-modal').onclick = () => this.back();
    this.$('close-modal').onclick = () => this.close();
    this.$('modal-backdrop').onclick = event => {
      if (event.target === this.$('modal-backdrop')) this.close();
    };
  }
}
