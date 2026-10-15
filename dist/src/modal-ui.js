import { portrait } from "./art.js";

// Each modal kind owns its presentation; callers only override for mixed flows.
const layouts = {
  onboarding: "message",
  "battle-update": "message",
  "account-choice": "message",
  "guest-choice": "message",
  "defense-guide": "message",
  "growth-guide": "notice",
  refund: "message",
  "reset-account": "message",
  import: "message",
  settings: "panel",
  "test-login": "message",
  admin: "message",
  income: "notice",
  mailbox: "panel",
  "return-income": "notice",
  "leave-battle": "notice",
  "gem-guide": "message",
  gems: "collection",
  "gem-detail": "panel",
  "gem-upgrade": "panel",
  "gem-picker": "collection",
  "gem-reroll": "message",
  daily: "panel",
  probability: "panel",
  sequence: "panel",
  stages: "panel",
  growth: "collection",
  companion: "collection",
  recruit: "collection",
  codex: "collection",
  "sequence-pick": "collection",
  menu: "drawer",
};

export function modalLayout(kind) {
  return layouts[kind] ?? "panel";
}

// Content and actions are trusted UI markup, never account/imported text.
export function messagePanel({ text, companion, actions }) {
  return `<div class="modal-message">${companion ? `<div class="modal-message-art">${portrait(companion)}</div>` : ""}<p>${text}</p><div class="modal-message-actions">${actions}</div></div>`;
}
