import { uiTag } from './ui-components.js';
import { effectKeywords, effectInfo } from './effects.js';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
// The specialty heading already describes the same attribute target. Keep any
// different attribute set, family or attack-type restriction in detailed text.
function presentationKeywords(character) {
  const specialties = new Set(character?.specialties ?? []);
  return effectKeywords(character).map(info => {
    const target = info.values.attribute;
    const attributes = target === 'all' ? [] : Array.isArray(target) ? target : [target];
    return attributes.length && attributes.length === specialties.size && attributes.every(id => specialties.has(id))
      ? effectInfo({ ...info.values, attribute: 'all' })
      : info;
  });
}
export function effectMarkup(character, { detail = 'full' } = {}) {
  const keywords = presentationKeywords(character);
  if (!keywords.length) return '';
  if (detail === 'summary') return `<span class="effect-summary">${keywords.map(info => uiTag(info.label, { tone: "effect", keyword: info.keyword })).join(' ')}</span>`;
  return `<dl class="effect-keywords">${keywords.map(info => `<div data-effect-keyword="${escape(info.keyword)}"><dt>${uiTag(info.label, { tone: "effect" })}</dt>${info.details ? `<dd>${escape(info.details)}</dd>` : ''}</div>`).join('')}</dl>`;
}
