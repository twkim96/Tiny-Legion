import { getUnit, stageLabel } from './characters.js';
import { portrait } from './art.js';
import { mailboxEntries } from './account.js';

export function mailboxPanel(account) {
  const entries = mailboxEntries(account);
  if (!entries.length) return '<p class="settings-note">도착한 우편이 없습니다.</p>';
  return `<div class="mail-list">${entries.map(entry => {
    const unit = getUnit(entry.unitId);
    const stageId = Number(entry.id.match(/challenge-(\d+)/)?.[1]);
    return `<article class="mail-item">${portrait(unit.id)}<div><strong>${unit.name}</strong><p>${stageLabel(stageId)} 미션 보상</p>${account.owned[unit.id] && !entry.claimed ? '<small>이미 보유한 동료는 징표로 받습니다.</small>' : ''}</div><button class="${entry.claimed ? 'secondary' : 'primary'}-button" data-mail-claim="${entry.id}" ${entry.claimed ? 'disabled' : ''}>${entry.claimed ? '수령 완료' : '받기'}</button></article>`;
  }).join('')}</div><p class="settings-note">받은 동료는 순서에서 편성할 수 있습니다.</p>`;
}
