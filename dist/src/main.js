import {
  UNITS,
  ENEMIES,
  STAGES,
  ATTRIBUTES,
  ROLE_SPECIALIZATION,
  BALANCE_VERSION,
  RARITIES,
} from "./data.js";
import { createBattle, fireCannon, stepBattle, summonUnit } from "./engine.js";
import { icon, portrait } from "./art.js";
import { Renderer } from "./renderer.js";
import {
  recruitPanel,
  probabilityPanel,
  revealRecruit,
  rarityBadge,
  rarityOf,
} from "./recruitment-ui.js";
import { battlefieldLayout } from "./combat-visuals.js";
import { onboardingEncounter } from "./onboarding.js";
import {
  GEMS,
  resetAccount,
  loadAccount,
  saveAccount,
  normalizeAccount,
  accrue,
  levelCost,
  growUnit,
  enhanceUnit,
  refundLevels,
  battleLevels,
  gemModifiers,
  combatPower,
  recordIdle,
  completeChallenge,
  recordSpeedrun,
  claimSpeedrun,
  speedrunReward,
  recruitUnits,
  ownsUnit,
  recruitGem,
  isOnboarding,
  advanceOnboardingBattle,
  recruitOnboardingCompanion,
  finishOnboarding,
} from "./account.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString("ko-KR");
const clock = (n) =>
  `${String(Math.floor(Math.max(0, n) / 60)).padStart(2, "0")}:${String(Math.floor(Math.max(0, n) % 60)).padStart(2, "0")}`;
const precise = (n) =>
  `${Math.floor(n / 60)}:${(n % 60).toFixed(1).padStart(4, "0")}`;
const unitById = Object.fromEntries(UNITS.map((u) => [u.id, u]));
const names = Object.fromEntries(UNITS.map((u) => [u.id, u.name]));
Object.assign(names, {
  sheep: "양 방패",
  rabbit: "목검 토끼",
  squirrel: "다람쥐",
  teapot: "주전자",
  cloud: "구름",
});
const roles = {
  tank: "방어",
  fast: "돌격",
  ranged: "원거리",
  splash: "광역",
  support: "지원",
  melee: "근접",
  heavy: "돌파",
  warrior: "전사",
};
const attributeById = Object.fromEntries(
  (ATTRIBUTES ?? []).map((attribute) => [attribute.id, attribute]),
);
const percent = (value) => `${Math.round(value * 100)}%`;
function attributeName(id) {
  const attribute = attributeById[id];
  return attribute ? `${attribute.symbol} ${attribute.name}` : "미분류";
}
function unitSpecialtyText(unit) {
  const specialties = Array.isArray(unit.specialties) ? unit.specialties : [];
  if (!specialties.length) return "범용 · 모든 속성에 동일한 기본 성능";
  const bonuses = ROLE_SPECIALIZATION?.[unit.role] ?? {};
  const effects = [];
  if (Number.isFinite(bonuses.attack))
    effects.push(`공격력 +${percent(bonuses.attack)}`);
  if (Number.isFinite(bonuses.effectiveHp))
    effects.push(
      `유효 체력 +${percent(bonuses.effectiveHp)} (표시 체력은 그대로)`,
    );
  if (Number.isFinite(bonuses.duration))
    effects.push(`방해 지속시간 +${percent(bonuses.duration)}`);
  const attributes = specialties.map(attributeName).join(" · ");
  return `${attributes} 특화${effects.length ? ` · ${effects.join(" · ")}` : ""} · 다른 속성 페널티 없음`;
}
function unitAbilityLines(unit) {
  const lines = [];
  if (Number.isFinite(unit.shieldDamageBonus) && unit.shieldDamageBonus > 0)
    lines.push(
      `방어막 추가 피해 +${percent(unit.shieldDamageBonus)} (방어막에만 적용)`,
    );
  if (unit.slow && typeof unit.slow === "object")
    lines.push(`둔화 · ${unit.slow.factor}배 · ${unit.slow.duration}초`);
  if (unit.suppressRegen && typeof unit.suppressRegen === "object")
    lines.push(
      `회복 억제 · ${unit.suppressRegen.factor}배 · ${unit.suppressRegen.duration}초`,
    );
  if (unit.shieldAura && typeof unit.shieldAura === "object")
    lines.push(
      `방어막 오라 · 방어막 피해 +${percent(unit.shieldAura.bonus)} (방어막에만 적용) · 범위 ${unit.shieldAura.range}`,
    );
  return lines;
}
function enemyGimmicks(enemy, group = {}) {
  const shield =
    group.shield === false ? null : (group.shield ?? enemy?.shield);
  const regeneration =
    group.regeneration === false
      ? null
      : (group.regeneration ?? enemy?.regeneration);
  const lines = [];
  if (shield && Number.isFinite(shield.hpRatio))
    lines.push(`방어막 · 최대 체력의 ${percent(shield.hpRatio)}`);
  if (
    regeneration &&
    Number.isFinite(regeneration.hpRatio) &&
    Number.isFinite(regeneration.interval)
  )
    lines.push(
      `재생 ${percent(regeneration.hpRatio)} / ${regeneration.interval}초`,
    );
  return { shield, regeneration, lines };
}
function getStageComposition(stage) {
  const totals = new Map(
    (ATTRIBUTES ?? []).map((attribute) => [attribute.id, 0]),
  );
  let unclassified = 0;
  let totalCount = 0;
  for (const wave of stage.waves ?? []) {
    for (const group of wave.enemies ?? []) {
      const enemy = ENEMIES.find((item) => item.id === group.id);
      const count = Number.isFinite(group.count) ? Math.max(0, group.count) : 1;
      if (!count) continue;
      const attributeId = group.attribute ?? enemy?.attribute;
      if (attributeById[attributeId])
        totals.set(attributeId, (totals.get(attributeId) ?? 0) + count);
      else unclassified += count;
      totalCount += count;
    }
  }
  return {
    totalCount,
    attributes: (ATTRIBUTES ?? []).map((attribute) => ({
      ...attribute,
      count: totals.get(attribute.id) ?? 0,
    })),
    unclassified,
  };
}
function stageIntelMarkup(stage) {
  const composition = getStageComposition(stage);
  const attributeSummary = composition.attributes
    .map(({ id, name, symbol, count }) => {
      const share = composition.totalCount
        ? ` ${((count / composition.totalCount) * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`
        : "";
      return `${symbol} ${name}${share}`;
    })
    .concat(
      composition.unclassified
        ? [
            `미분류 ${((composition.unclassified / composition.totalCount) * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`,
          ]
        : [],
    )
    .join("　·　");
  const phases = [
    { label: "초반 · 0–40초" },
    { label: "중반 · 40–80초" },
    { label: "후반 · 80–120초" },
  ];
  const phaseGroups = phases.map(() => []);
  for (const wave of stage.waves ?? []) {
    const time = Number.isFinite(wave.time) ? wave.time : 0;
    const phaseIndex = time < 40 ? 0 : time < 80 ? 1 : 2;
    phaseGroups[phaseIndex].push(...(wave.enemies ?? []));
  }
  const phaseMarkup = phaseGroups
    .map((phase, phaseIndex) => {
      const summary = new Map();
      for (const group of phase) {
        const enemy = ENEMIES.find((item) => item.id === group.id);
        if (!enemy) continue;
        const count = Number.isFinite(group.count)
          ? Math.max(0, group.count)
          : 1;
        const attribute = group.attribute ?? enemy.attribute;
        const gimmicks = enemyGimmicks(enemy, group).lines;
        const key = `${enemy.id}|${attribute}|${gimmicks.join("|")}`;
        const current = summary.get(key) ?? {
          name: enemy.name,
          attribute,
          count: 0,
          gimmicks,
        };
        current.count += count;
        summary.set(key, current);
      }
      const details = [...summary.values()]
        .map(
          ({ name, attribute, count, gimmicks }) =>
            `${name} · ${attributeName(attribute)} ×${count}${gimmicks.length ? ` (${gimmicks.join(" · ")})` : ""}`,
        )
        .join("　·　");
      return `<p class="settings-note"><strong>${phases[phaseIndex].label}</strong><br>${details || "적 없음"}</p>`;
    })
    .join("");
  return `<h3 class="collection-heading">${stage.name} · 적 구성</h3><p class="settings-note"><strong>속성 비율</strong><br>${attributeSummary || "확인할 적 데이터가 없습니다."}<br><small>적 무리의 수를 기준으로 계산</small></p>${phaseMarkup}`;
}
let { account, error: loadError } = loadAccount();
let sequenceDraft = null;
let recruitCleanup = null;
let recruitReceipt = null;
let codexRarity = "all",
  codexOwned = "all";
const earned = accrue(account);
let mode = isOnboarding(account) ? "challenge" : "idle",
  stageId = onboardingEncounter(account.onboarding?.phase)?.id ?? account.idleStage,
  battle = null,
  battleSnapshot = null,
  paused = false,
  waiting = false,
  resultHandled = false,
  skillRemaining = 0,
  modalKind = null,
  modalRender = null,
  lastFocused = null,
  restartAt = 0;
let toastTimer,
  tooltipTimer,
  longPressTimer,
  audioContext = null,
  lastFrame = performance.now(),
  accumulator = 0,
  lastUi = 0,
  lastAccrual = Date.now(),
  lastSound = 0;
let storageWarning = false;
function persist() {
  if (!saveAccount(account) && !storageWarning) {
    storageWarning = true;
    toast(
      "저장 공간을 사용할 수 없습니다. 설정에서 저장 파일을 내려받아 주세요.",
    );
  }
}
function hydrateIcons(root = document) {
  root
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
}
function toast(text) {
  clearTimeout(toastTimer);
  $("toast").textContent = text;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => ($("toast").hidden = true), 3300);
}
function chirp(type = "tap") {
  if (!account.settings.sound) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const o = audioContext.createOscillator(),
      gain = audioContext.createGain(),
      t = audioContext.currentTime;
    o.type = "sine";
    o.frequency.setValueAtTime(
      type === "win" ? 660 : type === "summon" ? 360 : 440,
      t,
    );
    o.frequency.exponentialRampToValueAtTime(
      type === "win" ? 880 : 250,
      t + 0.09,
    );
    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(gain);
    gain.connect(audioContext.destination);
    o.start(t);
    o.stop(t + 0.15);
  } catch {}
}
function createHand() {
  const hand = handUnits()
    .map((id, index) => {
      const unit = unitById[id];
      if (!unit) return `<button class="unit-card empty-slot" data-index="${index}" disabled aria-label="${index + 1}번 빈 슬롯"><span class="unit-card-number">${index + 1}</span></button>`;
      const tip = [
        unit.description,
        unitSpecialtyText(unit),
        ...unitAbilityLines(unit),
      ]
        .filter(Boolean)
        .join(" · ");
      return `<button class="unit-card" data-unit="${id}" data-index="${index}" aria-label="${unit.name} 소환" data-tip="${unit.name} · ${tip}"><span class="unit-card-number">${index + 1}</span>${portrait(id)}<span class="unit-card-text"><span class="unit-card-name">${names[id]}</span><span class="unit-cost">${icon("coin")}${unit.cost}</span></span><span class="unit-cooldown" hidden></span><span class="unit-cooldown-text"></span></button>`;
    })
    .join("");
  $("unit-hand").innerHTML = hand;
  $("unit-hand")
    .querySelectorAll("[data-unit]")
    .forEach((btn) => (btn.onclick = () => manualSummon(btn.dataset.unit)));
}
function handUnits() {
  const sequence = isOnboarding(account)
    ? [...new Set(account.sequence.filter(Boolean))]
    : account.sequence;
  return [...sequence, ...Array(10).fill(null)].slice(0, 10);
}
function currentStage() {
  return onboardingEncounter(account.onboarding?.phase) ?? STAGES[stageId - 1] ?? STAGES[0];
}
function startBattle() {
  if (isOnboarding(account) && !onboardingEncounter(account.onboarding.phase)) {
    resumeOnboarding();
    return;
  }
  if (isOnboarding(account)) {
    mode = "challenge";
    stageId = currentStage().id;
  }
  const levels = battleLevels(account);
  battle = createBattle({
    mode,
    stageId,
    levels,
    sequence: account.sequence,
    modifiers: gemModifiers(account),
    ownedUnits: UNITS.filter((u) => ownsUnit(account, u.id)).map((u) => u.id),
    onboardingPhase: isOnboarding(account) ? account.onboarding.phase : null,
  });
  battleSnapshot = {
    stageId,
    balanceVersion: BALANCE_VERSION,
    levels: { ...levels },
    sequence: [...account.sequence],
    gem: account.equippedGem,
    dailyKey: account.daily.key,
  };
  paused = false;
  waiting = false;
  resultHandled = false;
  skillRemaining = 0;
  restartAt = 0;
  accumulator = 0;
  $("battle-ready").hidden = true;
  $("battle-result").hidden = true;
  $("battle-result").innerHTML = "";
  updateUi();
}
function readyBattle() {
  battle = null;
  waiting = true;
  paused = false;
  restartAt = 0;
  $("battle-result").hidden = true;
  $("battle-ready").hidden = false;
  $("ready-stage").textContent = mode === "speedrun" ? "일일" : `1-${stageId}`;
  $("ready-title").textContent = STAGES[stageId - 1].name;
  updateUi();
}
function setMode(next) {
  if (isOnboarding(account)) return;
  if (next === "speedrun" && account.highestCleared < 3) {
    toast("1-3을 완료하면 열립니다.");
    return;
  }
  mode = next;
  stageId =
    mode === "speedrun"
      ? 1
      : mode === "idle"
        ? account.idleStage
        : Math.min(10, account.highestCleared + 1);
  if (mode === "idle") startBattle();
  else readyBattle();
  chirp();
}
function renderBattleMenu() {
  const modes = [
    {
      id: "idle",
      name: "방치",
      glyph: "leaf",
      description: "120초 동안 성을 지켜 생산 기록을 남깁니다.",
    },
    {
      id: "challenge",
      name: "도전",
      glyph: "swords",
      description: "동료를 소환해 적 성을 파괴합니다.",
    },
    {
      id: "speedrun",
      name: "속공",
      glyph: "bolt",
      description: "가장 빠른 기록에 도전합니다.",
    },
  ];
  $("modal-content").innerHTML = `<div class="battle-menu-grid">${modes
    .map((item) => {
      const locked = item.id === "speedrun" && account.highestCleared < 3;
      return `<button class="battle-menu-tile ${item.id === mode ? "selected" : ""} ${locked ? "locked" : ""}" data-mode="${item.id}" aria-pressed="${item.id === mode}" data-tip="${locked ? "1-3을 완료하면 열립니다." : item.description}"><span class="battle-menu-art">${icon(item.glyph)}</span><strong>${item.name}</strong>${locked ? `<span class="battle-menu-mark">${icon("lock")}</span>` : item.id === mode ? `<span class="battle-menu-mark">${icon("check")}</span>` : ""}</button>`;
    })
    .join("")}</div>`;
  $("modal-content")
    .querySelectorAll("[data-mode]")
    .forEach((button) => {
      button.onclick = () => {
        if (button.dataset.mode === "speedrun" && account.highestCleared < 3) {
          toast("1-3을 완료하면 열립니다.");
          return;
        }
        closeModal();
        if (button.dataset.mode !== mode) setMode(button.dataset.mode);
      };
    });
}
function openBattleMenu() {
  openModal("전투", "battle-menu", renderBattleMenu);
}
function manualSummon(id) {
  if (!unitById[id]) return;
  if ($("tooltip").dataset.longpress === "true") {
    hideTooltip();
    return;
  }
  if (mode === "idle") {
    return;
  }
  if (waiting) startBattle();
  if (paused || !battle || battle.finished || !$("modal-backdrop").hidden) return;
  const eventCount = battle.events.length;
  if (summonUnit(battle, id)) {
    renderer.consumeEvents(battle.events.slice(eventCount), battle);
    chirp("summon");
    updateUi();
  } else if (battle.gold < unitById[id].cost) {
    toast("전투 골드가 부족합니다.");
  }
}
function setPaused() {
  if (!battle || battle.finished) return;
  paused = !paused;
  updateUi();
}
function finishBattle() {
  if (resultHandled || !battle?.result) return;
  resultHandled = true;
  const r = battle.result;
  if (isOnboarding(account)) {
    finishOnboardingBattle(r);
    return;
  }
  chirp("win");
  if (mode === "idle") {
    const improved = recordIdle(account, r, battleSnapshot);
    persist();
    if (improved)
      toast(
        `1-${stageId} 기록 · ${Math.round(r.hpRatio * 100)}% · ${fmt(account.records[stageId].gold * 30)} / 시간`,
      );
    restartAt = performance.now() + 3000;
    updateUi();
    return;
  }
  let rewards = { gold: 0, diamonds: 0 };
  if (mode === "challenge" && r.won) {
    const wasLocked = account.highestCleared < 3;
    rewards = completeChallenge(account, stageId);
    if (wasLocked && account.highestCleared >= 3)
      setTimeout(() => toast("보석과 속공이 열렸습니다."), 900);
  }
  if (mode === "speedrun" && r.won) {
    accrue(account);
    if (battleSnapshot.dailyKey === account.daily.key)
      recordSpeedrun(account, r.time);
    else toast("새로운 하루가 시작됐습니다. 다시 도전해 주세요.");
  }
  persist();
  showResult(r, rewards);
  updateUi();
}
function onboardingMessage(title, text, label, action, companion = "sheep") {
  openModal(title, "onboarding", () => {
    $("modal-content").innerHTML = `<div class="onboarding-message">${portrait(companion)}<p>${text}</p><button class="primary-button" id="onboarding-next">${label}</button></div>`;
    $("onboarding-next").onclick = action;
  });
  $("onboarding-next").focus();
}
function enterOnboardingBattle() {
  closeModal(true);
  createHand();
  startBattle();
}
function showOnboardingDraw() {
  onboardingMessage("동료 모집", "양 방패가 앞을 지키는 동안 공격해 줄 동료를 만나 보세요.", "무료 1회", () => {
    const result = recruitOnboardingCompanion(account);
    if (!result) {
      resumeOnboarding();
      return;
    }
    // Persist the grant before revealing; reloading cannot draw it again.
    persist();
    createHand();
    updateUi();
    recruitCleanup = revealRecruit($("modal-content"), [result], {
      done: showOnboardingRetry,
      inspect: () => {},
      sound: () => chirp("win"),
    });
    $("draw-again").hidden = true;
    $("draw-done").textContent = "함께 출정";
    $("draw-skip").focus();
  }, "squirrel");
}
function showOnboardingRetry() {
  recruitCleanup?.();
  recruitCleanup = null;
  onboardingMessage("다시 출정", "양 방패를 먼저 소환하고, 골드를 모아 씨앗 다람쥐를 소환하세요. 방패 뒤에서 적을 공격합니다.", "1-1 출정", enterOnboardingBattle, "squirrel");
}
function showIdleGuide() {
  onboardingMessage("방치", "1-1을 돌파했어요! 이제 동료가 자동으로 소환되어 120초 동안 성을 지킵니다.<br>전투가 끝나면 생산 기록이 생겨요. 그 기록으로 게임을 꺼도 골드와 다이아가 쌓입니다.", "방치 시작", () => {
    if (!finishOnboarding(account)) return;
    persist();
    closeModal(true);
    mode = "idle";
    stageId = 1;
    createHand();
    startBattle();
  }, "squirrel");
}
function resumeOnboarding() {
  if (!isOnboarding(account)) return;
  mode = "challenge";
  stageId = onboardingEncounter(account.onboarding.phase)?.id ?? 1;
  battle = null;
  restartAt = 0;
  createHand();
  switch (account.onboarding.phase) {
    case "intro":
    case "first-battle":
      startBattle();
      break;
    case "recruit":
      showOnboardingDraw();
      break;
    case "retry-battle":
      showOnboardingRetry();
      break;
    case "idle-guide":
      showIdleGuide();
      break;
  }
  updateUi();
}
function finishOnboardingBattle(result) {
  const phase = account.onboarding.phase;
  advanceOnboardingBattle(account, result.won);
  persist();
  if (phase === "intro" && result.won) {
    onboardingMessage("첫 승리", "적 성을 무너뜨렸어요. 이번에는 적이 지키고 있는 숲길로 가 볼까요?", "1-1 출정", enterOnboardingBattle);
  } else if (phase === "first-battle" && !result.won) {
    onboardingMessage("동료가 필요해요", "양 방패는 잘 버티지만 공격이 부족해요. 뒤에서 공격할 동료를 모집해 보세요.", "동료 모집", showOnboardingDraw);
  } else if (phase === "retry-battle" && result.won) {
    showIdleGuide();
  } else {
    onboardingMessage("다시 한 번", phase === "intro" ? "아래 양 방패 카드를 눌러 소환하세요. 시간이 지나면 전투 골드가 모입니다." : "양 방패와 씨앗 다람쥐를 함께 소환해 보세요. 다람쥐를 위한 골드도 모아 주세요.", "다시 출정", enterOnboardingBattle);
  }
  updateUi();
}
function showResult(r, rewards) {
  const daily = mode === "speedrun",
    rewardMarkup =
      daily && r.won
        ? `<span>${icon("gem")}${speedrunReward(account)}</span>`
        : r.won && rewards.gold
          ? `<span>${icon("coin")}+${fmt(rewards.gold)}</span><span>${icon("gem")}+${rewards.diamonds}</span>`
          : "";
  $("battle-result").innerHTML =
    `<div class="result-card">${icon(r.won ? "trophy" : "shield")}<h2>${r.won ? "완료" : "다시 한 번"}</h2><div class="result-time">${precise(r.time)}</div>${rewardMarkup ? `<div class="result-rewards">${rewardMarkup}</div>` : ""}<div class="result-actions"><button class="secondary-button" id="retry-battle">${daily && account.daily.claimed ? "연습하기" : "다시 도전"}</button>${daily && r.won && !account.daily.claimed ? '<button class="primary-button" id="claim-speedrun">보상받기</button>' : !daily && r.won && stageId < 10 ? '<button class="primary-button" id="next-battle">다음</button>' : ""}</div>${daily && account.daily.claimed ? '<div class="new-record">오늘 보상 수령 완료</div>' : ""}</div>`;
  $("battle-result").hidden = false;
  $("retry-battle").onclick = startBattle;
  if ($("next-battle"))
    $("next-battle").onclick = () => {
      stageId = Math.min(10, stageId + 1);
      startBattle();
    };
  if ($("claim-speedrun"))
    $("claim-speedrun").onclick = () => {
      const reward = claimSpeedrun(account);
      if (reward) {
        persist();
        toast(`보석 조각 +${reward}`);
      }
      showResult(r, rewards);
      updateUi();
    };
}
function updateUi() {
  $("gold").textContent = fmt(account.gold);
  $("diamonds").textContent = fmt(account.diamonds);
  $("combat-power").textContent = fmt(combatPower(account));
  const record = account.records[account.idleStage];
  $("income-rate").innerHTML =
    `${fmt((record?.gold || 0) * 30)}<span class="muted"> / 시간</span>`;
  $("stage-number").textContent = mode === "speedrun" ? "일일" : stageId === 0 ? "0" : `1-${stageId}`;
  $("stage-name").textContent = "초원";
  $("current-mode").textContent = {
    idle: "방치",
    challenge: "도전",
    speedrun: "속공",
  }[mode];
  $("current-mode-icon").innerHTML = icon(
    { idle: "leaf", challenge: "swords", speedrun: "bolt" }[mode],
  );
  $("battle-time").textContent = battle
    ? clock(mode === "speedrun" ? battle.time : battle.duration - battle.time)
    : mode === "speedrun"
      ? "00:00"
      : "02:00";
  $("pause").innerHTML = icon(paused ? "play" : "pause");
  $("pause").setAttribute("aria-label", paused ? "계속하기" : "일시 정지");
  $("pause").disabled = !battle || battle.finished;
  const layout = battlefieldLayout(renderer.width, renderer.height);
  const enemyMax =
    battle?.enemyMaxHp ??
    Math.round(currentStage().enemyHp * (mode === "speedrun" ? 0.65 : 1));
  for (const [team, x, max, current] of [
    [
      "player",
      layout.playerX,
      battle?.playerMaxHp ?? 1000,
      battle?.playerHp ?? 1000,
    ],
    ["enemy", layout.enemyX, enemyMax, battle?.enemyHp ?? enemyMax],
  ]) {
    const hp = Math.max(0, Math.min(max, current));
    const health = $(`${team}-castle-health`);
    health.style.left = `${x}px`;
    health.style.top = `${layout.healthY}px`;
    $(`${team}-health`).style.width = `${(hp / max) * 100}%`;
    $(`${team}-health-text`).textContent = `${fmt(hp)} / ${fmt(max)}`;
  }
  $("wave-progress").hidden = mode !== "idle";
  $("wave-progress").textContent =
    `${Math.min(3, Math.floor((battle?.time || 0) / 40) + 1)} / 3`;
  $("battle-gold").textContent = fmt(battle?.gold ?? 220);
  $("wallet-fill").style.width = `${(battle?.gold ?? 220) / 10}%`;
  let note = waiting
    ? "동료를 눌러 소환하세요"
    : paused
      ? "일시 정지"
      : mode === "idle"
        ? "자동 소환 중"
        : mode === "speedrun"
          ? account.daily.claimed
            ? "연습 중"
            : "최단 시간에 도전"
          : "적 성을 향해";
  if (mode === "idle" && battle?.waitingReason === "gold") {
    const next = unitById[battle.sequence[battle.sequenceIndex]];
    note = `${names[next.id]} · ${Math.ceil(Math.max(0, next.cost - battle.gold) / 35)}초`;
  }
  if (mode === "idle" && battle?.finished) note = "기록 저장";
  if (isOnboarding(account) && !battle?.finished) {
    const phase = account.onboarding.phase;
    if (phase === "intro") note = battle?.units.some((u) => u.team === "player") ? "적 성을 무너뜨리세요" : "양 방패 카드를 눌러 소환하세요";
    else if (phase === "first-battle") note = "양 방패로 적 성에 도전하세요";
    else if (phase === "retry-battle") note = battle?.units.some((u) => u.id === "sheep" && u.team === "player" && !u.dead) ? "골드를 모아 다람쥐도 소환하세요" : "양 방패를 먼저 소환하세요";
  }
  $("field-note-text").textContent = note;
  $("unit-hand")
    .querySelectorAll(".unit-card")
    .forEach((btn, index) => {
      const u = unitById[btn.dataset.unit];
      if (!u) return;
      const cd = battle?.cooldowns[u.id] || 0;
      btn.classList.toggle(
        "current",
        mode === "idle" && !battle?.finished && battle?.sequenceIndex === index,
      );
      btn.classList.toggle("unaffordable", (battle?.gold ?? 220) < u.cost);
      const overlay = btn.querySelector(".unit-cooldown");
      overlay.hidden = cd <= 0.01;
      overlay.style.transform = `scaleY(${Math.max(0, Math.min(1, cd / u.cooldown))})`;
      btn.querySelector(".unit-cooldown-text").textContent =
        cd > 0.01 ? `${cd.toFixed(1)}` : "";
    });
  $("skill").disabled =
    isOnboarding(account) || mode === "idle" ||
    !battle ||
    battle.finished ||
    paused ||
    skillRemaining > 0;
  $("skill-cooldown").textContent =
    skillRemaining > 0 ? Math.ceil(skillRemaining) : "";
  $("edit-sequence").style.visibility = "visible";
  for (const id of ["stage-select", "mode-select", "profile-button", "edit-sequence", "nav-battle", "nav-units", "nav-recruit", "income"]) {
    $(id).disabled = isOnboarding(account);
  }
  $("speed-text").textContent = `${account.settings.speed}×`;
  $("sound").innerHTML = icon(account.settings.sound ? "sound" : "sound-off");
  $("sound").setAttribute("aria-pressed", String(account.settings.sound));
  $("sound").setAttribute(
    "aria-label",
    account.settings.sound ? "소리 끄기" : "소리 켜기",
  );
  $("upgrade-dot").hidden = !UNITS.some(
    (u) =>
      ownsUnit(account, u.id) &&
      account.levels[u.id] < 100 &&
      account.gold >= levelCost(account.levels[u.id]),
  );
}
function openModal(title, kind, render) {
  if (isOnboarding(account) && !["onboarding", "settings", "import", "codex", "reset-account"].includes(kind)) return;
  if (modalKind === "onboarding" && kind !== "onboarding") return;
  recruitCleanup?.();
  recruitCleanup = null;
  hideTooltip();
  lastFocused = document.activeElement;
  modalKind = kind;
  modalRender = render;
  $("modal-title").textContent = title;
  $("modal-backdrop").hidden = false;
  $("close-modal").hidden = kind === "onboarding";
  render();
  if (kind !== "onboarding") $("close-modal").focus();
}
function closeModal(force = false) {
  if (modalKind === "onboarding" && force !== true) return;
  if ($("modal-backdrop").hidden) return;
  $("modal-backdrop").hidden = true;
  recruitCleanup?.();
  recruitCleanup = null;
  modalKind = null;
  $("close-modal").hidden = false;
  modalRender = null;
  lastFocused?.focus?.();
  hideTooltip();
}
function renderStages() {
  const unlocked = Math.min(10, account.highestCleared + 1);
  $("modal-content").innerHTML =
    `<div class="stage-grid">${STAGES.map((s) => `<div style="position:relative"><button class="stage-tile ${s.id === stageId ? "selected" : ""}" data-stage="${s.id}" ${s.id > unlocked ? "disabled" : ""} style="width:100%"><strong>1-${s.id}</strong><span class="stage-tile-name">${s.name}</span>${icon(s.id > unlocked ? "lock" : s.id <= account.highestCleared ? "check" : "flag")}${account.records[s.id] ? `<span class="stage-rate">${icon("coin")}${fmt(account.records[s.id].gold * 30)} / 시간</span>` : ""}</button><button class="stage-info-button" data-stage-info="${s.id}" aria-label="${s.name} 전장 정보" title="${s.name} 전장 정보" style="position:absolute;left:5px;bottom:5px;padding:2px 4px;border:0;background:transparent;color:#7b9463;line-height:0">${icon("book")}</button></div>`).join("")}</div>`;
  $("modal-content")
    .querySelectorAll("[data-stage]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          stageId = Number(b.dataset.stage);
          if (mode === "idle") {
            accrue(account);
            account.idleStage = stageId;
            persist();
            startBattle();
          } else readyBattle();
          closeModal();
        }),
    );
  $("modal-content")
    .querySelectorAll("[data-stage-info]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          const stage = STAGES.find(
            (item) => item.id === Number(button.dataset.stageInfo),
          );
          if (!stage) return;
          $("modal-content").innerHTML =
            `${stageIntelMarkup(stage)}<div class="modal-footer"><button class="secondary-button" id="stage-intel-back">스테이지 목록</button></div>`;
          $("stage-intel-back").onclick = renderStages;
        }),
    );
}
function renderGrowth() {
  $("modal-content").innerHTML = `<div class="unit-grid">${UNITS.filter((u) =>
    ownsUnit(account, u.id),
  )
    .map((u) => {
      const level = account.levels[u.id],
        scale = 1 + (level + account.special[u.id] - 1) * 0.12;
      return `<article class="growth-card">${rarityBadge(u)}${portrait(u.id)}<span class="level-label">Lv. ${level}${account.special[u.id] ? ` · +${account.special[u.id]}` : ""}</span><h3>${u.name}</h3><div class="stats"><span>${icon("heart")}${Math.round(u.hp * scale)}</span><span>${icon("swords")}${Math.round(u.attack * scale)}</span></div><button class="primary-button" data-grow="${u.id}" ${account.gold < levelCost(level) || level >= 100 ? "disabled" : ""}>${icon(level >= 100 ? "check" : "coin")}${level >= 100 ? "완료" : fmt(levelCost(level)) + " ↑"}</button><button class="inspect-button" data-inspect="${u.id}">자세히</button>${account.fragments[u.id] > 0 ? `<button class="secondary-button fragment-button" data-enhance="${u.id}" ${account.fragments[u.id] < 3 || account.special[u.id] >= 20 ? "disabled" : ""} style="font-size:10px;margin-top:9px;padding:5px 7px">조각 ${account.fragments[u.id]} / 3</button>` : ""}</article>`;
    })
    .join(
      "",
    )}</div><div class="modal-footer"><span class="resource-inline">${icon("coin")}${fmt(account.gold)}</span><button class="secondary-button" id="refund-levels">${icon("reset")}초기화</button></div>`;
  $("modal-content")
    .querySelectorAll("[data-grow]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          accrue(account);
          if (growUnit(account, b.dataset.grow)) {
            persist();
            renderGrowth();
            updateUi();
            chirp();
          }
        }),
    );
  $("modal-content")
    .querySelectorAll("[data-enhance]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (enhanceUnit(account, b.dataset.enhance)) {
            persist();
            renderGrowth();
            updateUi();
            chirp();
          }
        }),
    );
  $("modal-content")
    .querySelectorAll("[data-inspect]")
    .forEach((b) => (b.onclick = () => openCodex(b.dataset.inspect)));
  $("refund-levels").onclick = () =>
    openModal("초기화", "refund", () => {
      $("modal-content").innerHTML =
        '<p class="settings-note">사용한 레벨업 골드를 모두 돌려받습니다.<br>동료의 레벨은 1이 되고, 방치 기록은 다시 측정해야 합니다.<br>모집 조각과 강화는 유지됩니다.</p><div class="modal-footer"><button class="secondary-button" id="cancel-refund">돌아가기</button><button class="primary-button" id="confirm-refund">초기화</button></div>';
      $("cancel-refund").onclick = () =>
        openModal("동료", "growth", renderGrowth);
      $("confirm-refund").onclick = () => {
        const gold = refundLevels(account);
        persist();
        if (mode === "idle") startBattle();
        else readyBattle();
        toast(`${fmt(gold)} 골드를 돌려받았습니다.`);
        openModal("동료", "growth", renderGrowth);
        updateUi();
      };
    });
}
function renderSequence() {
  sequenceDraft ??= [...account.sequence];
  $("modal-content").innerHTML =
    `<div class="sequence-list">${sequenceDraft.map((id, i) => `<article class="sequence-slot"><span class="slot-index">${i + 1}</span>${id ? portrait(id) : '<div class="empty-sequence-art"></div>'}<strong>${names[id] || "빈 슬롯"}</strong><div class="sequence-arrows"><button data-move="${i}" data-direction="-1" aria-label="${names[id] || "빈 슬롯"} 앞으로" ${i === 0 ? "disabled" : ""}>${icon("up")}</button><button data-move="${i}" data-direction="1" aria-label="${names[id] || "빈 슬롯"} 뒤로" ${i === sequenceDraft.length - 1 ? "disabled" : ""}>${icon("down")}</button></div><button class="inspect-button secondary-button" data-replace="${i}" style="font-size:10px;padding:5px 8px;margin-top:7px">교체</button></article>`).join("")}</div><p class="sequence-hint">골드가 모이면 차례대로 소환합니다. 쿨타임 중인 동료는 건너뜁니다.</p><div class="modal-footer"><span class="hint">같은 동료를 여러 번 넣을 수 있습니다.</span><button class="primary-button" id="apply-sequence">적용</button></div>`;
  $("modal-content")
    .querySelectorAll("[data-move]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const i = Number(b.dataset.move),
            j = i + Number(b.dataset.direction);
          [sequenceDraft[i], sequenceDraft[j]] = [
            sequenceDraft[j],
            sequenceDraft[i],
          ];
          renderSequence();
        }),
    );
  $("modal-content")
    .querySelectorAll("[data-replace]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const i = Number(b.dataset.replace);
          openModal("동료 선택", "sequence-pick", () => {
            $("modal-content").innerHTML =
              `<div class="collection-grid">${UNITS.filter((u) =>
                ownsUnit(account, u.id),
              )
                .map(
                  (u) =>
                    `<button class="collection-card" data-pick="${u.id}">${rarityBadge(u)}${portrait(u.id)}<strong>${u.name}</strong><span>${u.cost}</span></button>`,
                )
                .join("")}</div><div class="modal-footer"><button class="secondary-button" id="clear-sequence-slot">비우기</button></div>`;
            $("clear-sequence-slot").onclick = () => {
              sequenceDraft[i] = null;
              openModal("순서", "sequence", renderSequence);
            };
            $("modal-content")
              .querySelectorAll("[data-pick]")
              .forEach(
                (p) =>
                  (p.onclick = () => {
                    sequenceDraft[i] = p.dataset.pick;
                    openModal("순서", "sequence", renderSequence);
                  }),
              );
          });
        }),
    );
  $("apply-sequence").onclick = () => {
    if (!sequenceDraft.every((id) => id === null || ownsUnit(account, id))) return;
    if (!sequenceDraft.some((id) => ownsUnit(account, id))) {
      toast("동료를 한 명 이상 넣어 주세요.");
      return;
    }
    account.sequence = [...sequenceDraft];
    persist();
    createHand();
    startBattle();
    closeModal();
    toast("소환 순서를 적용했습니다.");
  };
}
function openCodex(id = null, enemy = false) {
  if (id) {
    openModal("도감", "codex", () => renderCodexDetail(id, enemy));
    return;
  }
  openModal("도감", "codex", renderCollection);
}
function renderCollection() {
  const owned = UNITS.filter((u) => ownsUnit(account, u.id)).length;
  const units = UNITS.filter(
    (u) =>
      (codexRarity === "all" || u.rarity === codexRarity) &&
      (codexOwned === "all" || ownsUnit(account, u.id)),
  );
  $("modal-content").innerHTML =
    `<div class="collection-toolbar"><strong>동료 <span>${owned} / ${UNITS.length}</span></strong><label>등급 <select id="codex-rarity"><option value="all">전체</option>${RARITIES.map((r) => `<option value="${r.id}" ${codexRarity === r.id ? "selected" : ""}>${r.name}</option>`).join("")}</select></label><button class="secondary-button" id="owned-filter" aria-pressed="${codexOwned === "owned"}">${codexOwned === "owned" ? "보유" : "전체 보기"}</button></div><div class="companion-collection">${units.map((u) => `<button class="companion-tile ${ownsUnit(account, u.id) ? "" : "unowned"}" style="--rarity:${rarityOf(u).color}" data-codex="${u.id}" aria-label="${u.name} ${ownsUnit(account, u.id) ? "보유" : "미보유"}">${rarityBadge(u)}${portrait(u.id)}<strong>${u.name}</strong><small>${ownsUnit(account, u.id) ? `Lv. ${account.levels[u.id]}` : "미보유"}</small></button>`).join("") || '<p class="empty-note">해당 동료가 없습니다.</p>'}</div><h3 class="collection-heading">적</h3><div class="collection-grid">${ENEMIES.map((u) => `<button class="collection-card" data-codex="${u.id}" data-enemy="true">${portrait(u.id)}<strong>${u.name}</strong><span>${attributeName(u.attribute)}</span></button>`).join("")}</div>`;
  $("codex-rarity").onchange = (e) => {
    codexRarity = e.target.value;
    renderCollection();
  };
  $("owned-filter").onclick = () => {
    codexOwned = codexOwned === "all" ? "owned" : "all";
    renderCollection();
  };
  $("modal-content")
    .querySelectorAll("[data-codex]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          openCodex(b.dataset.codex, b.dataset.enemy === "true")),
    );
}
function enemyCounterText(enemy) {
  const counters = [];
  if (enemy.attribute) {
    const specialists = UNITS.filter(
      (unit) =>
        Array.isArray(unit.specialties) &&
        unit.specialties.includes(enemy.attribute),
    );
    const attackers = specialists
      .filter((unit) =>
        Number.isFinite(ROLE_SPECIALIZATION?.[unit.role]?.attack),
      )
      .map(
        (unit) =>
          `${unit.name} +${percent(ROLE_SPECIALIZATION[unit.role].attack)} 공격`,
      );
    const defenders = specialists
      .filter((unit) =>
        Number.isFinite(ROLE_SPECIALIZATION?.[unit.role]?.effectiveHp),
      )
      .map(
        (unit) =>
          `${unit.name} +${percent(ROLE_SPECIALIZATION[unit.role].effectiveHp)} 유효 체력`,
      );
    const supporters = specialists
      .filter((unit) =>
        Number.isFinite(ROLE_SPECIALIZATION?.[unit.role]?.duration),
      )
      .map(
        (unit) =>
          `${unit.name} +${percent(ROLE_SPECIALIZATION[unit.role].duration)} 지속시간`,
      );
    counters.push(
      `속성 대응 · ${[...attackers, ...defenders, ...supporters].join(" · ") || "속성 특화 동료 없음"}`,
    );
  }
  if (enemy.shield && enemy.shield !== false) {
    const shieldUnits = UNITS.flatMap((unit) => {
      const options = [];
      if (Number.isFinite(unit.shieldDamageBonus) && unit.shieldDamageBonus > 0)
        options.push(
          `${unit.name} +${percent(unit.shieldDamageBonus)} 방어막 피해`,
        );
      if (
        unit.shieldAura &&
        Number.isFinite(unit.shieldAura.bonus) &&
        unit.shieldAura.bonus > 0
      )
        options.push(
          `${unit.name} 방어막 피해 오라 +${percent(unit.shieldAura.bonus)} (범위 ${unit.shieldAura.range})`,
        );
      return options;
    });
    counters.push(
      `방어막 대응 · ${shieldUnits.length ? shieldUnits.join(" · ") : "방어막 피해 증가 동료 없음"}`,
    );
  }
  if (enemy.regeneration && enemy.regeneration !== false) {
    const suppressionUnits = UNITS.filter(
      (unit) => unit.suppressRegen && typeof unit.suppressRegen === "object",
    );
    counters.push(
      `회복 대응 · ${suppressionUnits.length ? suppressionUnits.map((unit) => unit.name).join(" · ") : "회복 억제 동료 없음"}`,
    );
  }
  return counters;
}
function renderCodexDetail(id, enemy) {
  const u = (enemy ? ENEMIES : UNITS).find((u) => u.id === id),
    level = enemy ? 1 : account.levels[id] + account.special[id],
    scale = 1 + (level - 1) * 0.12,
    gimmicks = enemyGimmicks(u),
    detailLines = enemy
      ? [
          u.attribute ? `속성 · ${attributeName(u.attribute)}` : "",
          ...gimmicks.lines,
          ...enemyCounterText(u),
        ].filter(Boolean)
      : [unitSpecialtyText(u), ...unitAbilityLines(u)];
  $("modal-content").innerHTML =
    `<div class="codex-layout"><div class="codex-art ${!enemy && !ownsUnit(account, id) ? "unowned" : ""}">${portrait(id)}</div><div class="codex-info">${enemy ? "" : rarityBadge(u)}<h3>${u.name}</h3>${!enemy ? `<span class="collection-state">${ownsUnit(account, id) ? `보유 · Lv. ${account.levels[id]}` : "미보유 · 모집에서 획득"} · ${u.theme || "숲"}</span>` : ""}<span class="role-label">${roles[u.role]}</span><p>${u.description || "전투 특성을 살펴보세요."}</p>${detailLines.length ? `<p class="settings-note"><strong>${enemy ? "속성과 대응" : "속성 특성"}</strong><br>${detailLines.join("<br>")}</p>` : ""}<div class="stat-list">${[
      ["체력", Math.round(u.hp * scale)],
      ["공격력", Math.round(u.attack * scale)],
      ["사거리", u.range],
      ["이동속도", u.speed],
      ["공격 간격", `${u.attackInterval}초`],
      ...(enemy
        ? []
        : [
            ["소환 골드", u.cost],
            ["쿨타임", `${u.cooldown}초`],
          ]),
    ]
      .map(
        ([label, value]) =>
          `<div class="stat-item">${label}<strong>${value}</strong></div>`,
      )
      .join(
        "",
      )}</div></div></div><div class="codex-picker">${(enemy ? ENEMIES : UNITS).map((u) => `<button class="${u.id === id ? "selected" : ""}" data-detail="${u.id}" aria-label="${u.name}">${portrait(u.id)}</button>`).join("")}<button id="codex-back" aria-label="도감 목록">${icon("book")}</button></div>`;
  $("modal-content")
    .querySelectorAll("[data-detail]")
    .forEach(
      (b) => (b.onclick = () => renderCodexDetail(b.dataset.detail, enemy)),
    );
  $("codex-back").onclick = () => openCodex();
}
function renderRecruit(tab = "units") {
  recruitCleanup?.();
  recruitCleanup = null;
  if (tab === "units" && recruitReceipt) {
    showRecruitResult();
    return;
  }
  const unlocked = account.highestCleared >= 3;
  $("modal-content").innerHTML =
    `<div class="modal-subnav"><button class="${tab === "units" ? "selected" : ""}" id="recruit-units">동료</button><button class="${tab === "gems" ? "selected" : ""}" id="recruit-gems" ${unlocked ? "" : 'data-tip="1-3을 완료하면 열립니다."'}>${unlocked ? "" : icon("lock")}보석</button></div>${tab === "units" ? recruitPanel(account) : `<div class="gem-grid">${GEMS.map((g) => `<button class="gem-card ${account.equippedGem === g.id ? "equipped" : ""}" data-equip="${g.id}" ${account.gems[g.id] ? "" : "disabled"} data-tip="${g.description}"><span class="gem-art" style="color:${g.color}">${icon("gem")}</span><strong>${g.name}</strong><span>${account.gems[g.id] || "미보유"}</span>${account.equippedGem === g.id ? "<small>장착 중</small>" : ""}</button>`).join("")}</div><div class="gem-draw-actions"><button class="primary-button" id="draw-gem-tickets" ${account.tickets < 5 ? "disabled" : ""}>${icon("gem")}조각 5 · 모집</button><button class="secondary-button" id="draw-gem-diamonds" ${account.diamonds < 30 ? "disabled" : ""}>${icon("gem")}30 · 모집</button></div>`}<div class="modal-footer"><span class="resource-inline">${icon("gem")}${fmt(account.diamonds)}</span>${unlocked ? `<span class="hint">보석 조각 ${fmt(account.tickets)}</span>` : ""}<button class="secondary-button" id="draw-info">확률</button></div>`;
  $("recruit-units").onclick = () => renderRecruit("units");
  $("recruit-gems").onclick = () =>
    unlocked ? renderRecruit("gems") : toast("1-3을 완료하면 열립니다.");
  $("modal-content")
    .querySelectorAll("[data-draw-count]")
    .forEach(
      (b) => (b.onclick = () => drawCompanions(Number(b.dataset.drawCount))),
    );
  if ($("welcome-draw"))
    $("welcome-draw").onclick = () => drawCompanions(10, true);
  const gemDraw = (payment) => {
    const g = recruitGem(account, payment);
    if (!g) return;
    persist();
    updateUi();
    renderRecruit("gems");
    toast(`${g.name} 보석을 얻었습니다.`);
    chirp("win");
  };
  if ($("draw-gem-tickets"))
    $("draw-gem-tickets").onclick = () => gemDraw("tickets");
  if ($("draw-gem-diamonds"))
    $("draw-gem-diamonds").onclick = () => gemDraw("diamonds");
  $("modal-content")
    .querySelectorAll("[data-equip]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          account.equippedGem =
            account.equippedGem === b.dataset.equip ? null : b.dataset.equip;
          persist();
          renderRecruit("gems");
          toast("다음 전투부터 적용됩니다.");
        }),
    );
  $("draw-info").onclick = () =>
    openModal("확률", "probability", () => {
      $("modal-content").innerHTML =
        tab === "units"
          ? probabilityPanel(account)
          : `<div class="income-list">${GEMS.map((g) => `<div class="income-row"><strong>${g.name}</strong><span>33.33%</span></div>`).join("")}</div><div class="modal-footer"><button class="secondary-button" id="rates-back">돌아가기</button></div>`;
      $("rates-back").onclick = () =>
        openModal("모집", "recruit", () => renderRecruit(tab));
    });
}
function drawCompanions(count, free = false) {
  if (recruitReceipt) return;
  const results = recruitUnits(account, count, { free });
  if (!results) {
    toast("다이아가 부족합니다.");
    return;
  }
  persist();
  recruitReceipt = { results, count };
  updateUi();
  showRecruitResult();
}
function showRecruitResult() {
  recruitCleanup?.();
  const receipt = recruitReceipt;
  if (!receipt) {
    renderRecruit();
    return;
  }
  recruitCleanup = revealRecruit($("modal-content"), receipt.results, {
    done: () => {
      recruitCleanup?.();
      recruitCleanup = null;
      recruitReceipt = null;
      renderRecruit();
    },
    again: () => {
      recruitCleanup?.();
      recruitCleanup = null;
      recruitReceipt = null;
      drawCompanions(receipt.count);
      if (!recruitReceipt) renderRecruit();
    },
    inspect: (id) => openCodex(id),
    sound: () => chirp("win"),
  });
  $("draw-skip").focus();
}

function renderIncome() {
  const r = account.records[account.idleStage];
  $("modal-content").innerHTML =
    `<div class="income-summary"><div>${icon("coin")}<strong>${fmt((r?.gold || 0) * 30)}</strong><small>골드 / 시간</small></div><div>${icon("gem")}<strong>${((r?.diamonds || 0) * 30).toFixed(2)}</strong><small>다이아 / 시간</small></div></div>${
      Object.keys(account.records).length
        ? `<div class="income-list">${STAGES.filter(
            (s) => account.records[s.id],
          )
            .map(
              (s) =>
                `<button class="income-row ${s.id === account.idleStage ? "selected" : ""}" data-idle-stage="${s.id}" style="width:100%"><strong>1-${s.id} · ${s.name}</strong><span>${fmt(account.records[s.id].gold * 30)} / 시간 ${s.id === account.idleStage ? "✓" : ""}</span></button>`,
            )
            .join("")}</div>`
        : '<p class="empty-note">방치 전투가 끝나면 기록에 따라 재화가 쌓입니다.</p>'
    }<p class="settings-note">다른 전투를 하거나 게임을 닫아도 기록에 따라 쌓입니다.<br>게임을 닫은 동안에는 최대 8시간까지 쌓입니다.</p>`;
  $("modal-content")
    .querySelectorAll("[data-idle-stage]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          accrue(account);
          account.idleStage = Number(b.dataset.idleStage);
          persist();
          renderIncome();
          updateUi();
          if (mode === "idle") {
            stageId = account.idleStage;
            startBattle();
          }
        }),
    );
}
function renderDaily() {
  accrue(account);
  $("modal-content").innerHTML =
    `<div class="speedrun-summary"><span>오늘 최고 기록</span><strong>${account.daily.best === null ? "—" : precise(account.daily.best)}</strong></div><div class="speedrun-summary"><span>보석 조각</span><strong>${speedrunReward(account)}</strong></div>${account.daily.claimed ? '<p class="settings-note">오늘 보상을 받았습니다. 계속 연습할 수 있습니다.</p>' : '<p class="settings-note">원하는 기록이 나오면 보상을 받으세요.<br>보상은 하루에 한 번 받을 수 있습니다.</p>'}<div class="modal-footer"><button class="secondary-button" id="daily-play">${account.daily.claimed ? "연습하기" : "도전"}</button><button class="primary-button" id="daily-claim" ${account.daily.claimed || account.daily.best === null ? "disabled" : ""}>${account.daily.claimed ? "수령 완료" : "보상받기"}</button></div>`;
  $("daily-play").onclick = () => {
    closeModal();
    startBattle();
  };
  $("daily-claim").onclick = () => {
    const r = claimSpeedrun(account);
    if (r) {
      persist();
      toast(`보석 조각 +${r}`);
    }
    renderDaily();
    updateUi();
  };
}
function renderSettings() {
  $("modal-content").innerHTML =
    `<div class="settings-row"><span>소리</span><button class="secondary-button" id="setting-sound">${account.settings.sound ? "켜짐" : "꺼짐"}</button></div><div class="settings-row"><span>화면</span><button class="secondary-button" id="fullscreen">${icon("fullscreen")}전체 화면</button></div><div class="settings-row"><span>저장 파일</span><div><button class="secondary-button" id="export-save">내려받기</button> <button class="secondary-button" id="import-save">불러오기</button><input type="file" id="save-file" accept="application/json,.json" hidden></div></div><div class="settings-row"><span>계정</span><button class="secondary-button" id="reset-account">계정 초기화</button></div><p class="settings-note">진행도는 이 브라우저에 저장됩니다.<br>다른 기기로 옮기려면 저장 파일을 사용하세요.</p><p class="settings-note">키보드: 1–9·0 소환 · Space 일시 정지 · Esc 닫기</p>`;
  $("setting-sound").onclick = () => {
    account.settings.sound = !account.settings.sound;
    persist();
    updateUi();
    renderSettings();
    chirp();
  };
  $("fullscreen").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast("이 환경에서는 전체 화면을 사용할 수 없습니다.");
    }
  };
  $("export-save").onclick = () => {
    accrue(account);
    const blob = new Blob([JSON.stringify(account, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "tiny-legion-save.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    persist();
  };
  $("import-save").onclick = () => $("save-file").click();
  $("reset-account").onclick = () => {
    openModal("계정 초기화", "reset-account", () => {
      $("modal-content").innerHTML = '<p class="settings-note">동료·재화·성장·전투 기록을 모두 지우고 0스테이지부터 다시 시작합니다.<br>복구하려면 초기화 전에 저장 파일을 내려받아 두세요.</p><div class="modal-footer"><button class="secondary-button" id="cancel-reset-account">취소</button><button class="primary-button" id="confirm-reset-account">초기화하고 시작</button></div>';
      $("cancel-reset-account").onclick = () => openModal("설정", "settings", renderSettings);
      $("confirm-reset-account").onclick = () => {
        const fresh = resetAccount();
        if (!fresh) {
          toast("저장할 수 없어 초기화하지 않았습니다.");
          return;
        }
        closeModal(true);
        account = fresh;
        recruitReceipt = null;
        sequenceDraft = null;
        codexRarity = "all";
        codexOwned = "all";
        storageWarning = false;
        lastAccrual = Date.now();
        lastFrame = performance.now();
        resumeOnboarding();
        toast("계정을 초기화했습니다.");
      };
    });
    $("cancel-reset-account").focus();
  };
  $("save-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1000000) {
      toast("저장 파일을 확인해 주세요.");
      return;
    }
    try {
      const raw = JSON.parse(await file.text());
      if (raw.version !== 1 || !raw.levels || !Number.isFinite(raw.gold))
        throw Error("invalid");
      const imported = normalizeAccount(raw);
      openModal("불러오기", "import", () => {
        $("modal-content").innerHTML =
          '<p class="settings-note">현재 진행도가 저장 파일의 진행도로 바뀝니다.</p><div class="modal-footer"><button class="secondary-button" id="cancel-import">취소</button><button class="primary-button" id="confirm-import">불러오기</button></div>';
        $("cancel-import").onclick = () =>
          openModal("설정", "settings", renderSettings);
        $("confirm-import").onclick = () => {
          recruitReceipt = null;
          sequenceDraft = null;
          account = imported;
          accrue(account);
          persist();
          closeModal(true);
          if (isOnboarding(account)) resumeOnboarding();
          else {
            mode = "idle";
            stageId = account.idleStage;
            createHand();
            startBattle();
          }
          toast("저장 파일을 불러왔습니다.");
        };
      });
    } catch {
      toast("저장 파일을 확인해 주세요.");
    }
  };
}
function showTooltip(el, x, y, longpress = false) {
  const text = el.dataset.tip;
  if (!text) return;
  $("tooltip").textContent = text;
  $("tooltip").hidden = false;
  $("tooltip").dataset.longpress = String(longpress);
  const r = $("tooltip").getBoundingClientRect();
  $("tooltip").style.left =
    `${Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2))}px`;
  $("tooltip").style.top =
    `${Math.max(8, Math.min(innerHeight - r.height - 8, y - r.height - 12))}px`;
}
function hideTooltip() {
  clearTimeout(tooltipTimer);
  clearTimeout(longPressTimer);
  $("tooltip").hidden = true;
  $("tooltip").dataset.longpress = "false";
}
document.addEventListener("pointerover", (e) => {
  if (e.pointerType !== "mouse") return;
  const el = e.target.closest("[data-tip]");
  if (el)
    tooltipTimer = setTimeout(() => showTooltip(el, e.clientX, e.clientY), 400);
});
document.addEventListener("pointerout", (e) => {
  if (e.pointerType === "mouse") hideTooltip();
});
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  hideTooltip();
  const el = e.target.closest("[data-tip]");
  if (el)
    longPressTimer = setTimeout(
      () => showTooltip(el, e.clientX, e.clientY, true),
      500,
    );
});
document.addEventListener("pointerup", () => clearTimeout(longPressTimer));
document.addEventListener("pointercancel", hideTooltip);
document.addEventListener("scroll", hideTooltip, true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    hideTooltip();
    return;
  }
  if (!$("modal-backdrop").hidden) {
    if (e.key === "Tab") {
      const focusables = [
        ...$("modal").querySelectorAll(
          "button:not(:disabled),a[href],input:not([hidden])",
        ),
      ].filter((element) => element.getClientRects().length > 0);
      if (!focusables.length) return;
      const first = focusables[0],
        last = focusables.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    setPaused();
  }
  if (/^[0-9]$/.test(e.key) && !e.repeat)
    manualSummon(handUnits()[e.key === "0" ? 9 : Number(e.key) - 1]);
});
$("close-modal").onclick = () => closeModal();
$("modal-backdrop").onclick = (e) => {
  if (e.target === $("modal-backdrop")) closeModal();
};
$("stage-select").onclick = () =>
  mode === "speedrun"
    ? openModal("속공", "daily", renderDaily)
    : openModal("초원", "stages", renderStages);
$("mode-select").onclick = openBattleMenu;
$("profile-button").onclick = () => openModal("동료", "growth", renderGrowth);
$("start-battle").onclick = () => {
  startBattle();
  chirp();
};
$("pause").onclick = setPaused;
$("edit-sequence").onclick = () => {
  sequenceDraft = [...account.sequence];
  openModal("순서", "sequence", renderSequence);
};
$("nav-battle").onclick = openBattleMenu;
$("nav-units").onclick = () => openModal("동료", "growth", renderGrowth);
$("nav-recruit").onclick = () => openModal("모집", "recruit", renderRecruit);
$("nav-codex").onclick = () => openCodex();
$("settings").onclick = () => openModal("설정", "settings", renderSettings);
$("income").onclick = () => openModal("방치", "income", renderIncome);
$("speed").onclick = () => {
  account.settings.speed = account.settings.speed === 1 ? 2 : 1;
  persist();
  updateUi();
};
$("sound").onclick = () => {
  account.settings.sound = !account.settings.sound;
  persist();
  updateUi();
  chirp();
};
$("skill").onclick = () => {
  if (
    isOnboarding(account) || !battle ||
    battle.finished ||
    mode === "idle" ||
    paused ||
    skillRemaining > 0
  )
    return;
  const eventCount = battle.events.length;
  fireCannon(battle);
  renderer.consumeEvents(battle.events.slice(eventCount), battle);
  skillRemaining = 25;
  renderer.burst(700, battle.time);
  chirp("summon");
  updateUi();
};
document.addEventListener("visibilitychange", () => {
  accrue(account);
  persist();
  accumulator = 0;
  lastFrame = performance.now();
  updateUi();
});
window.addEventListener("pagehide", () => {
  accrue(account);
  persist();
});
const renderer = new Renderer($("battle-canvas"));
hydrateIcons();
$("brand-icon").innerHTML = portrait("sheep");
createHand();
if (isOnboarding(account)) resumeOnboarding();
else startBattle();
persist();
if (loadError)
  setTimeout(
    () =>
      toast("저장 파일을 읽지 못했습니다. 설정에서 파일을 불러올 수 있습니다."),
    900,
  );
else if (earned.seconds > 60 && earned.gold >= 1)
  setTimeout(
    () =>
      toast(
        `골드 +${fmt(earned.gold)} · 다이아 +${earned.diamonds.toFixed(2)}`,
      ),
    900,
  );
function frame(now) {
  const dt = Math.min(0.12, (now - lastFrame) / 1000);
  lastFrame = now;
  const portraitMode = matchMedia(
    "(orientation: portrait) and (max-width: 900px)",
  ).matches;
  const modalPauses = !$("modal-backdrop").hidden && mode !== "idle";
  const shouldAdvance =
    !document.hidden &&
    !portraitMode &&
    !paused &&
    !modalPauses &&
    battle &&
    !battle.finished;
  if (shouldAdvance) {
    accumulator += dt * account.settings.speed;
    let steps = 0;
    while (accumulator >= 1 / 30 && steps < 8 && !battle.finished) {
      stepBattle(battle, 1 / 30);
      renderer.consumeEvents(battle.events, battle);
      skillRemaining = Math.max(0, skillRemaining - 1 / 30);
      accumulator -= 1 / 30;
      steps++;
    }
    if (battle.finished) finishBattle();
  }
  if (
    mode === "idle" &&
    restartAt &&
    now >= restartAt &&
    !paused &&
    !document.hidden &&
    !portraitMode
  )
    startBattle();
  if (Date.now() - lastAccrual >= 1000) {
    accrue(account);
    persist();
    lastAccrual = Date.now();
  }
  if (now - lastUi > 80) {
    updateUi();
    lastUi = now;
  }
  renderer.render(battle, now / 1000, !shouldAdvance);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
