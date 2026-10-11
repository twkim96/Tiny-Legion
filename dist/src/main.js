import { enemyCombatStats } from "./character-stats.js";
import { UNITS, ENEMIES, ATTRIBUTES, NEUTRAL_ATTRIBUTE, ROLE_SPECIALIZATION, getEnemy } from "./characters.js";
import { effectLines } from "./effects.js";
import {
  STAGES,
  BALANCE_VERSION,
  RARITIES,
  stageLabel,
  bannerById,
} from "./data.js";
import { createBattle, fireCannon, stepBattle, summonUnit } from "./engine.js";
import { icon, portrait } from "./art.js";
import { modalLayout, messagePanel } from "./modal-ui.js";
import { drawGem, gemByUid, gemDefinition, gemUpgradeCost, gemTransferCost, gemUpgradeMaterials, upgradeGem, transferGem, equipGem, GEM_BANNERS, GEM_OPTIONS } from "./gems.js";
import { gemPage, gemDetail, gemCard } from "./gem-ui.js";
import { bindSequenceDrag, moveSequenceItem } from "./sequence-ui.js";
import { companionPanel } from "./companion-ui.js";
import { specializationBonus } from "./combat-rules.js";
import { Renderer } from "./renderer.js";
import {
  recruitPanel,
  probabilityPanel,
  revealRecruit,
  rarityBadge,
  rarityOf,
} from "./recruitment-ui.js";
import { battlefieldLayout } from "./combat-visuals.js";
import { onboardingEncounter, earlyGuideEncounter } from "./onboarding.js";
import { AccountClient, SessionReplacedError, bootstrapAccount } from "./account-client.js";
import {
  collectReturnIncome,
  advancedContentUnlocked,
  gemPresetForMode,
  canUseUnit,
  playableSequence,
  sequenceForMode,
  setSequence,
  resetAccount,
  loadAccount,
  saveAccount,
  normalizeAccount,
  accrue,
  levelCost,
  effectiveUnitLevel,
  baseLevelRoster,
  sharedLevel,
  growUnit,
  upgradeUnitAbility,
  companionStats,
  refundUnitLevels,
  unitLevelRefund,
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
  isOnboarding,
  advanceOnboardingBattle,
  recruitOnboardingCompanion,
  finishOnboarding,
  currentMission,
  recordMissionBattle,
  claimMission,
  growthUnlocked,
  sequenceUnlocked,
  recruitEarlyRabbit,
} from "./account.js";

const hostedMode = globalThis.TINY_LEGION_SERVER === true;
let cloudBootstrapEnvelope = null;
let cloudIdentity = null;
let cloudGateRoot = null;
let cloudGateState = null;
let cloudAppReady = false;
let hostedHalted = false;
let cloudPauseBeforeOffline = null;
const cloudGameHooks = { halt() {}, pause() {}, resume() {} };
const accountClient = hostedMode
  ? new AccountClient({ onState: (state) => showCloudGate(state) })
  : null;

function ensureCloudGate() {
  if (!hostedMode || cloudGateRoot) return cloudGateRoot;
  cloudGateRoot = document.createElement("section");
  cloudGateRoot.setAttribute("role", "alertdialog");
  cloudGateRoot.setAttribute("aria-live", "assertive");
  Object.assign(cloudGateRoot.style, {
    position: "fixed", inset: "0", zIndex: "10000", display: "none",
    placeItems: "center", padding: "20px", background: "#171a15eF",
    color: "#f4f1e7", font: "600 16px system-ui, sans-serif", textAlign: "center",
  });
  document.body.append(cloudGateRoot);
  return cloudGateRoot;
}

function showCloudGate(state = cloudGateState) {
  if (!hostedMode || !state) return;
  cloudGateState = state;
  const root = ensureCloudGate();
  const replaced = state.status === "replaced";
  const offline = state.status === "offline" || state.status === "connecting" || state.status === "retrying";
  const loginRequired = state.error?.payload?.error === "login_required";
  if (replaced && cloudAppReady) cloudGameHooks.halt();
  if (offline && cloudAppReady && cloudPauseBeforeOffline === null) {
    cloudGameHooks.pause();
  }
  if (!offline && !replaced && cloudAppReady && cloudPauseBeforeOffline !== null) {
    cloudGameHooks.resume();
  }
  if (!replaced && !offline) {
    root.hidden = true;
    root.style.display = "none";
    return;
  }
  root.hidden = false;
  root.style.display = "grid";
  const heading = replaced ? "다른 기기에서 접속했습니다" : loginRequired ? "ChatGPT 로그인이 필요합니다" : "서버에 연결할 수 없습니다";
  const useAccountChoice = state.error?.payload?.error === "account_exists";
  const action = replaced ? "여기서 계속하기" : loginRequired ? "ChatGPT로 로그인" : useAccountChoice ? "기존 계정으로" : "다시 연결";
  root.innerHTML = `<div style="max-width:320px"><strong style="display:block;margin-bottom:16px">${useAccountChoice ? "이미 연결된 계정이 있습니다" : heading}</strong><button id="cloud-gate-action" style="padding:10px 18px;border:0;border-radius:10px;background:#e8d89a;color:#26271f;font:inherit">${action}</button></div>`;
  root.querySelector("#cloud-gate-action").onclick = async () => {
    const button = root.querySelector("#cloud-gate-action");
    button.disabled = true;
    try {
      if (loginRequired) {
        location.assign("/signin-with-chatgpt?return_to=/");
        return;
      }
      if (useAccountChoice) {
        await accountClient.startNewSession("account");
        location.reload();
      } else if (replaced) {
        await accountClient.startNewSession();
        location.reload();
      } else if (state.operation === "command") {
        await accountClient.retry();
      } else {
        await accountClient.retry();
        location.reload();
      }
    } catch (error) {
      showCloudGate({ status: error instanceof SessionReplacedError ? "replaced" : "offline", operation: state.operation, error });
    }
  };
}

if (hostedMode) {
  ensureCloudGate();
  try {
    cloudBootstrapEnvelope = await accountClient.bootstrap();
    cloudIdentity = cloudBootstrapEnvelope.identity ?? { kind: "guest", canLink: true };
    cloudGateRoot.hidden = true;
  } catch (error) {
    showCloudGate({
      status: error instanceof SessionReplacedError ? "replaced" : "offline",
      operation: "resume",
      error,
    });
  }
}

if (!hostedMode || cloudBootstrapEnvelope) {

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
  rabbit: "속공 토끼",
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
function attributeName(id, suffix = "") {
  const attribute = attributeById[id] ?? NEUTRAL_ATTRIBUTE;
  return `<strong class="attribute-label" style="color:${attribute.ink ?? "#757b6a"}">${attribute.name}${suffix}</strong>`;
}
function unitSpecialtyText(unit, rich = false) {
  const specialties = Array.isArray(unit.specialties) ? unit.specialties : [];
  if (!specialties.length) return "범용 · 모든 속성에 동일한 기본 성능";
  const bonuses = ROLE_SPECIALIZATION?.[unit.role] ?? {};
  const effects = [];
  if (Number.isFinite(bonuses.attack))
    effects.push(`공격력 +${percent(specializationBonus(unit, { attribute: specialties[0] }, "attack"))}`);
  if (Number.isFinite(bonuses.effectiveHp))
    effects.push(
      `유효 체력 +${percent(specializationBonus(unit, { attribute: specialties[0] }, "effectiveHp"))} (표시 체력은 그대로)`,
    );
  if (Number.isFinite(bonuses.duration))
    effects.push(`방해 지속시간 +${percent(specializationBonus(unit, { attribute: specialties[0] }, "duration"))}`);
  const attributes = specialties.map((id) => rich ? attributeName(id, "특화") : `${attributeById[id]?.name ?? "무속성"}특화`).join(" · ");
  return `${attributes}${effects.length ? ` · ${effects.join(" · ")}` : ""} · 다른 속성 페널티 없음`;
}
function unitAbilityLines(unit) {
  return effectLines(unit);
}
function enemyGimmicks(enemy) {
  return {
    lines: [...(enemy?.boss ? ["거대 적"] : []), ...effectLines(enemy)],
  };
}
function getStageComposition(stage) {
  const totals = new Map(
    (ATTRIBUTES ?? []).map((attribute) => [attribute.id, 0]),
  );
  let unclassified = 0;
  let totalCount = 0;
  for (const wave of stage.waves ?? []) {
    for (const group of wave.enemies ?? []) {
      const enemy = enemyCombatStats(group.id, {}, group);
      const count = Number.isFinite(group.count) ? Math.max(0, group.count) : 1;
      if (!count) continue;
      const attributeId = enemy?.attribute;
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
      return `${attributeName(id)}${share}`;
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
    { label: "초반 · 0–30초" },
    { label: "중반 · 30–60초" },
    { label: "후반 · 60–90초" },
  ];
  const phaseGroups = phases.map(() => []);
  for (const wave of stage.waves ?? []) {
    const time = Number.isFinite(wave.time) ? wave.time : 0;
    const phaseIndex = time < 30 ? 0 : time < 60 ? 1 : 2;
    phaseGroups[phaseIndex].push(...(wave.enemies ?? []));
  }
  const phaseMarkup = phaseGroups
    .map((phase, phaseIndex) => {
      const summary = new Map();
      for (const group of phase) {
        const enemy = enemyCombatStats(group.id, {}, group);
        if (!enemy) continue;
        const count = Number.isFinite(group.count)
          ? Math.max(0, group.count)
          : 1;
        const attribute = enemy.attribute;
        const gimmicks = enemyGimmicks(enemy).lines;
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
let { account, error: loadError } = bootstrapAccount({
  hosted: hostedMode,
  envelope: cloudBootstrapEnvelope,
  loadLocal: loadAccount,
});
if (hostedMode) {
  accountClient.setAccountTarget(account);
  accountClient.identity = cloudIdentity;
}
let sequenceDraft = null;
let sequenceDraftMode = "idle";
let sequenceDrafts = null;
let sequenceDraftIndex = 0;
let sequenceDraftGem = 0;
let sequenceDraftChoices = null;
let gemViewPreset = 0;
const modalHistory = [];
let recruitCleanup = null;
let recruitReceipt = null;
let recruitBanner = "forest";
let codexRarity = "all",
  codexOwned = "all";
let pendingReturnIncome = hostedMode
  ? cloudBootstrapEnvelope.returnIncome
  : collectReturnIncome(account);
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
let idleResultStage = null;
let idleIncome = { gold: 0, diamonds: 0 };
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
  if (hostedMode) return true;
  if (!saveAccount(account) && !storageWarning) {
    storageWarning = true;
    toast(
      "저장 공간을 사용할 수 없습니다. 설정에서 저장 파일을 내려받아 주세요.",
    );
  }
}
async function sendCommand(type, args = {}) {
  try {
    return await accountClient.command(type, args);
  } catch (error) {
    if (error instanceof SessionReplacedError) return null;
    if (hostedMode && accountClient.status === "offline")
      showCloudGate({ status: "offline", operation: "command" });
    else toast(error?.message === "account_exists" ? "이미 연결된 계정이 있습니다." : "요청을 처리하지 못했습니다.");
    return null;
  }
}
async function updatePreference(patch) {
  if (!hostedMode) {
    Object.assign(account.settings, patch);
    persist();
    return true;
  }
  return !!(await sendCommand("settings", patch));
}
let lastServerSettle = hostedMode ? accountClient.now() : Date.now();
async function settleServer(force = false) {
  if (!hostedMode || accountClient.status !== "connected") return null;
  const now = accountClient.now();
  if (!force && now - lastServerSettle < 30000) return null;
  lastServerSettle = now;
  const envelope = await sendCommand("settle", {});
  if (mode === "idle" && envelope?.result) {
    idleIncome.gold += envelope.result.gold ?? 0;
    idleIncome.diamonds += envelope.result.diamonds ?? 0;
  }
  return envelope;
}
function haltHostedGameplay() {
  if (!hostedMode) return;
  hostedHalted = true;
  battleStartSerial++;
  battleStartPending = false;
  battle = null;
  waiting = true;
  paused = true;
  restartAt = 0;
  updateUi();
}
cloudGameHooks.halt = haltHostedGameplay;
cloudGameHooks.pause = () => {
  cloudPauseBeforeOffline = paused;
  paused = true;
  accumulator = 0;
  updateUi();
};
cloudGameHooks.resume = () => {
  paused = cloudPauseBeforeOffline;
  cloudPauseBeforeOffline = null;
  accumulator = 0;
  updateUi();
};
let battleStartSerial = 0;
let battleStartPending = false;
let manualBattleActions = [];
function logBattleAction(action, step = Math.round(battle.time * 30)) {
  manualBattleActions.push({ step, ...action });
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
      return `<button class="unit-card" data-unit="${id}" data-index="${index}" aria-label="${unit.name} 소환" data-tip="${unit.name} · ${tip}"><span class="unit-card-number">${index + 1}</span>${portrait(id)}<span class="unit-auto" aria-hidden="true">${icon("auto")}<b>자동</b></span><span class="unit-card-text"><span class="unit-card-name">${names[id]}</span><span class="unit-cost">${icon("coin")}${unit.cost}</span></span><span class="unit-cooldown" hidden></span><span class="unit-cooldown-text"></span></button>`;
    })
    .join("");
  $("unit-hand").innerHTML = hand;
  $("unit-hand")
    .querySelectorAll("[data-unit]")
    .forEach((btn) => (btn.onclick = () => manualSummon(btn.dataset.unit)));
}
function handUnits() {
  const sequence = mode !== "idle" && battle && !battle.finished && battleSnapshot?.sequence
    ? battleSnapshot.sequence
    : isOnboarding(account)
    ? [...new Set(account.sequence.filter(Boolean))]
    : playableSequence(account, mode);
  return [...sequence.map((id) => canUseUnit(account, id) ? id : null), ...Array(10).fill(null)].slice(0, 10);
}
function currentStage() {
  return onboardingEncounter(account.onboarding?.phase) ?? (stageId === 2 ? earlyGuideEncounter(account.earlyGuide?.phase, mode) : null) ?? STAGES[stageId - 1] ?? STAGES[0];
}
async function startBattle() {
  if (!isOnboarding(account) && mode === "challenge" && firstIdleMissionPending()) {
    toast("1-1 방치 미션을 완료하고 보상을 받아 주세요.");
    return;
  }
  if (!isOnboarding(account) && !growthUnlocked(account) && stageId > 2) {
    toast("1-2 방치 미션을 먼저 완료하세요.");
    return;
  }
  if (!isOnboarding(account) && mode === "challenge" && stageId === 2 && account.earlyGuide?.phase === "rabbit-recruit") {
    showEarlyDraw();
    return;
  }
  if (isOnboarding(account) && !onboardingEncounter(account.onboarding.phase)) {
    resumeOnboarding();
    return;
  }
  if (isOnboarding(account)) {
    mode = "challenge";
    stageId = currentStage().id;
  }
  if (hostedMode) {
    if (battleStartPending || accountClient.status !== "connected") return;
    battleStartPending = true;
    waiting = true;
    battle = null;
    const serial = ++battleStartSerial;
    updateUi();
    const envelope = await sendCommand("battle.start", { mode, stageId });
    if (!envelope || serial !== battleStartSerial) {
      battleStartPending = false;
      if (accountClient.status === "connected") readyBattle();
      return;
    }
    const started = envelope.result;
    if (!started?.battleId || !started.options || !started.snapshot) {
      battleStartPending = false;
      waiting = false;
      toast("전투를 시작하지 못했습니다.");
      readyBattle();
      return;
    }
    battle = createBattle(started.options);
    battleSnapshot = { ...started.snapshot, battleId: started.battleId };
    manualBattleActions = [];
    idleIncome = { gold: 0, diamonds: 0 };
    paused = false;
    waiting = false;
    hostedHalted = false;
    resultHandled = false;
    skillRemaining = 0;
    restartAt = 0;
    accumulator = 0;
    battleStartPending = false;
    $("battle-ready").hidden = true;
    $("battle-result").hidden = true;
    $("battle-result").innerHTML = "";
    createHand();
    updateUi();
    return;
  }
  const levels = battleLevels(account);
  battle = createBattle({
    mode,
    stageId,
    levels,
    abilities: account.abilities,
    sequence: playableSequence(account, mode),
    modifiers: gemModifiers(account, mode),
    ownedUnits: UNITS.filter((u) => canUseUnit(account, u.id)).map((u) => u.id),
    onboardingPhase: isOnboarding(account) ? account.onboarding.phase : null,
    earlyGuidePhase: stageId === 2 ? account.earlyGuide?.phase : null,
  });
  idleIncome = { gold: 0, diamonds: 0 };
  battleSnapshot = {
    stageId,
    duration: battle.duration,
    balanceVersion: BALANCE_VERSION,
    levels: { ...levels },
    abilities: structuredClone(account.abilities),
    sequence: playableSequence(account, mode),
    gem: account.equippedGem,
    gemEffects: structuredClone(gemModifiers(account, mode)),
    gemPreset: gemPresetForMode(account, mode),
    dailyKey: account.daily.key,
  };
  paused = false;
  waiting = false;
  resultHandled = false;
  skillRemaining = 0;
  restartAt = 0;
  accumulator = 0;
  manualBattleActions = [];
  $("battle-ready").hidden = true;
  $("battle-result").hidden = true;
  $("battle-result").innerHTML = "";
  createHand();
  updateUi();
}
function readyBattle() {
  createHand();
  battle = null;
  waiting = true;
  paused = false;
  restartAt = 0;
  $("battle-result").hidden = true;
  $("battle-ready").hidden = false;
  $("ready-stage").textContent = mode === "speedrun" ? "일일" : stageId === 0 ? "0" : stageLabel(stageId);
  $("ready-title").textContent = currentStage().name;
  updateUi();
}
function setMode(next) {
  if (isOnboarding(account)) return;
  if (next !== "idle" && firstIdleMissionPending()) {
    toast("1-1 방치 미션을 완료하고 보상을 받아 주세요.");
    return;
  }
  if (next === "speedrun" && !advancedContentUnlocked(account)) {
    toast("2-1을 완료하면 열립니다.");
    return;
  }
  settleProduction();
  closeIdleResult();
  mode = next;
  stageId =
    mode === "speedrun"
      ? 1
      : mode === "idle"
        ? account.idleStage
        : Math.min(STAGES.length, account.highestCleared + 1);
  if (mode === "idle") startBattle();
  else readyBattle();
  chirp();
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
  const actionStep = Math.round(battle.time * 30);
  if (summonUnit(battle, id)) {
    if (hostedMode) logBattleAction({ type: "summon", id }, actionStep);
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
function settleProduction() {
  if (hostedMode) {
    void settleServer();
    return { gold: 0, diamonds: 0 };
  }
  const income = accrue(account);
  if (mode === "idle" && battle) {
    idleIncome.gold += income.gold;
    idleIncome.diamonds += income.diamonds;
  }
  return income;
}
function closeIdleResult() {
  $("idle-result-popup").hidden = true;
  idleResultStage = null;
}
function showIdleResult(result) {
  if (account.settings.hiddenIdleResults.includes(stageId) || !$("idle-result-popup").hidden) return;
  idleResultStage = stageId;
  const bonus = battleSnapshot.gemEffects?.acorn ?? (battleSnapshot.gem === "gold" ? 1.15 : 1);
  const gold = Math.floor(result.reward * bonus);
  const income = idleIncome;
  $("idle-result-title").textContent = result.won ? "방치 완료" : "방치 실패";
  $("idle-result-content").innerHTML = `<p class="idle-result-stage">${stageLabel(stageId)} · ${precise(result.survival)}</p><div class="idle-earned"><span>${icon("acorn")}도토리 <strong>+${fmt(income.gold)}</strong></span><span>${icon("gem")}다이아 <strong>+${income.diamonds.toFixed(2)}</strong></span></div><div class="idle-record"><span>이번 생산 기록</span><strong>${icon("acorn")}${fmt(gold)} / ${battleSnapshot.duration ?? 90}초</strong></div><p class="settings-note">생산 기록에 따라 재화가 계속 쌓입니다.<br>방치 전투는 계속 진행됩니다.</p>`;
  $("hide-idle-result").checked = false;
  $("idle-result-popup").hidden = false;
}
function firstIdleMissionPending() {
  return !isOnboarding(account) && !(account.missions?.claimed ?? []).includes("idle-intro");
}
function leaveBattle() {
  if (mode === "idle" || !battle || battle.finished) return;
  openModal("나가기", "leave-battle", () => {
    $("modal-content").innerHTML = messagePanel({
      text: "진행 중인 전투를 종료할까요? 이번 전투의 보상과 기록은 받지 않습니다.",
      actions: '<button class="secondary-button" id="cancel-leave">계속하기</button><button class="primary-button" id="confirm-leave">나가기</button>',
    });
    $("cancel-leave").onclick = () => closeModal();
    $("confirm-leave").onclick = () => {
      closeModal();
      if (isOnboarding(account)) readyBattle();
      else setMode("idle");
    };
  });
}
function startChallenge(target = Math.min(STAGES.length, account.highestCleared + 1)) {
  if (isOnboarding(account) || target > account.highestCleared + 1) return;
  if (firstIdleMissionPending()) { toast("1-1 방치 미션을 완료하고 보상을 받아 주세요."); return; }
  if (!growthUnlocked(account) && target > 2) { toast("1-2 방치 미션을 먼저 완료하세요."); return; }
  if (target === 2 && account.earlyGuide?.phase === "rabbit-recruit") { showEarlyDraw(); return; }
  settleProduction();
  closeModal();
  closeIdleResult();
  mode = "challenge";
  stageId = target;
  startBattle();
  chirp();
}
function updateMission() {
  const mission = currentMission(account);
  const button = $("guide-mission");
  button.hidden = !mission || mode !== "idle";
  if (!mission) return;
  $("mission-heading").textContent = mission.completed ? "미션 완료" : "미션";
  $("mission-title").textContent = mission.title;
  $("mission-progress").textContent = mission.completed ? "보상 받기" : "0 / 1";
  button.classList.toggle("completed", mission.completed);
  button.setAttribute("aria-label", `${mission.title} · ${mission.completed ? "보상 받기" : "전투로 이동"}`);
  if (button.dataset.mission !== mission.id) {
    button.dataset.mission = mission.id;
    $("mission-rewards").innerHTML = `<span>${icon("acorn")}${fmt(mission.gold)}</span><span>${icon("gem")}${mission.diamonds}</span>`;
  }
}
function actOnMission() {
  const mission = currentMission(account);
  if (!mission || isOnboarding(account)) return;
  if (mission.completed) {
    if (hostedMode) {
      void sendCommand("mission.claim", {}).then((envelope) => {
        if (!envelope) return;
        const reward = envelope.result;
        updateUi();
        toast(`도토리 +${fmt(reward.gold)} · 다이아 +${reward.diamonds}`);
      });
      return;
    }
    const reward = claimMission(account);
    if (reward) {
      persist();
      updateUi();
      toast(`도토리 +${fmt(reward.gold)} · 다이아 +${reward.diamonds}`);
    }
  } else if (mission.kind === "challenge") startChallenge(mission.stageId);
  else if (mission.kind === "gem") openGemGuide();
  else if (mission.kind === "growth") openModal("동료", "growth", renderGrowth);
  else if (mission.stageId === 2 && account.earlyGuide?.phase === "remove-rabbit") {
    if (mode !== "idle" || stageId !== 2) enterSecondIdle();
    showDefenseGuide();
  }
  else {
    closeModal();
    closeIdleResult();
    if (mode !== "idle" || stageId !== mission.stageId) {
      settleProduction();
      const startSelectedStage = () => {
        mode = "idle";
        stageId = mission.stageId;
        startBattle();
      };
      if (hostedMode)
        void sendCommand("idle.select", { stageId: mission.stageId }).then((envelope) => {
          if (envelope) startSelectedStage();
        });
      else {
        account.idleStage = mission.stageId;
        persist();
        startSelectedStage();
      }
    }
  }
}
function openGemGuide() {
  if (!advancedContentUnlocked(account)) return;
  openModal("보석", "gem-guide", () => {
    $("modal-content").innerHTML = messagePanel({text:"2-2의 적은 훨씬 강해요.<br>숲의 보물에서 보석을 무료로 모집하고 세 칸 중 하나에 장착해 보세요.<br>순서에서 콘텐츠별 보석 프리셋을 고를 수 있어요. 속공에서도 보석 조각을 얻습니다.",actions:'<button class="primary-button" id="gem-guide-open">보석 보기</button>'});
    $("gem-guide-open").onclick = openGems;
  });
}
function openGems() {
  if (!advancedContentUnlocked(account)) { toast("2-1을 완료하면 열립니다."); return; }
  gemViewPreset = gemPresetForMode(account, mode);
  openModal("보석", "gems", renderGems);
}
function renderGems() {
  $("modal-content").innerHTML = gemPage(account,gemViewPreset);
  $("modal-content").querySelectorAll("[data-gem-preset]").forEach(button => button.onclick = () => { gemViewPreset=Number(button.dataset.gemPreset); renderGems(); });
  $("modal-content").querySelectorAll("[data-gem-uid]").forEach(button => button.onclick = () => openGemDetail(button.dataset.gemUid));
  $("modal-content").querySelectorAll("[data-gem-slot]").forEach(button => button.onclick = () => openGemPicker(Number(button.dataset.gemSlot)));
  if($("gem-free")) $("gem-free").onclick = () => drawResourceGem("diamonds",true);
  $("gem-draw-tickets").onclick = () => drawResourceGem("tickets");
  $("gem-draw-diamonds").onclick = () => drawResourceGem("diamonds");
  $("gem-rates").onclick = () => openModal("확률","probability",() => {
    $("modal-content").innerHTML = `<h3>${GEM_BANNERS[0].name}</h3><div class="income-list">${GEM_BANNERS[0].types.map(type => `<div class="income-row"><strong>${gemDefinition(type).name}</strong><span>25%</span></div>`).join("")}</div><p class="settings-note">첫 무료 모집은 햇살 보석을 지급합니다. 추가옵션은 1·2·3줄이 각각 1/3 확률이며 같은 옵션이 반복될 수 있습니다. 각 줄의 종류는 같은 확률이고 범위 안 정수 %를 동일한 확률로 정합니다.</p><div class="gem-options">${GEM_OPTIONS.map(option => `<p>${option.name} ${Math.round(option.min*100)}~${Math.round(option.max*100)}%</p>`).join("")}</div><div class="modal-footer"><button class="secondary-button" id="gem-rates-back">돌아가기</button></div>`;
    $("gem-rates-back").onclick = () => returnModal("보석","gems",renderGems);
  });
}
function drawResourceGem(payment,free=false) {
  if (hostedMode) {
    void sendCommand("recruit.gem", { payment, free, banner: "treasure" }).then((envelope) => {
      if (!envelope) return;
      const item = envelope.result;
      updateUi();
      chirp("win");
      openGemDetail(item.uid);
    });
    return;
  }
  const item=drawGem(account,{payment,free});
  if(!item) { toast("모집 재화를 확인해 주세요."); return; }
  persist(); updateUi(); chirp("win"); openGemDetail(item.uid);
}
function openGemPicker(slot) {
  openModal("보석 선택","gems",() => {
    $("modal-content").innerHTML = `<div class="gem-grid">${account.gemItems.map(item=>gemCard(item,"gem-equip")).join("")}</div><div class="modal-footer"><button class="secondary-button" id="gem-remove">비우기</button><button class="secondary-button" id="gem-picker-back">돌아가기</button></div>`;
    $("modal-content").querySelectorAll("[data-gem-equip]").forEach(button=>button.onclick=()=>{
      if (hostedMode) {
        void sendCommand("gem.equip", { presetIndex: gemViewPreset, slotIndex: slot, uid: button.dataset.gemEquip }).then((envelope) => {
          if (!envelope) return;
          updateUi();
          returnModal("보석","gems",renderGems);
        });
        return;
      }
      if(!equipGem(account,gemViewPreset,slot,button.dataset.gemEquip)) { toast("같은 보석은 한 프리셋에 한 번만 장착할 수 있어요."); return; }
      persist(); updateUi(); returnModal("보석","gems",renderGems);
    });
    $("gem-remove").onclick=()=>{
      if (hostedMode) {
        void sendCommand("gem.equip", { presetIndex: gemViewPreset, slotIndex: slot, uid: null }).then((envelope) => {
          if (envelope) { updateUi(); returnModal("보석","gems",renderGems); }
        });
        return;
      }
      if(equipGem(account,gemViewPreset,slot,null)){persist();updateUi();}returnModal("보석","gems",renderGems);
    };
    $("gem-picker-back").onclick=()=>returnModal("보석","gems",renderGems);
  });
}
function openGemDetail(uid) {
  if(!gemByUid(account,uid)) return;
  openModal("보석", "gem-detail", () => renderGemDetail(uid));
}
function renderGemDetail(uid) {
  const item=gemByUid(account,uid);
  if(!item) { returnModal("보석","gems",renderGems); return; }
  $("modal-content").innerHTML=gemDetail(account,uid,gemViewPreset);
  $("gem-back").onclick=()=>returnModal("보석","gems",renderGems);
  $("modal-content").querySelectorAll("[data-detail-equip]").forEach(button=>button.onclick=()=>{
    if (hostedMode) {
      void sendCommand("gem.equip", { presetIndex: gemViewPreset, slotIndex: Number(button.dataset.detailEquip), uid }).then((envelope) => {
        if (!envelope) return;
        updateUi();toast("장착했습니다. 다음 전투부터 적용됩니다.");renderGemDetail(uid);
      });
      return;
    }
    if(!equipGem(account,gemViewPreset,Number(button.dataset.detailEquip),uid)){toast("같은 보석은 한 프리셋에 한 번만 장착할 수 있어요.");return;}
    persist();updateUi();toast("장착했습니다. 다음 전투부터 적용됩니다.");renderGemDetail(uid);
  });
  $("gem-upgrade").onclick=()=>showGemUpgrade(uid);
  $("gem-transfer").onclick=()=>showGemTransfer(uid);
}
function showGemUpgrade(uid) {
  const item=gemByUid(account,uid),cost=gemUpgradeCost(item);
  if(!cost) return;
  const selected=new Set();
  let applied=false;
  openModal("강화 재료", "gem-upgrade",()=>{
    const candidates=gemUpgradeMaterials(account,uid);
    const reserves=account.gemReserves[item.type]??0;
    $("modal-content").innerHTML=`<p class="settings-note">같은 보석 ${cost.copies}개와 도토리 ${fmt(cost.gold)}개가 필요합니다. 선택한 보석은 소모됩니다. 모든 프리셋의 장착 보석과 강화한 보석은 재료에서 제외합니다.</p><p>이전 보석 재료 ${fmt(reserves)}개</p><div class="gem-grid">${candidates.map(candidate=>gemCard(candidate,"gem-material")).join("")}</div><p id="gem-material-count">선택 0 / ${cost.copies}</p><div class="modal-footer"><button class="secondary-button" id="gem-upgrade-cancel">취소</button><button class="primary-button" id="gem-upgrade-confirm">강화</button></div>`;
    $("modal-content").querySelectorAll("[data-gem-material]").forEach(button=>button.onclick=()=>{
      const id=button.dataset.gemMaterial;
      if(selected.has(id)) selected.delete(id); else if(selected.size<cost.copies) selected.add(id);
      button.setAttribute("aria-pressed",String(selected.has(id)));
      $("gem-material-count").textContent=`선택 ${selected.size} / ${cost.copies}`;
    });
    $("gem-upgrade-cancel").onclick=()=>returnModal("보석","gem-detail",()=>renderGemDetail(uid));
    $("gem-upgrade-confirm").onclick=()=>{
      if(applied) return;
      if (hostedMode) {
        applied = true;
        void sendCommand("gem.upgrade", { uid, materialUids: [...selected] }).then((envelope) => {
          if (!envelope) { applied = false; return; }
          updateUi();returnModal("보석","gem-detail",()=>renderGemDetail(uid));chirp();
        });
        return;
      }
      settleProduction();
      if(!upgradeGem(account,uid,[...selected])){toast("선택한 재료와 도토리를 확인해 주세요.");return;}
      applied=true;
      persist();updateUi();returnModal("보석","gem-detail",()=>renderGemDetail(uid));chirp();
    };
  });
}
function showGemTransfer(uid) {
  const source=gemByUid(account,uid);
  if(!source||source.level<=1) return;
  openModal("전승 대상", "gems",()=>{
    $("modal-content").innerHTML=`<p class="settings-note">받는 보석의 추가옵션은 유지하고 강화 단계만 Lv. ${source.level}로 옮깁니다.</p><div class="gem-grid">${account.gemItems.filter(item=>item.uid!==uid&&item.level<source.level).map(item=>gemCard(item,"gem-target")).join("")}</div><div class="modal-footer"><button class="secondary-button" id="gem-transfer-back">취소</button></div>`;
    $("gem-transfer-back").onclick=()=>returnModal("보석","gem-detail",()=>renderGemDetail(uid));
    $("modal-content").querySelectorAll("[data-gem-target]").forEach(button=>button.onclick=()=>{
      const targetUid=button.dataset.gemTarget,target=gemByUid(account,targetUid);
      openModal("전승", "gem-transfer",()=>{
        $("modal-content").innerHTML=messagePanel({text:`${gemDefinition(source.type).name} Lv. ${source.level} 보석은 사라집니다.<br>${gemDefinition(target.type).name}의 추가옵션을 유지하고 Lv. ${source.level}로 올립니다.<br>도토리 ${fmt(gemTransferCost(source))}개를 사용합니다.`,actions:'<button class="secondary-button" id="gem-transfer-cancel">취소</button><button class="primary-button" id="gem-transfer-confirm">전승</button>'});
        $("gem-transfer-cancel").onclick=()=>backModal() || returnModal("보석","gem-detail",()=>renderGemDetail(uid));
        let applied=false;
        $("gem-transfer-confirm").onclick=()=>{
          if(applied) return;
          if (hostedMode) {
            applied = true;
            void sendCommand("gem.transfer", { sourceUid: uid, targetUid }).then((envelope) => {
              if (!envelope) { applied = false; return; }
              updateUi();returnModal("보석","gems",renderGems);openGemDetail(targetUid);chirp();
            });
            return;
          }
          settleProduction();
          if(!transferGem(account,uid,targetUid)){toast("전승 대상과 도토리를 확인해 주세요.");return;}
          applied=true;
          persist();updateUi();returnModal("보석","gems",renderGems);openGemDetail(targetUid);chirp();
        };
      });
    });
  });
}
function showReturnIncome() {
  const summary=pendingReturnIncome;
  if(!summary) return;
  pendingReturnIncome=null;
  closeIdleResult();
  const minutes=Math.floor(summary.awaySeconds/60),hours=Math.floor(minutes/60);
  const duration=hours ? `${hours}시간 ${minutes%60}분` : `${minutes}분`;
  const timestamp=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(summary.from));
  openModal("자리 비운 동안", "return-income",()=>{
    $("modal-content").innerHTML=`<div class="return-income-summary"><p>마지막 접속 ${timestamp}</p><strong>${duration}</strong><div class="result-rewards"><span>${icon("acorn")}+${fmt(summary.gold)}</span><span>${icon("gem")}+${summary.diamonds.toFixed(2)}</span></div><p class="settings-note">재화는 이미 반영되었습니다.${summary.capped ? "<br>최대 8시간의 생산을 반영했어요." : ""}</p><button class="primary-button" id="return-income-confirm">확인</button></div>`;
    $("return-income-confirm").onclick=()=>closeModal();
  });
}
function renderMenu() {
  const tutorial = isOnboarding(account);
  const unlocked = advancedContentUnlocked(account);
  const items = mode !== "idle" ? [["settings", "설정", "settings", true]] : [
    ["mission", "미션", "flag", !tutorial && !!currentMission(account)],
    ["growth", "동료", "units", !tutorial],
    ["recruit", "모집", "envelope", !tutorial],
    ["codex", "도감", "book", !tutorial],
    ["income", "방치", "leaf", !tutorial],
    ["daily", "속공", "bolt", !tutorial && unlocked],
    ["gems", "보석", "gem", !tutorial && unlocked],
    ["sequence", "순서", "sequence", sequenceUnlocked(account)],
    ["settings", "설정", "settings", true],
  ];
  $("modal-content").innerHTML = `<div class="content-menu-grid">${items.map(([id, title, glyph, enabled]) => `<button class="content-menu-item" data-content-menu="${id}" ${enabled ? "" : "disabled"} aria-label="${title}${enabled ? "" : " 잠김"}"><span>${icon(glyph)}</span><strong>${title}</strong>${!enabled ? `<small>${icon("lock")}${tutorial ? "" : id === "sequence" ? "1-2" : "2-2"}</small>` : ""}</button>`).join("")}</div>`;
  $("modal-content").querySelectorAll("[data-content-menu]").forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.contentMenu;
      if (id === "mission") { closeModal(); actOnMission(); }
      else if (id === "growth") openModal("동료", "growth", renderGrowth);
      else if (id === "recruit") openModal("모집", "recruit", renderRecruit);
      else if (id === "codex") openCodex();
      else if (id === "income") {
        if (mode !== "idle") { closeModal(); closeIdleResult(); setMode("idle"); }
        openModal("방치", "income", renderIncome);
      } else if (id === "daily") openModal("속공", "daily", renderDaily);
      else if (id === "gems") openGems();
      else if (id === "sequence") {
        openSequence();
      } else if (id === "settings") openModal("설정", "settings", renderSettings);
    };
  });
}
function finishBattle() {
  if (resultHandled || !battle?.result) return;
  if (hostedMode) {
    void finishHostedBattle();
    return;
  }
  resultHandled = true;
  const r = battle.result;
  if (isOnboarding(account)) {
    finishOnboardingBattle(r);
    return;
  }
  const earlyPhase = account.earlyGuide?.phase;
  chirp("win");
  if (mode === "idle") {
    settleProduction();
    recordIdle(account, r, battleSnapshot);
    recordMissionBattle(account, { mode, stageId, won: r.won });
    persist();
    showIdleResult(r);
    restartAt = performance.now() + 3000;
    updateUi();
    if (earlyPhase === "idle-defense" && account.earlyGuide?.phase === "remove-rabbit") showDefenseGuide();
    if (earlyPhase === "idle-retry" && account.earlyGuide?.phase === "growth") {
      openModal("레벨업", "growth-guide", () => {
        $("modal-content").innerHTML = messagePanel({
          text: "성을 지켜냈어요! 이제 도토리로 동료의 레벨을 올릴 수 있습니다.<br>방치 미션 보상을 받고 동료를 성장시켜 보세요.",
          actions: '<button class="primary-button" id="growth-guide-done">확인</button>',
        });
        $("growth-guide-done").onclick = () => {
          if (currentMission(account)?.completed) actOnMission();
          closeIdleResult();
          openModal("동료", "growth", renderGrowth);
        };
      });
    }
    return;
  }
  recordMissionBattle(account, { mode, stageId, won: r.won });
  if (stageId === 2 && mode === "challenge" && account.earlyGuide?.phase === "rabbit-recruit") {
    persist();
    onboardingMessage("튼튼한 성", "시간 안에 성을 무너뜨리지 못했어요. 성을 빠르게 공격할 동료를 무료로 모집해 보세요.", "동료 모집", showEarlyDraw, "squirrel");
    updateUi();
    return;
  }
  let rewards = { gold: 0, diamonds: 0 };
  if (mode === "challenge" && r.won) {
    const wasLocked = !advancedContentUnlocked(account);
    const newRegion = account.highestCleared < 10;
    rewards = completeChallenge(account, stageId);
    if (newRegion && account.highestCleared >= 10) {
      createHand();
      toast("2-1 개방 · 공방과 별빛 모집이 열렸습니다.");
    }
    if (wasLocked && advancedContentUnlocked(account))
      setTimeout(() => toast("보석과 속공이 열렸습니다."), 900);
  }
  if (mode === "speedrun" && r.won) {
    settleProduction();
    if (battleSnapshot.dailyKey === account.daily.key)
      recordSpeedrun(account, r.time);
    else toast("새로운 하루가 시작됐습니다. 다시 도전해 주세요.");
  }
  persist();
  showResult(r, rewards);
  updateUi();
}
async function finishHostedBattle() {
  if (resultHandled || !battle?.result) return;
  const completedBattle = battle;
  resultHandled = true;
  const before = {
    onboardingPhase: isOnboarding(account) ? account.onboarding.phase : null,
    earlyPhase: account.earlyGuide?.phase,
    highestCleared: account.highestCleared,
    advancedUnlocked: advancedContentUnlocked(account),
    battleId: battleSnapshot?.battleId,
  };
  const envelope = await sendCommand("battle.finish", {
    battleId: before.battleId,
    actions: manualBattleActions.map(({ step, type, id }) => type === "summon" ? { step, type, id } : { step, type }),
  });
  if (!envelope || battle !== completedBattle) return;
  const outcome = envelope.result;
  const result = outcome?.battleResult;
  if (!result) {
    toast("전투 결과를 확인하지 못했습니다.");
    return;
  }
  battle.result = result;
  chirp("win");
  if (before.onboardingPhase) {
    finishOnboardingBattle(result, { phase: before.onboardingPhase, serverApplied: true });
    return;
  }
  if (mode === "idle") {
    const earned = outcome.income;
    if (earned) {
      idleIncome.gold += earned.gold ?? 0;
      idleIncome.diamonds += earned.diamonds ?? 0;
    }
    showIdleResult(result);
    restartAt = performance.now() + 3000;
    updateUi();
    if (before.earlyPhase === "idle-defense" && account.earlyGuide?.phase === "remove-rabbit") showDefenseGuide();
    if (before.earlyPhase === "idle-retry" && account.earlyGuide?.phase === "growth") {
      openModal("레벨업", "growth-guide", () => {
        $("modal-content").innerHTML = messagePanel({
          text: "성을 지켜냈어요! 이제 도토리로 동료의 레벨을 올릴 수 있습니다.<br>방치 미션 보상을 받고 동료를 성장시켜 보세요.",
          actions: '<button class="primary-button" id="growth-guide-done">확인</button>',
        });
        $("growth-guide-done").onclick = () => {
          if (currentMission(account)?.completed) actOnMission();
          closeIdleResult();
          openModal("동료", "growth", renderGrowth);
        };
      });
    }
    return;
  }
  if (stageId === 2 && mode === "challenge" && account.earlyGuide?.phase === "rabbit-recruit") {
    onboardingMessage("튼튼한 성", "시간 안에 성을 무너뜨리지 못했어요. 성을 빠르게 공격할 동료를 무료로 모집해 보세요.", "동료 모집", showEarlyDraw, "squirrel");
    updateUi();
    return;
  }
  const rewards = outcome.rewards ?? { gold: 0, diamonds: 0 };
  if (mode === "challenge" && result.won) {
    if (before.highestCleared < 10 && account.highestCleared >= 10) {
      createHand();
      toast("2-1 개방 · 공방과 별빛 모집이 열렸습니다.");
    }
    if (!before.advancedUnlocked && advancedContentUnlocked(account))
      setTimeout(() => toast("보석과 속공이 열렸습니다."), 900);
  }
  if (mode === "speedrun" && result.won && battleSnapshot.dailyKey !== account.daily.key)
    toast("새로운 하루가 시작됐습니다. 다시 도전해 주세요.");
  showResult(result, rewards);
  updateUi();
}
function enterSecondIdle() {
  closeModal(true);
  closeIdleResult();
  settleProduction();
  selectIdleStage(2, () => { mode = "idle"; stageId = 2; startBattle(); });
}
function enterRegionIdle(completedStageId) {
  if (completedStageId % 10 !== 0 || completedStageId >= STAGES.length || account.highestCleared < completedStageId) {
    setMode("idle");
    return;
  }
  closeModal(true);
  closeIdleResult();
  settleProduction();
  selectIdleStage(completedStageId + 1, () => { mode = "idle"; stageId = account.idleStage; startBattle(); });
}
function selectIdleStage(nextStageId, onSelected = () => {}) {
  if (hostedMode) {
    void sendCommand("idle.select", { stageId: nextStageId }).then((envelope) => {
      if (envelope) onSelected();
    });
    return;
  }
  account.idleStage = nextStageId;
  persist();
  onSelected();
}
function showEarlyDraw() {
  openModal("모집", "onboarding", () => {
    $("modal-content").innerHTML = recruitPanel(account, "forest", { tutorial: true, tutorialText: "성을 공략할 동료를 무료로 만나 보세요." });
    $("modal-content").querySelector('[data-draw-count="1"]').onclick = () => {
      if (hostedMode) {
        void sendCommand("recruit.units", { count: 1, free: true, banner: "forest" }).then((envelope) => {
          if (!envelope) return;
          revealEarlyRabbit(envelope.result);
        });
        return;
      }
      const result = recruitEarlyRabbit(account);
      revealEarlyRabbit(result ? [result] : null);
    };
  }, { layout: "collection" });
}
function revealEarlyRabbit(results) {
  if (!Array.isArray(results) || !results.length) return;
  persist();
  createHand();
  updateUi();
  recruitCleanup = revealRecruit($("modal-content"), results, {
    done: () => onboardingMessage("속공 토끼", "빠르게 달려가 적 성에 추가 피해를 줍니다. 양 방패와 다람쥐로 길을 열고 토끼를 소환해 보세요.", "1-2 출정", () => { closeModal(true); startChallenge(2); }, "rabbit"),
    inspect: () => {}, sound: () => chirp("win"),
  });
  $("draw-again").hidden = true;
  $("draw-done").textContent = "함께 출정";
  $("draw-skip").focus();
}
function showDefenseGuide() {
  // Idle continues while this information and the sequence editor are open.
  openModal("방치 편성", "defense-guide", () => {
    $("modal-content").innerHTML = messagePanel({
      companion: "rabbit",
      text: "속공 토끼는 성을 무너뜨리는 데 특화되어 있어요.<br>성을 지키는 방치에서는 토끼를 빼고 방패와 다람쥐에 골드를 써 보세요.<br>순서 → 토끼의 교체 → 비우기 → 적용을 누르면 됩니다.",
      actions: '<button class="primary-button" id="defense-edit">편성 바꾸기</button>',
    });
    $("defense-edit").onclick = () => {
      closeIdleResult();
      openSequence("idle");
    };
  });
}
function resumeEarlyGuide() {
  if (account.earlyGuide?.phase === "rabbit-recruit") showEarlyDraw();
  else if (account.earlyGuide?.phase === "remove-rabbit") {
    if (mode !== "idle" || stageId !== 2) enterSecondIdle();
    showDefenseGuide();
  }
}
function onboardingMessage(title, text, label, action, companion = "sheep") {
  openModal(title, "onboarding", () => {
    $("modal-content").innerHTML = messagePanel({
      text, companion,
      actions: `<button class="primary-button" id="onboarding-next">${label}</button>`,
    });
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
  openModal("모집", "onboarding", () => {
    $("modal-content").innerHTML = recruitPanel(account, "forest", { tutorial: true });
    $("modal-content").querySelector('[data-draw-count="1"]').onclick = () => {
      if (hostedMode) {
        void sendCommand("recruit.units", { count: 1, free: true, banner: "forest" }).then((envelope) => {
          if (!envelope) return;
          finishOnboardingRecruit(envelope.result);
        });
        return;
      }
      const result = recruitOnboardingCompanion(account);
      finishOnboardingRecruit(result ? [result] : null);
    };
    $("modal-content").querySelector('[data-draw-count="1"]').focus();
  }, { layout: "collection" });
}
function finishOnboardingRecruit(results) {
  if (!Array.isArray(results) || !results.length) {
    resumeOnboarding();
    return;
  }
  persist();
      // Persist the grant before revealing; reloading cannot draw it again.
      createHand();
      updateUi();
      recruitCleanup = revealRecruit($("modal-content"), results, {
        done: showOnboardingRetry,
        inspect: () => {},
        sound: () => chirp("win"),
      });
      $("draw-again").hidden = true;
      $("draw-done").textContent = "함께 출정";
      $("draw-skip").focus();
}
function showOnboardingRetry() {
  recruitCleanup?.();
  recruitCleanup = null;
  onboardingMessage("다시 출정", "양 방패를 먼저 소환하고, 골드를 모아 씨앗 다람쥐를 소환하세요. 방패 뒤에서 적을 공격합니다.", "1-1 출정", enterOnboardingBattle, "squirrel");
}
function showIdleGuide() {
  onboardingMessage("방치", "1-1을 돌파했어요! 이제 동료가 자동으로 소환되어 90초 동안 성을 지킵니다.<br>전투가 끝나면 생산 기록이 생겨요. 그 기록으로 게임을 꺼도 도토리와 다이아가 쌓입니다.", "방치 시작", () => {
    if (hostedMode) {
      void sendCommand("onboarding.finish", {}).then((envelope) => {
        if (!envelope) return;
        closeModal(true);
        mode = "idle";
        stageId = 1;
        createHand();
        startBattle();
      });
      return;
    }
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
function finishOnboardingBattle(result, { phase = account.onboarding.phase, serverApplied = false } = {}) {
  if (!serverApplied) {
    advanceOnboardingBattle(account, result.won);
    persist();
  }
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
function claimSpeedrunReward(onClaimed = () => {}) {
  if (hostedMode) {
    void sendCommand("speedrun.claim", {}).then((envelope) => {
      if (!envelope) return;
      const reward = envelope.result;
      if (reward) toast(`보석 조각 +${reward}`);
      onClaimed(reward);
      updateUi();
    });
    return;
  }
  const reward = claimSpeedrun(account);
  if (reward) {
    persist();
    toast(`보석 조각 +${reward}`);
  }
  onClaimed(reward);
}
function showResult(r, rewards) {
  const growthHelp = mode === "challenge" && !r.won && growthUnlocked(account);
  const mission = growthHelp ? currentMission(account) : null;
  const support = growthHelp ? `<div class="result-support"><p>${mission?.completed ? "받지 않은 미션 보상이 있어요." : "동료를 키우거나 새 친구를 모집해 보세요."}</p><div>${mission?.completed ? '<button class="secondary-button" id="result-mission">미션 보상</button>' : ""}<button class="secondary-button" id="result-growth">동료</button><button class="secondary-button" id="result-recruit">모집</button></div></div>` : "";
  const daily = mode === "speedrun",
    rewardMarkup =
      daily && r.won
        ? `<span>${icon("gem")}${speedrunReward(account)}</span>`
        : r.won && rewards.gold
          ? `<span>${icon("acorn")}+${fmt(rewards.gold)}</span><span>${icon("gem")}+${rewards.diamonds}</span>`
          : "";
  $("battle-result").innerHTML =
    `<div class="result-card">${icon(r.won ? "trophy" : "shield")}<h2>${r.won ? "완료" : "다시 한 번"}</h2><div class="result-time">${precise(r.time)}</div>${rewardMarkup ? `<div class="result-rewards">${rewardMarkup}</div>` : ""}<div class="result-actions"><button class="secondary-button" id="return-idle">방치로</button>${!r.won || daily ? `<button class="secondary-button" id="retry-battle">${daily && account.daily.claimed ? "연습하기" : "다시 도전"}</button>` : ""}${daily && r.won && !account.daily.claimed ? '<button class="primary-button" id="claim-speedrun">보상받기</button>' : !daily && r.won && stageId < STAGES.length ? `<button class="primary-button" id="next-battle">${stageLabel(stageId + 1)} 도전</button>` : ""}</div>${daily && account.daily.claimed ? '<div class="new-record">오늘 보상 수령 완료</div>' : ""}${support}</div>`;
  $("battle-result").hidden = false;
  const completedStageId = stageId;
  $("return-idle").onclick = mode === "challenge" && stageId === 2 && account.earlyGuide?.phase === "idle-defense"
    ? enterSecondIdle
    : mode === "challenge" && r.won && stageId % 10 === 0
      ? () => enterRegionIdle(completedStageId)
      : () => setMode("idle");
  if (!r.won || daily) $("retry-battle").onclick = startBattle;
  if (growthHelp) {
    $("result-growth").onclick = () => openModal("동료", "growth", renderGrowth);
    $("result-recruit").onclick = () => openModal("모집", "recruit", renderRecruit);
    if (mission?.completed) $("result-mission").onclick = () => {
      if (currentMission(account)?.id !== mission.id) return;
      if (hostedMode) {
        void sendCommand("mission.claim", {}).then((envelope) => {
          if (!envelope) return;
          const reward = envelope.result;
          updateUi();
          toast(`도토리 +${fmt(reward.gold)} · 다이아 +${reward.diamonds}`);
          showResult(r, rewards);
        });
        return;
      }
      const reward = claimMission(account);
      if (!reward) return;
      persist();
      updateUi();
      toast(`도토리 +${fmt(reward.gold)} · 다이아 +${reward.diamonds}`);
      showResult(r, rewards);
    };
  }
  if ($("next-battle"))
    $("next-battle").onclick = () => startChallenge(stageId + 1);
  if ($("claim-speedrun"))
    $("claim-speedrun").onclick = () => {
      if (hostedMode) {
        claimSpeedrunReward(() => { showResult(r, rewards); updateUi(); });
        return;
      }
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
  const manualCombat = mode !== "idle" && !!battle && !battle.finished;
  $("game").dataset.manualCombat = String(manualCombat);
  $("game").dataset.mode = mode;
  $("challenge-start").hidden = mode !== "idle" || isOnboarding(account);
  $("challenge-start").disabled = firstIdleMissionPending();
  updateMission();
  $("speed").hidden = !manualCombat;
  $("skill").hidden = mode === "idle";
  $("pause").hidden = !manualCombat;
  $("edit-sequence").hidden = false;
  $("leave-battle").hidden = !manualCombat;
  $("gold").textContent = fmt(account.gold);
  $("diamonds").textContent = fmt(account.diamonds);
  $("combat-power").textContent = fmt(combatPower(account));
  const record = account.records[account.idleStage];
  $("income-rate").innerHTML =
    `${fmt((record?.gold || 0) * 3600 / (record?.productionSeconds ?? 120))}<span class="muted"> / 시간</span>`;
  $("stage-number").textContent = mode === "speedrun" ? "일일" : stageId === 0 ? "0" : stageLabel(stageId);
  $("stage-name").textContent = currentStage().regionName ?? "초원";
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
      : "01:30";
  $("pause-icon").innerHTML = icon(paused ? "play" : "pause");
  $("pause-text").textContent = paused ? "계속" : "정지";
  $("pause").dataset.tip = paused ? "계속하기" : "일시 정지";
  $("pause").setAttribute("aria-pressed", String(paused));
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
    `${Math.min(3, Math.floor((battle?.time || 0) / 30) + 1)} / 3`;
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
  if (!isOnboarding(account) && stageId === 2) {
    if (mode === "challenge" && account.earlyGuide?.phase === "wall-battle") note = "시간 안에 튼튼한 적 성을 무너뜨리세요";
    else if (mode === "challenge" && account.earlyGuide?.phase === "wall-retry") note = "속공 토끼로 적 성을 공략하세요";
    else if (mode === "idle" && account.earlyGuide?.phase === "remove-rabbit") note = "순서에서 속공 토끼를 빼 보세요";
  }
  $("field-note-text").textContent = note;
  $("unit-hand")
    .querySelectorAll(".unit-card")
    .forEach((btn, index) => {
      const u = unitById[btn.dataset.unit];
      if (!u) return;
      btn.setAttribute("aria-label", `${u.name} ${mode === "idle" ? "자동 소환" : "소환"}`);
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
  for (const id of ["stage-select", "mode-select", "profile-button", "edit-sequence", "nav-units", "nav-recruit", "income"]) {
    $(id).disabled = isOnboarding(account) || (manualCombat && ["stage-select", "mode-select"].includes(id));
  }
  $("edit-sequence").disabled = !sequenceUnlocked(account);
  $("mode-select").disabled = true;
  $("speed-text").textContent = `${account.settings.speed}×`;
  $("upgrade-dot").hidden = !UNITS.some(
    (u) =>
      ownsUnit(account, u.id) &&
      effectiveUnitLevel(account, u.id) < 100 &&
      account.gold >= levelCost(effectiveUnitLevel(account, u.id)),
  );
}
function rememberModalPosition() {
  const frame = modalHistory.at(-1);
  if (!frame) return;
  frame.scroll = ["modal-content", "companion-summary", "companion-abilities"].map(id => [id, $(id)?.scrollTop ?? 0]);
  frame.focusId = document.activeElement?.id;
}
function displayModalFrame(frame) {
  recruitCleanup?.();
  recruitCleanup = null;
  hideTooltip();
  modalKind = frame.kind;
  modalRender = frame.render;
  $("modal-backdrop").dataset.kind = frame.kind;
  $("modal-backdrop").dataset.layout = frame.layout;
  $("modal-title").textContent = frame.title;
  $("modal-backdrop").hidden = false;
  $("close-modal").hidden = frame.kind === "onboarding";
  $("back-modal").hidden = frame.kind === "onboarding" || modalHistory.length < 2;
  frame.render();
  // A renderer may redirect (for example, to a required tutorial).
  if (modalHistory.at(-1) !== frame) return;
  for (const [id, top] of frame.scroll ?? []) if ($(id)) $(id).scrollTop = top;
  if (frame.kind !== "onboarding") {
    const focus = frame.focusId && $(frame.focusId);
    (focus && !focus.disabled ? focus : $("back-modal").hidden ? $("close-modal") : $("back-modal")).focus();
  }
}
function openModal(title, kind, render, { layout = modalLayout(kind), navigation = "push" } = {}) {
  if (["sequence", "sequence-pick"].includes(kind) && !sequenceUnlocked(account)) {
    toast("1-2 방치에서 처음 실패하면 편성 교체가 열립니다.");
    return;
  }
  if (isOnboarding(account) && !["onboarding", "menu", "settings", "import", "codex", "reset-account", "leave-battle"].includes(kind)) return;
  if (modalKind === "onboarding" && kind !== "onboarding") return;
  const root = $("modal-backdrop").hidden || navigation === "root";
  if (root) {
    if ($("modal-backdrop").hidden) lastFocused = document.activeElement;
    modalHistory.length = 0;
  } else rememberModalPosition();
  if (kind === "onboarding") modalHistory.length = 0;
  else if (!root && navigation === "replace") modalHistory.pop();
  const frame = { title, kind, render, layout };
  modalHistory.push(frame);
  displayModalFrame(frame);
}
function backModal() {
  if (modalKind === "onboarding" || modalHistory.length < 2) return false;
  modalHistory.pop();
  displayModalFrame(modalHistory.at(-1));
  return true;
}
function returnModal(title, kind, render) {
  // Return actions reuse an existing ancestor instead of adding a second copy.
  const index = modalHistory.slice(0, -1).findLastIndex(frame => frame.kind === kind && (frame.render === render || !["codex", "gems"].includes(kind)));
  if (index >= 0) {
    modalHistory.length = index + 1;
    displayModalFrame(modalHistory[index]);
  } else openModal(title, kind, render, { navigation: "root" });
}
function closeModal(force = false) {
  if (modalKind === "onboarding" && force !== true) return;
  if ($("modal-backdrop").hidden) return;
  $("modal-backdrop").hidden = true;
  recruitCleanup?.();
  recruitCleanup = null;
  modalHistory.length = 0;
  modalKind = null;
  $("close-modal").hidden = false;
  $("back-modal").hidden = true;
  modalRender = null;
  lastFocused?.focus?.();
  hideTooltip();
}
function renderStages() {
  const unlocked = firstIdleMissionPending() ? 1 : Math.min(growthUnlocked(account) ? STAGES.length : 2, account.highestCleared + 1);
  $("modal-content").innerHTML =
    `<div class="stage-grid">${STAGES.map((s) => `<div style="position:relative"><button class="stage-tile ${s.id === stageId ? "selected" : ""}" data-stage="${s.id}" ${s.id > unlocked ? "disabled" : ""} style="width:100%"><strong>${stageLabel(s.id)}</strong><span class="stage-tile-name">${s.name}</span>${icon(s.id > unlocked ? "lock" : s.id <= account.highestCleared ? "check" : "flag")}${account.records[s.id] ? `<span class="stage-rate">${icon("acorn")}${fmt(account.records[s.id].gold * 3600 / (account.records[s.id].productionSeconds ?? 120))} / 시간</span>` : ""}</button><button class="stage-info-button" data-stage-info="${s.id}" aria-label="${s.name} 전장 정보" title="${s.name} 전장 정보" style="position:absolute;left:5px;bottom:5px;padding:2px 4px;border:0;background:transparent;color:#7b9463;line-height:0">${icon("book")}</button></div>`).join("")}</div>`;
  $("modal-content")
    .querySelectorAll("[data-stage]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (firstIdleMissionPending() && Number(b.dataset.stage) !== 1) return;
          closeIdleResult();
          stageId = Number(b.dataset.stage);
          if (mode === "idle") {
            settleProduction();
            selectIdleStage(stageId, () => startBattle());
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
          openModal(stage.name, "stages", () => {
            $("modal-content").innerHTML =
              `${stageIntelMarkup(stage)}<div class="modal-footer"><button class="secondary-button" id="stage-intel-back">스테이지 목록</button></div>`;
            $("stage-intel-back").onclick = () => returnModal("스테이지", "stages", renderStages);
          });
        }),
    );
}
function levelBasisMarkup() {
  const roster = baseLevelRoster(account);
  return `<section class="level-basis"><div class="level-basis-heading"><strong>레벨 기준</strong><span>공유 Lv. ${sharedLevel(account)}</span></div><div class="level-basis-roster">${Array.from({length:5}, (_, index) => {
    const id = roster[index];
    return id ? `<button data-companion="${id}" aria-label="${names[id]} 레벨 기준">${portrait(id)}<strong>${names[id]}</strong><span>Lv. ${account.levels[id]}</span></button>` : '<div class="level-basis-empty">—</div>';
  }).join("")}</div><p class="settings-note">직접 올린 레벨이 높은 5명의 최저 레벨을 다른 동료도 따라갑니다.${roster.length < 5 ? " 동료 5명을 모으면 시작됩니다." : ""}</p></section>`;
}
function renderGrowth() {
  if (!growthUnlocked(account)) {
    $("modal-content").innerHTML = '<p class="settings-note">1-2 방치 미션을 완료하면 레벨업이 열립니다.</p>';
    return;
  }
  $("modal-content").innerHTML = levelBasisMarkup() + `<div class="unit-grid">${UNITS.filter((u) => ownsUnit(account, u.id)).map((u) => {
    const level = effectiveUnitLevel(account, u.id), stats = companionStats(account, u.id, mode);
    return `<article class="growth-card"><button class="companion-open" data-companion="${u.id}" aria-label="${u.name} 상세와 강화">${rarityBadge(u)}${portrait(u.id)}<span class="level-label">Lv. ${level}</span><h3>${u.name}</h3><div class="stats"><span>${icon("heart")}${stats.hp}</span><span>${icon("swords")}${stats.attack}</span></div></button><button class="primary-button" data-grow="${u.id}" ${account.gold < levelCost(level) || level >= 100 ? "disabled" : ""}>${icon(level >= 100 ? "check" : "acorn")}${level >= 100 ? "완료" : fmt(levelCost(level)) + " ↑"}</button></article>`;
  }).join("")}</div><div class="modal-footer"><span class="resource-inline">${icon("acorn")}${fmt(account.gold)}</span></div>`;
  $("modal-content").querySelectorAll("[data-grow]").forEach((button) => {
    button.onclick = () => {
      if (hostedMode) {
        void sendCommand("unit.grow", { id: button.dataset.grow }).then((envelope) => {
          if (!envelope) return;
          renderGrowth(); updateUi(); chirp();
        });
        return;
      }
      settleProduction();
      if (!growUnit(account, button.dataset.grow)) return;
      persist(); renderGrowth(); updateUi(); chirp();
    };
  });
  $("modal-content").querySelectorAll("[data-companion]").forEach((button) => {
    button.onclick = () => openUnitDetail(button.dataset.companion);
  });
}
function openUnitDetail(id) {
  if (!ownsUnit(account, id)) return;
  openModal(names[id], "companion", () => renderUnitDetail(id));
}
function renderUnitDetail(id) {
  const abilityScroll = $("companion-abilities")?.scrollTop ?? 0;
  const summaryScroll = $("companion-summary")?.scrollTop ?? 0;
  const stats = companionStats(account, id, mode);
  if (!stats || !ownsUnit(account, id)) return;
  $("modal-content").innerHTML = companionPanel(account, id, unitAbilityLines(stats), mode);
  $("companion-abilities").scrollTop = abilityScroll;
  $("companion-summary").scrollTop = summaryScroll;
  $("companions-back").onclick = () => returnModal("동료", "growth", renderGrowth);
  $("companion-refund").onclick = () => showUnitRefund(id);
  $("companion-level").onclick = () => {
    if (hostedMode) {
      void sendCommand("unit.grow", { id }).then((envelope) => {
        if (!envelope) return;
        renderUnitDetail(id); updateUi(); chirp();
      });
      return;
    }
    settleProduction();
    if (!growUnit(account, id)) return;
    persist(); renderUnitDetail(id); updateUi(); chirp();
  };
  $("modal-content").querySelectorAll("[data-ability]").forEach((button) => {
    button.onclick = () => {
      if (hostedMode) {
        void sendCommand("unit.ability", { id, abilityId: button.dataset.ability }).then((envelope) => {
          if (!envelope) return;
          renderUnitDetail(id); updateUi(); chirp();
        });
        return;
      }
      settleProduction();
      if (!upgradeUnitAbility(account, id, button.dataset.ability)) return;
      persist(); renderUnitDetail(id); updateUi(); chirp();
    };
  });
}

function showUnitRefund(id) {
  const refunded = unitLevelRefund(account, id);
  if (!growthUnlocked(account) || !refunded) return;
  openModal(`${names[id]} 초기화`, "refund", () => {
    $("modal-content").innerHTML = messagePanel({
      companion: id,
      text: `${names[id]}의 개인 레벨을 1로 되돌리고<br>도토리 ${fmt(refunded)}개를 돌려받습니다.<br>공유 레벨은 남은 기준 동료에 따라 다시 계산됩니다.<br>방치 기록은 다시 측정해야 합니다.`,
      actions: '<button class="secondary-button" id="cancel-refund">취소</button><button class="primary-button" id="confirm-refund">초기화</button>',
    });
    $("cancel-refund").onclick = () => returnModal(names[id], "companion", () => renderUnitDetail(id));
    $("confirm-refund").onclick = () => {
      if (hostedMode) {
        void sendCommand("unit.refund", { id }).then((envelope) => {
          if (!envelope) return;
          const gold = envelope.result;
          if (mode === "idle") startBattle();
          else readyBattle();
          toast(`${names[id]} · 도토리 +${fmt(gold)}`);
          returnModal(names[id], "companion", () => renderUnitDetail(id));
          updateUi();
        });
        return;
      }
      const gold = refundUnitLevels(account, id);
      if (!gold) return;
      persist();
      if (mode === "idle") startBattle();
      else readyBattle();
      toast(`${names[id]} · 도토리 +${fmt(gold)}`);
      returnModal(names[id], "companion", () => renderUnitDetail(id));
      updateUi();
    };
  });
}

function openSequence(preset = mode) {
  sequenceDraftMode = preset;
  sequenceDraftChoices = {...(account.activeLineup ?? {idle:0,challenge:0,speedrun:0})};
  sequenceDrafts = Object.fromEntries(["idle", "challenge", "speedrun"].map(id => [id,Array.from({length:10},(_,index) => ({sequence:[...sequenceForMode(account,id,index)],gemPreset:gemPresetForMode(account,id,index)}))]));
  sequenceDraftIndex = sequenceDraftChoices[preset] ?? 0;
  sequenceDraft = sequenceDrafts[preset][sequenceDraftIndex].sequence;
  sequenceDraftGem = sequenceDrafts[preset][sequenceDraftIndex].gemPreset;
  openModal("순서", "sequence", renderSequence);
}
function renderSequence() {
  $("modal-content").innerHTML =
    `<div class="sequence-presets" role="group" aria-label="콘텐츠 편성">${[["idle", "방치"], ["challenge", "도전"], ["speedrun", "속공"]].map(([id, label]) => `<button data-sequence-preset="${id}" aria-pressed="${sequenceDraftMode === id}">${label}</button>`).join("")}</div><div class="preset-numbers" role="group" aria-label="편성 프리셋">${Array.from({length:10},(_,index) => `<button data-lineup-index="${index}" aria-pressed="${sequenceDraftIndex === index}">${index+1}</button>`).join("")}</div>${advancedContentUnlocked(account) ? `<label class="sequence-gem-label">보석 프리셋 <select id="sequence-gem-preset">${Array.from({length:10},(_,index) => `<option value="${index}" ${sequenceDraftGem === index ? "selected" : ""}>${index+1}</option>`).join("")}</select></label>` : ""}<div class="sequence-list" id="sequence-list" role="list" aria-label="소환 순서">${sequenceDraft.map((id, i) => `<article class="sequence-slot" data-sequence-slot="${i}" tabindex="0" role="listitem" aria-label="${i+1}번 ${names[id] || "빈 슬롯"}, 끌거나 방향키로 순서 이동"><span class="slot-index">${i + 1}</span>${id ? portrait(id) : '<div class="empty-sequence-art"></div>'}<strong>${names[id] || "빈 슬롯"}</strong>${id && !canUseUnit(account, id) ? "<small>2-1에서 사용</small>" : ""}<button class="inspect-button secondary-button" data-replace="${i}" >교체</button></article>`).join("")}</div><span class="sr-only" id="sequence-status" role="status"></span><p class="sequence-hint">${sequenceDraftMode === "idle" ? "골드가 모이면 차례대로 소환합니다. 쿨타임은 건너뜁니다." : "전투에서 사용할 소환 카드의 순서를 정합니다."}</p><div class="modal-footer"><span class="hint">끌어서 순서를 바꿉니다.</span><button class="primary-button" id="apply-sequence">적용</button></div>`;
  bindSequenceDrag($("sequence-list"), (from, to) => {
    if (!moveSequenceItem(sequenceDraft, from, to)) return;
    renderSequence();
    $("sequence-status").textContent = `${from+1}번 동료를 ${to+1}번으로 옮겼습니다.`;
  });
  $("modal-content")
    .querySelectorAll("[data-replace]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const i = Number(b.dataset.replace);
          openModal("동료 선택", "sequence-pick", () => {
            $("modal-content").innerHTML =
              `<div class="collection-grid">${UNITS.filter((u) =>
                canUseUnit(account, u.id),
              )
                .map(
                  (u) =>
                    `<button class="collection-card" data-pick="${u.id}">${rarityBadge(u)}${portrait(u.id)}<strong>${u.name}</strong><span>${u.cost}</span></button>`,
                )
                .join("")}</div><div class="modal-footer"><button class="secondary-button" id="clear-sequence-slot">비우기</button></div>`;
            $("clear-sequence-slot").onclick = () => {
              sequenceDraft[i] = null;
              returnModal("순서", "sequence", renderSequence);
            };
            $("modal-content")
              .querySelectorAll("[data-pick]")
              .forEach(
                (p) =>
                  (p.onclick = () => {
                    sequenceDraft[i] = p.dataset.pick;
                    returnModal("순서", "sequence", renderSequence);
                  }),
              );
          });
        }),
    );
  $("modal-content").querySelectorAll("[data-sequence-preset]").forEach((button) => {
    button.onclick = () => {
      sequenceDrafts[sequenceDraftMode][sequenceDraftIndex] = {sequence:sequenceDraft,gemPreset:sequenceDraftGem};
      sequenceDraftMode = button.dataset.sequencePreset;
      sequenceDraftIndex = sequenceDraftChoices[sequenceDraftMode] ?? 0;
      sequenceDraft = sequenceDrafts[sequenceDraftMode][sequenceDraftIndex].sequence;
      sequenceDraftGem = sequenceDrafts[sequenceDraftMode][sequenceDraftIndex].gemPreset;
      renderSequence();
    };
  });
  $("modal-content").querySelectorAll("[data-lineup-index]").forEach(button => {
    button.onclick = () => {
      sequenceDrafts[sequenceDraftMode][sequenceDraftIndex] = {sequence:sequenceDraft,gemPreset:sequenceDraftGem};
      sequenceDraftIndex = Number(button.dataset.lineupIndex);
      sequenceDraftChoices[sequenceDraftMode] = sequenceDraftIndex;
      sequenceDraft = sequenceDrafts[sequenceDraftMode][sequenceDraftIndex].sequence;
      sequenceDraftGem = sequenceDrafts[sequenceDraftMode][sequenceDraftIndex].gemPreset;
      renderSequence();
    };
  });
  if($("sequence-gem-preset")) $("sequence-gem-preset").onchange = () => sequenceDraftGem = Number($("sequence-gem-preset").value);
  $("apply-sequence").onclick = () => {
    if (!sequenceDraft.every((id) => id === null || canUseUnit(account, id))) {
      toast("숲속 이외 동료는 2-1에서 사용할 수 있습니다.");
      return;
    }
    if (!sequenceDraft.some((id) => ownsUnit(account, id))) {
      toast("동료를 한 명 이상 넣어 주세요.");
      return;
    }
    if (sequenceDraftMode === "idle" && account.earlyGuide?.phase === "idle-defense" && !sequenceDraft.includes("rabbit")) {
      toast("먼저 1-2 방치에서 현재 편성을 확인해 보세요.");
      return;
    }
    if (sequenceDraftMode === "idle" && account.earlyGuide?.phase === "remove-rabbit" && sequenceDraft.includes("rabbit")) {
      toast("토끼 칸의 교체를 눌러 비운 뒤 적용하세요.");
      return;
    }
    const continuingCombat = mode !== "idle" && !!battle && !battle.finished;
    const applied = () => {
      closeModal();
      if (sequenceDraftMode === mode && !continuingCombat) startBattle();
      else updateUi();
      toast(continuingCombat ? "순서는 다음 전투부터 적용됩니다." : `${{ idle: "방치", challenge: "도전", speedrun: "속공" }[sequenceDraftMode]} ${sequenceDraftIndex+1}번 순서를 적용했습니다.`);
    };
    if (hostedMode) {
      void (async () => {
        const envelope = await sendCommand("lineup.set", {
          sequence: sequenceDraft,
          mode: sequenceDraftMode,
          index: sequenceDraftIndex,
          gemPreset: sequenceDraftGem,
        });
        if (envelope) applied();
      })();
      return;
    }
    if (!setSequence(account, sequenceDraft, sequenceDraftMode, sequenceDraftIndex, sequenceDraftGem)) return;
    persist();
    applied();
  };
}
function openCodex(id = null, enemy = false, replace = false) {
  if (id) {
    openModal("도감", "codex", () => renderCodexDetail(id, enemy), { navigation: replace ? "replace" : "push" });
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
    `<div class="collection-toolbar"><strong>동료 <span>${owned} / ${UNITS.length}</span></strong><label>등급 <select id="codex-rarity"><option value="all">전체</option>${RARITIES.map((r) => `<option value="${r.id}" ${codexRarity === r.id ? "selected" : ""}>${r.name}</option>`).join("")}</select></label><button class="secondary-button" id="owned-filter" aria-pressed="${codexOwned === "owned"}">${codexOwned === "owned" ? "보유" : "전체 보기"}</button></div><div class="companion-collection">${units.map((u) => `<button class="companion-tile ${ownsUnit(account, u.id) ? "" : "unowned"}" style="--rarity:${rarityOf(u).color}" data-codex="${u.id}" aria-label="${u.name} ${ownsUnit(account, u.id) ? "보유" : "미보유"}">${rarityBadge(u)}${portrait(u.id)}<strong>${u.name}</strong><small>${ownsUnit(account, u.id) ? `Lv. ${effectiveUnitLevel(account, u.id)}` : "미보유"}</small></button>`).join("") || '<p class="empty-note">해당 동료가 없습니다.</p>'}</div><h3 class="collection-heading">적</h3><div class="collection-grid">${ENEMIES.map((u) => `<button class="collection-card" data-codex="${u.id}" data-enemy="true">${portrait(u.id)}<strong>${u.name}</strong><span>${attributeName(u.attribute)}</span></button>`).join("")}</div>`;
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
function renderCodexDetail(id, enemy) {
  const u = enemy ? getEnemy(id) : companionStats(account, id, mode),
    scale = 1,
    gimmicks = enemyGimmicks(u),
    detailLines = enemy
      ? [
          u.attribute ? `속성 · ${attributeName(u.attribute)}` : "",
          ...gimmicks.lines,
        ].filter(Boolean)
      : [unitSpecialtyText(u, true), ...unitAbilityLines(u)];
  $("modal-content").innerHTML =
    `<div class="codex-layout"><div class="codex-art ${!enemy && !ownsUnit(account, id) ? "unowned" : ""}">${portrait(id)}</div><div class="codex-info">${enemy ? "" : rarityBadge(u)}<h3>${u.name}</h3>${!enemy ? `<span class="collection-state">${ownsUnit(account, id) ? `보유 · Lv. ${effectiveUnitLevel(account, id)}` : "미보유 · 모집에서 획득"} · ${u.theme || "숲"}</span>` : ""}<span class="role-label">${roles[u.role]}</span><p>${u.description || "전투 특성을 살펴보세요."}</p>${detailLines.length ? `<p class="settings-note"><strong>${enemy ? "속성과 특성" : "속성 특성"}</strong><br>${detailLines.join("<br>")}</p>` : ""}<div class="stat-list">${[
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
          `<div class="stat-item">${enemy ? "기본 " : ""}${label}<strong>${value}</strong></div>`,
      )
      .join(
        "",
      )}</div></div></div><div class="codex-picker">${(enemy ? ENEMIES : UNITS).map((u) => `<button class="${u.id === id ? "selected" : ""}" data-detail="${u.id}" aria-label="${u.name}">${portrait(u.id)}</button>`).join("")}<button id="codex-back" aria-label="도감 목록">${icon("book")}</button></div>`;
  $("modal-content")
    .querySelectorAll("[data-detail]")
    .forEach(
      (b) => (b.onclick = () => openCodex(b.dataset.detail, enemy, true)),
    );
  $("codex-back").onclick = () => returnModal("도감", "codex", renderCollection);
}
function renderRecruit(tab = "units") {
  if (!growthUnlocked(account)) {
    if (account.earlyGuide?.phase === "rabbit-recruit") { closeModal(); showEarlyDraw(); }
    else $("modal-content").innerHTML = '<p class="settings-note">미션을 따라 숲길을 탐험해 보세요. 1-2 방치 미션 뒤 일반 모집이 열립니다.</p>';
    return;
  }
  recruitCleanup?.();
  recruitCleanup = null;
  if (tab === "units" && recruitReceipt) {
    showRecruitResult();
    return;
  }
  if (tab === "gems") { openGems(); return; }
  if (account.highestCleared < (bannerById(recruitBanner)?.unlock ?? Infinity)) recruitBanner = "forest";
  $("modal-content").innerHTML = recruitPanel(account, recruitBanner) + `<div class="modal-footer"><span class="resource-inline">${icon("gem")}${fmt(account.diamonds)}</span><button class="secondary-button" id="draw-info">확률</button></div>`;
  $("modal-content").querySelectorAll("[data-banner]").forEach((button) => {
    button.onclick = () => { recruitBanner = button.dataset.banner; renderRecruit(); };
  });
  $("modal-content").querySelectorAll("[data-draw-count]").forEach(button => button.onclick = () => drawCompanions(Number(button.dataset.drawCount)));
  if ($("welcome-draw")) $("welcome-draw").onclick = () => drawCompanions(10,true);
  $("draw-info").onclick = () => openModal("확률", "probability", () => {
    $("modal-content").innerHTML = probabilityPanel(account,recruitBanner);
    $("rates-back").onclick = () => returnModal("모집","recruit",renderRecruit);
  });
}

function drawCompanions(count, free = false) {
  if (recruitReceipt) return;
  if (hostedMode) {
    void sendCommand("recruit.units", { count, free, banner: recruitBanner }).then((envelope) => {
      if (!envelope) return;
      recruitReceipt = { results: envelope.result, count, banner: recruitBanner };
      updateUi();
      showRecruitResult();
    });
    return;
  }
  const results = recruitUnits(account, count, { free, banner: recruitBanner });
  if (!results) {
    toast(account.highestCleared < (bannerById(recruitBanner)?.unlock ?? Infinity) ? "2-1에서 열리는 모집입니다." : "다이아가 부족합니다.");
    return;
  }
  persist();
  recruitReceipt = { results, count, banner: recruitBanner };
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
      recruitBanner = receipt.banner;
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
    `<div class="income-summary"><div>${icon("acorn")}<strong>${fmt((r?.gold || 0) * 3600 / (r?.productionSeconds ?? 120))}</strong><small>도토리 / 시간</small></div><div>${icon("gem")}<strong>${((r?.diamonds || 0) * 3600 / (r?.productionSeconds ?? 120)).toFixed(2)}</strong><small>다이아 / 시간</small></div></div>${
      Object.keys(account.records).length
        ? `<div class="income-list">${STAGES.filter(
            (s) => account.records[s.id],
          )
            .map(
              (s) =>
                `<button class="income-row ${s.id === account.idleStage ? "selected" : ""}" data-idle-stage="${s.id}" style="width:100%"><strong>${stageLabel(s.id)} · ${s.name}</strong><span>${fmt(account.records[s.id].gold * 3600 / (account.records[s.id].productionSeconds ?? 120))} / 시간 ${s.id === account.idleStage ? "✓" : ""}</span></button>`,
            )
            .join("")}</div>`
        : '<p class="empty-note">방치 전투가 끝나면 기록에 따라 재화가 쌓입니다.</p>'
    }<p class="settings-note">다른 전투를 하거나 게임을 닫아도 기록에 따라 쌓입니다.<br>게임을 닫은 동안에는 최대 8시간까지 쌓입니다.</p>`;
  $("modal-content")
    .querySelectorAll("[data-idle-stage]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          settleProduction();
          closeIdleResult();
          const selectedStage = Number(b.dataset.idleStage);
          selectIdleStage(selectedStage, () => {
            renderIncome();
            updateUi();
            if (mode === "idle") {
              stageId = account.idleStage;
              startBattle();
            }
          });
        }),
    );
}
function renderDaily() {
  settleProduction();
  $("modal-content").innerHTML =
    `<div class="speedrun-summary"><span>오늘 최고 기록</span><strong>${account.daily.best === null ? "—" : precise(account.daily.best)}</strong></div><div class="speedrun-summary"><span>보석 조각</span><strong>${speedrunReward(account)}</strong></div>${account.daily.claimed ? '<p class="settings-note">오늘 보상을 받았습니다. 계속 연습할 수 있습니다.</p>' : '<p class="settings-note">원하는 기록이 나오면 보상을 받으세요.<br>보상은 하루에 한 번 받을 수 있습니다.</p>'}<div class="modal-footer"><button class="secondary-button" id="daily-play">${account.daily.claimed ? "연습하기" : "도전"}</button><button class="primary-button" id="daily-claim" ${account.daily.claimed || account.daily.best === null ? "disabled" : ""}>${account.daily.claimed ? "수령 완료" : "보상받기"}</button></div>`;
  $("daily-play").onclick = () => {
    settleProduction();
    closeModal();
    closeIdleResult();
    mode = "speedrun";
    stageId = 1;
    startBattle();
  };
  $("daily-claim").onclick = () => {
    if (hostedMode) {
      claimSpeedrunReward(() => renderDaily());
      return;
    }
    const r = claimSpeedrun(account);
    if (r) {
      persist();
      toast(`보석 조각 +${r}`);
    }
    renderDaily();
    updateUi();
  };
}
async function switchToExistingAccount() {
  try {
    await accountClient.startNewSession("account");
    location.reload();
  } catch (error) {
    showCloudGate({ status: error instanceof SessionReplacedError ? "replaced" : "offline", operation: "start" });
  }
}
async function switchToGuestAccount() {
  try {
    await accountClient.startNewSession("guest");
    location.reload();
  } catch (error) {
    showCloudGate({ status: error instanceof SessionReplacedError ? "replaced" : "offline", operation: "start", error });
  }
}
async function linkGuestAccount() {
  try {
    const envelope = await accountClient.linkAccount();
    cloudIdentity = envelope.identity ?? accountClient.identity;
    toast("계정을 연결했습니다.");
    updateUi();
    renderSettings();
  } catch (error) {
    const code = error?.payload?.error ?? error?.message;
    if (code === "login_required") {
      location.assign("/signin-with-chatgpt?return_to=/");
    } else if (code === "account_exists") {
      const kind = isOnboarding(account) ? "onboarding" : "account-choice";
      openModal("기존 계정", kind, () => {
        $("modal-content").innerHTML = messagePanel({
          text: "이 로그인에는 이미 게임 계정이 있습니다. 게스트 진행도는 남겨 두고 기존 계정을 여기서 엽니다.",
          actions: '<button class="secondary-button" id="cancel-account-choice">취소</button><button class="primary-button" id="use-existing-account">기존 계정으로</button>',
        });
        $("cancel-account-choice").onclick = () => returnModal("설정", "settings", renderSettings);
        $("use-existing-account").onclick = () => switchToExistingAccount();
      });
    } else if (!(error instanceof SessionReplacedError)) {
      toast("계정을 연결하지 못했습니다. 다시 시도해 주세요.");
    }
  }
}
function renderSettings() {
  const hostedAccountRows = hostedMode
    ? `<div class="settings-row"><span>계정</span><strong>${cloudIdentity?.kind === "account" ? "계정" : "게스트"}</strong>${cloudIdentity?.kind === "guest" ? (cloudIdentity?.canLink ? '<button class="secondary-button" id="link-account">계정 연결</button>' : "") : '<button class="secondary-button" id="switch-to-guest">게스트로</button>'}</div>`
    : "";
  $("modal-content").innerHTML =
    `<div class="settings-row"><span>소리</span><button class="secondary-button" id="setting-sound">${account.settings.sound ? "켜짐" : "꺼짐"}</button></div><div class="settings-row"><span>화면</span><button class="secondary-button" id="fullscreen">${icon("fullscreen")}전체 화면</button></div><div class="settings-row"><span>저장 파일</span><div><button class="secondary-button" id="export-save">내려받기</button>${hostedMode ? "" : ' <button class="secondary-button" id="import-save">불러오기</button><input type="file" id="save-file" accept="application/json,.json" hidden>'}</div></div><div class="settings-row"><span>방치 결과</span><button class="secondary-button" id="restore-idle-results" ${account.settings.hiddenIdleResults.length ? "" : "disabled"}>다시 표시</button></div>${hostedAccountRows}<div class="settings-row"><span>계정</span><button class="secondary-button" id="reset-account">계정 초기화</button></div>${hostedMode && cloudBootstrapEnvelope.created ? '<p class="settings-note">새 온라인 계정을 만들었습니다. 기존 브라우저 저장 기록은 그대로 보존됩니다.</p>' : hostedMode ? '<p class="settings-note">진행도는 온라인 계정에 저장됩니다.</p>' : '<p class="settings-note">진행도는 이 브라우저에 저장됩니다.<br>다른 기기로 옮기려면 저장 파일을 사용하세요.</p>'}<p class="settings-note">키보드: 1–9·0 소환 · Space 일시 정지 · Esc 뒤로 / 닫기</p>`;
  if ($("link-account")) $("link-account").onclick = () => linkGuestAccount();
  if ($("switch-to-guest")) $("switch-to-guest").onclick = () => {
    openModal("게스트로 시작", "guest-choice", () => {
      $("modal-content").innerHTML = messagePanel({
        text: "현재 계정은 보존됩니다. 게스트 진행도는 별도로 저장됩니다.",
        actions: '<button class="secondary-button" id="cancel-guest-choice">취소</button><button class="primary-button" id="confirm-guest-choice">게스트로</button>',
      });
      $("cancel-guest-choice").onclick = () => returnModal("설정", "settings", renderSettings);
      $("confirm-guest-choice").onclick = () => switchToGuestAccount();
    });
  };
  $("restore-idle-results").onclick = () => {
    if (hostedMode) {
      void updatePreference({ hiddenIdleResults: [] }).then((ok) => { if (ok) renderSettings(); });
      return;
    }
    account.settings.hiddenIdleResults = [];
    persist();
    renderSettings();
  };
  $("setting-sound").onclick = () => {
    if (hostedMode) {
      const sound = !account.settings.sound;
      void updatePreference({ sound }).then((ok) => {
        if (!ok) return;
        updateUi();renderSettings();chirp();
      });
      return;
    }
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
    const download = () => {
      const blob = new Blob([JSON.stringify(account, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
      a.href = url;
      a.download = "tiny-legion-save.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    if (hostedMode) void settleServer(true).then(download);
    else { settleProduction(); download(); persist(); }
  };
  if (!hostedMode) $("import-save").onclick = () => $("save-file").click();
  $("reset-account").onclick = () => {
    openModal("계정 초기화", "reset-account", () => {
      $("modal-content").innerHTML = messagePanel({ text: "동료·재화·성장·전투 기록을 모두 지우고 0스테이지부터 다시 시작합니다.<br>복구하려면 초기화 전에 저장 파일을 내려받아 두세요.", actions: '<button class="secondary-button" id="cancel-reset-account">취소</button><button class="primary-button" id="confirm-reset-account">초기화하고 시작</button>' });
      $("cancel-reset-account").onclick = () => returnModal("설정", "settings", renderSettings);
      $("confirm-reset-account").onclick = () => {
        if (hostedMode) {
          void sendCommand("account.reset", {}).then((envelope) => {
            if (!envelope) return;
            battleStartSerial++;
            battle = null;
            battleSnapshot = null;
            closeModal(true);closeIdleResult();
            recruitReceipt = null;pendingReturnIncome = null;
            sequenceDraft = null;sequenceDrafts = null;
            codexRarity = "all";codexOwned = "all";
            lastAccrual = Date.now();lastFrame = performance.now();
            resumeOnboarding();
            toast("계정을 초기화했습니다.");
          });
          return;
        }
        const fresh = resetAccount();
        if (!fresh) {
          toast("저장할 수 없어 초기화하지 않았습니다.");
          return;
        }
        closeModal(true);
        closeIdleResult();
        account = fresh;
        recruitReceipt = null;
        pendingReturnIncome = null;
        sequenceDraft = null;
        sequenceDrafts = null;
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
  if (!hostedMode) $("save-file").onchange = async (e) => {
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
          messagePanel({ text: "현재 진행도가 저장 파일의 진행도로 바뀝니다.", actions: '<button class="secondary-button" id="cancel-import">취소</button><button class="primary-button" id="confirm-import">불러오기</button>' });
        $("cancel-import").onclick = () =>
          returnModal("설정", "settings", renderSettings);
        $("confirm-import").onclick = () => {
          recruitReceipt = null;
          pendingReturnIncome = null;
          sequenceDraft = null;
          sequenceDrafts = null;
          closeIdleResult();
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
            resumeEarlyGuide();
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
  const fixedDescription = el.matches(".unit-card[data-unit]");
  const tooltip = $("tooltip");
  const host = fixedDescription ? el.closest(".summon-bar") : document.body;
  host.append(tooltip);
  tooltip.classList.toggle("summon-description", fixedDescription);
  tooltip.style.removeProperty("left");
  tooltip.style.removeProperty("top");
  const labels = new Map(ATTRIBUTES.map((attribute) => [`${attribute.name}특화`, attribute]));
  const pieces = text.split(/(야생특화|기계특화|정령특화|그림자특화)/);
  $("tooltip").replaceChildren(...pieces.map((piece) => {
    const attribute = labels.get(piece);
    if (!attribute) return document.createTextNode(piece);
    const label = document.createElement("strong");
    label.className = "attribute-label";
    label.style.color = attribute.ink;
    label.textContent = piece;
    return label;
  }));
  $("tooltip").hidden = false;
  $("tooltip").dataset.longpress = String(longpress);
  if (fixedDescription) return;
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
  if (el?.contains(e.relatedTarget)) return;
  clearTimeout(tooltipTimer);
  if (el)
    tooltipTimer = setTimeout(() => showTooltip(el, e.clientX, e.clientY), 400);
});
document.addEventListener("pointerout", (e) => {
  if (e.pointerType !== "mouse") return;
  const el = e.target.closest("[data-tip]");
  if (el?.contains(e.relatedTarget)) return;
  hideTooltip();
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
    if (!backModal()) closeModal();
    closeIdleResult();
    hideTooltip();
    return;
  }
  if (!$("modal-backdrop").hidden) {
    if (e.key === "Tab") {
      const focusables = [
        ...$("modal").querySelectorAll(
          "button:not(:disabled),a[href],input:not([hidden]),select:not(:disabled),[tabindex=\"0\"]",
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
$("back-modal").onclick = backModal;
$("close-modal").onclick = () => closeModal();
$("modal-backdrop").onclick = (e) => {
  if (e.target === $("modal-backdrop")) closeModal();
};
$("stage-select").onclick = () =>
  mode === "speedrun"
    ? openModal("속공", "daily", renderDaily)
    : openModal("스테이지", "stages", renderStages);

$("profile-button").onclick = () => openModal("동료", "growth", renderGrowth);
$("start-battle").onclick = () => {
  startBattle();
  chirp();
};
$("pause").onclick = setPaused;
$("leave-battle").onclick = leaveBattle;
$("edit-sequence").onclick = () => {
  openSequence();
};
$("challenge-start").onclick = () => startChallenge();
$("guide-mission").onclick = actOnMission;
$("nav-units").onclick = () => openModal("동료", "growth", renderGrowth);
$("nav-recruit").onclick = () => openModal("모집", "recruit", renderRecruit);
$("nav-codex").onclick = () => openCodex();
$("menu").onclick = () => openModal("메뉴", "menu", renderMenu);
$("close-idle-result").onclick = closeIdleResult;
$("confirm-idle-result").onclick = closeIdleResult;
$("hide-idle-result").onchange = () => {
  if (idleResultStage === null) return;
  const hidden = new Set(account.settings.hiddenIdleResults);
  if ($("hide-idle-result").checked) hidden.add(idleResultStage);
  else hidden.delete(idleResultStage);
  void updatePreference({ hiddenIdleResults: [...hidden] });
};
$("income").onclick = () => openModal("방치", "income", renderIncome);
$("speed").onclick = () => {
  if (mode === "idle" || !battle || battle.finished) return;
  const speed = account.settings.speed === 1 ? 2 : 1;
  void updatePreference({ speed }).then((ok) => { if (ok) updateUi(); });
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
  const actionStep = Math.round(battle.time * 30);
  if (!fireCannon(battle)) return;
  if (hostedMode) logBattleAction({ type: "cannon" }, actionStep);
  renderer.consumeEvents(battle.events.slice(eventCount), battle);
  skillRemaining = 25;
  renderer.burst(700, battle.time);
  chirp("summon");
  updateUi();
};
document.addEventListener("visibilitychange", () => {
  if (hostedMode) {
    if (document.hidden) void settleServer(true);
    else {
      void accountClient.resumeSession().then((envelope) => {
        if (!envelope) return;
        if (mode === "idle" && envelope.returnIncome) {
          idleIncome.gold += envelope.returnIncome.gold ?? 0;
          idleIncome.diamonds += envelope.returnIncome.diamonds ?? 0;
          pendingReturnIncome = envelope.returnIncome;
        }
        lastServerSettle = accountClient.now();
        updateUi();
      }).catch(() => {});
    }
  } else if(document.hidden) settleProduction();
  else {
    const summary = collectReturnIncome(account);
    if(summary) pendingReturnIncome = pendingReturnIncome
      ? {...summary,from:pendingReturnIncome.from,gold:pendingReturnIncome.gold+summary.gold,diamonds:pendingReturnIncome.diamonds+summary.diamonds,seconds:pendingReturnIncome.seconds+summary.seconds,awaySeconds:pendingReturnIncome.awaySeconds+summary.awaySeconds,capped:pendingReturnIncome.capped||summary.capped}
      : summary;
  }
  if (!hostedMode) persist();
  accumulator = 0;
  lastFrame = performance.now();
  updateUi();
});
window.addEventListener("pagehide", () => {
  settleProduction();
  if (!hostedMode) persist();
});
const renderer = new Renderer($("battle-canvas"));
hydrateIcons();
$("brand-icon").innerHTML = portrait("sheep");
createHand();
cloudAppReady = hostedMode;
if (isOnboarding(account)) resumeOnboarding();
else { startBattle(); resumeEarlyGuide(); }
persist();
if (hostedMode && cloudBootstrapEnvelope.created)
  setTimeout(() => toast("새 온라인 계정을 만들었습니다. 기존 브라우저 저장 기록은 그대로 보존됩니다."), 250);
if (loadError)
  setTimeout(
    () =>
      toast("저장 파일을 읽지 못했습니다. 설정에서 파일을 불러올 수 있습니다."),
    900,
  );

function frame(now) {
  if(pendingReturnIncome && !isOnboarding(account) && $("modal-backdrop").hidden && !document.hidden) showReturnIncome();
  const dt = Math.min(0.12, (now - lastFrame) / 1000);
  lastFrame = now;
  const portraitMode = matchMedia(
    "(orientation: portrait) and (max-width: 900px)",
  ).matches;
  const modalPauses = !$("modal-backdrop").hidden && mode !== "idle";
  const shouldAdvance =
    !hostedHalted &&
    !document.hidden &&
    !portraitMode &&
    !paused &&
    !modalPauses &&
    battle &&
    !battle.finished;
  if (shouldAdvance) {
    accumulator += dt * (mode === "idle" ? 1 : account.settings.speed);
    let steps = 0;
    while (accumulator >= 1 / 30 && steps < 8 && battle && !battle.finished) {
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
    !hostedHalted &&
    !paused &&
    !document.hidden &&
    !portraitMode
  )
    startBattle();
  if (!document.hidden && Date.now() - lastAccrual >= 1000) {
    settleProduction();
    if (!hostedMode) persist();
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
}
