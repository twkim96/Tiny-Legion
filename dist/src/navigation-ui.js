import { icon } from './art.js';
import { isOnboarding, sequenceUnlocked, advancedContentUnlocked, currentMission, mailboxEntries } from './account.js';

export const MODES = Object.freeze({
  idle: Object.freeze({ label: '방치', glyph: 'leaf' }),
  challenge: Object.freeze({ label: '도전', glyph: 'swords' }),
  speedrun: Object.freeze({ label: '속공', glyph: 'bolt' }),
});

// One definition feeds toolbar buttons, drawer items and their destinations.
export const NAVIGATION = Object.freeze([
  { screen: 'mission', title: '미션', glyph: 'flag', drawer: true },
  { screen: 'mailbox', title: '우편함', glyph: 'envelope', drawer: true },
  { screen: 'growth', title: '동료', glyph: 'units', drawer: true, toolbar: 'nav-units', tone: 'units', badge: 'upgrade-dot' },
  { screen: 'recruit', title: '모집', glyph: 'envelope', drawer: true, toolbar: 'nav-recruit', tone: 'recruit' },
  { screen: 'sequence', title: '순서', label: '소환 순서', glyph: 'sequence', drawer: true, toolbar: 'edit-sequence', tone: 'sequence', combat: true },
  { screen: 'codex', title: '도감', glyph: 'book', drawer: true, toolbar: 'nav-codex', tone: 'codex' },
  { screen: 'leave', title: '나가기', label: '전투 나가기', glyph: 'close', toolbar: 'leave-battle', tone: 'leave', combat: true, combatOnly: true },
  { screen: 'pause', title: '정지', label: '일시 정지', glyph: 'pause', toolbar: 'pause', tone: 'pause', combat: true, combatOnly: true, pressed: true },
  { screen: 'speed', title: '1×', label: '전투 속도', glyph: 'forward', toolbar: 'speed', tone: 'speed', combat: true, combatOnly: true, pressed: true },
  { screen: 'income', title: '방치', glyph: 'leaf', drawer: true },
  { screen: 'daily', title: '속공', glyph: 'bolt', drawer: true },
  { screen: 'gems', title: '보석', glyph: 'gem', drawer: true },
  { screen: 'settings', title: '설정', glyph: 'settings', drawer: true, combat: true, drawerCombat: true },
  { screen: 'menu', title: '메뉴', glyph: 'menu', toolbar: 'menu', tone: 'settings', combat: true },
  { screen: 'admin', title: '관리자 기능', glyph: 'settings', drawer: true, combat: true, drawerCombat: true },
].map(Object.freeze));

export function gameUiState({ account, mode, battle, isAdmin = false }) {
  const tutorial = isOnboarding(account);
  const manualCombat = mode !== 'idle' && !!battle && !battle.finished;
  return { mode, tutorial, manualCombat, isAdmin, advanced: advancedContentUnlocked(account),
    sequenceEnabled: sequenceUnlocked(account), hasMission: !!currentMission(account),
    unreadMail: mailboxEntries(account).some(entry => !entry.claimed),
    profileVisible: true, incomeVisible: !manualCombat,
    toolbar: Object.fromEntries(NAVIGATION.filter(item => item.toolbar).map(item =>
      [item.toolbar, item.combatOnly ? manualCombat : !manualCombat || !!item.combat])),
  };
}

export function screenAccess(screen, ui) {
  if (screen === 'admin') return { enabled: ui.isAdmin, hidden: !ui.isAdmin };
  if (screen === 'settings' || screen === 'menu' || screen === 'codex') return { enabled: true };
  if (screen === 'sequence') return { enabled: ui.sequenceEnabled, lock: '1-2' };
  if (screen === 'daily' || screen === 'gems') return { enabled: !ui.tutorial && ui.advanced, lock: '2-2' };
  if (screen === 'mission') return { enabled: !ui.tutorial && ui.hasMission };
  return { enabled: !ui.tutorial };
}

export function toolbarMarkup() {
  return NAVIGATION.filter(item => item.toolbar).map(item => {
    const label = item.label ?? item.title;
    const iconId = item.screen === 'pause' ? ' id="pause-icon"' : '';
    const textId = ['pause', 'speed'].includes(item.screen) ? ` id="${item.screen}-text"` : '';
    return `<button class="game-menu menu-${item.tone}" id="${item.toolbar}" data-ui-screen="${item.screen}" aria-label="${label}" data-tip="${label}"${item.combatOnly ? ' hidden' : ''}${item.pressed ? ' aria-pressed="false"' : ' aria-haspopup="dialog"'}><span class="menu-medallion"${iconId}>${icon(item.glyph)}</span><span class="menu-label"${textId}>${item.title}</span>${item.badge ? `<span class="nav-badge" id="${item.badge}" hidden></span>` : ''}</button>`;
  }).join('');
}

export function contentMenuMarkup(ui) {
  return `<div class="content-menu-grid">${NAVIGATION.filter(item => item.drawer && (!ui.manualCombat || item.drawerCombat)).map(item => {
    const access = screenAccess(item.screen, ui);
    if (access.hidden) return '';
    const title = item.title + (item.screen === 'mailbox' && ui.unreadMail ? ' · 새 우편' : '');
    return `<button class="content-menu-item" data-content-menu="${item.screen}" ${access.enabled ? '' : 'disabled'} aria-label="${title}${access.enabled ? '' : ' 잠김'}"><span>${icon(item.glyph)}</span><strong>${title}</strong>${!access.enabled ? `<small>${icon('lock')}${ui.tutorial ? '' : access.lock ?? ''}</small>` : ''}</button>`;
  }).join('')}</div>`;
}

const EXTRA_TITLES = Object.freeze({ stages: '스테이지', 'test-login': '테스트 로그인' });
export function screenTitle(kind) {
  const title = NAVIGATION.find(item => item.screen === kind)?.title ?? EXTRA_TITLES[kind];
  if (!title) throw new Error(`Unknown screen: ${kind}`);
  return title;
}
