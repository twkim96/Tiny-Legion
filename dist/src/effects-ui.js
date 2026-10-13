import { effectKeywords } from './effects.js';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
export function effectMarkup(character) {
  const keywords = effectKeywords(character);
  if (!keywords.length) return '';
  return `<dl class="effect-keywords">${keywords.map(info => `<div data-effect-keyword="${escape(info.keyword)}"><dt>${escape(info.label)}</dt>${info.details ? `<dd>${escape(info.details)}</dd>` : ''}</div>`).join('')}</dl>`;
}
