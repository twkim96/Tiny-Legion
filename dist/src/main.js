import { mailboxPanel } from "./mailbox-ui.js";
import { OFFLINE_LIMIT_SECONDS } from "./economy.js";
import { bindGameVisibility } from "./app-visibility.js";
import { familyName, attributeLabel } from './character-tags.js';
import { CloudSessionUI } from "./cloud-session-ui.js";
import { idleRecordMarkup } from "./idle-result-ui.js";
import { exportNativeSave, backgroundNativeApp, bindNativeBack, bindNativeExportResults } from "./native-app.js";
import { GameAudio } from "./audio.js";
import { bindRotationPrompt, enterLandscapeFullscreen } from "./fullscreen.js";
import { enemyCombatStats } from "./character-stats.js";
import { signInPath, signInIntent, entryPanel, accountIdentityPanel } from "./sign-in.js";
import { testLoginPanel, bindTestLogin, adminPanel } from "./test-access-ui.js";
import { UNITS, ENEMIES, ATTRIBUTES, NEUTRAL_ATTRIBUTE, getEnemy } from "./characters.js";
import { effectLines } from "./effects.js";
import { effectMarkup } from "./effects-ui.js";
import { attackTypeName } from "./attack-types.js";
import {
  STAGES,
  battleDuration,
  BALANCE_VERSION,
  RARITIES,
  stageLabel,
  bannerById,
} from "./data.js";
import { createBattle, fireCannon, stepBattle, summonUnit } from "./engine.js";
import { icon, portrait } from "./art.js";
import { messagePanel } from "./modal-ui.js";
import { ModalController } from "./modal-controller.js";
import { loadAccount, saveAccount, resetAccount } from "./account-storage.js";
import { drawGem, gemByUid, gemDefinition, gemUpgradeCost, gemRerollCost, gemOptionTier, gemUpgradeMaterials, upgradeGem, rerollGem, equipGem, unequipGem, equippedGemItems, GEM_OPTION_LIMIT } from "./gems.js";
import { gemPage, gemPicker, gemDetail, gemCard, gemRateMarkup } from "./gem-ui.js";
import { bindSequenceDrag, moveSequenceItem } from "./sequence-ui.js";
import { companionPanel } from "./companion-ui.js";
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
  canUseUnit,
  playableSequence,
  sequenceForMode,
  setSequence,
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
  advanceSpeedrun,
  claimSpeedrun,
  speedrunReward,
  speedrunStageRecord,
  speedrunProgress,
  recruitUnits,
  ownsUnit,
  isOnboarding,
  advanceOnboardingBattle,
  recruitOnboardingCompanion,
  finishOnboarding,
  currentMission,
  recordMissionBattle,
  claimMission,
  mailboxEntries,
  claimMail,
  growthUnlocked,
  sequenceUnlocked,
  recruitEarlyRabbit,
} from "./account.js";
import { SPEEDRUN_LIMIT_SECONDS, SPEEDRUN_TARGET_SECONDS, SPEEDRUN_STAGES, speedrunStageReward } from "./speedrun.js";

const hostedMode = globalThis.TINY_LEGION_SERVER === true;
bindRotationPrompt();
const sitesSignedIn = globalThis.TINY_LEGION_SIGNED_IN === true;
const testLoginEnabled = hostedMode && globalThis.TINY_LEGION_TEST_LOGIN === true;
const testLoginRequested = testLoginEnabled && new URL(location.href).searchParams.get("testLogin") === "1";
const loginIntent = hostedMode ? signInIntent(location.href) : null;
let cloudBootstrapEnvelope = null;
let cloudIdentity = null;
let cloudGateRoot = null;
let cloudAppReady = false;
let hostedHalted = false;
let cloudPauseBeforeOffline = null;
const cloudGameHooks = { halt() {}, pause() {}, resume() {} };
const accountClient = hostedMode
  ? new AccountClient({ onState: (state) => showCloudGate(state) })
  : null;

const cloudSessionUI = hostedMode ? new CloudSessionUI({
  client: accountClient, hooks: cloudGameHooks,
  isReady: () => cloudAppReady, getIdentity: () => cloudIdentity, testLoginEnabled,
}) : null;
function ensureCloudGate() {
  return cloudGateRoot = cloudSessionUI?.ensureRoot();
}

function chooseCloudEntry() {
  const root = ensureCloudGate();
  root.hidden = false;
  root.style.display = "grid";
  return new Promise((resolve) => {
    const showEntry = () => {
      root.innerHTML = entryPanel(testLoginEnabled);
      root.querySelector("#entry-guest").onclick = () => resolve("guest");
      root.querySelector("#entry-account").onclick = (event) => {
        if (sitesSignedIn) { event.preventDefault(); resolve("account"); }
      };
      if (testLoginEnabled) root.querySelector("#entry-test").onclick = showTestEntry;
    };
    const showTestEntry = () => {
      root.innerHTML = `<div class="account-entry test-login-entry"><h1>테스트 로그인</h1>${testLoginPanel()}</div>`;
      bindTestLogin(root, accountClient, { onSuccess: resolve, onCancel: showEntry });
    };
    if (testLoginRequested) showTestEntry(); else showEntry();
  });
}

function showCloudGate(state) {
  cloudSessionUI?.show(state);
}

if (hostedMode) {
  ensureCloudGate();
  try {
    if (testLoginRequested || (!accountClient.token && !loginIntent)) {
      const choice = await chooseCloudEntry();
      cloudBootstrapEnvelope = typeof choice === "string" ? await accountClient.startNewSession(choice) : choice;
    } else if (loginIntent === "account") cloudBootstrapEnvelope = await accountClient.startNewSession("account");
    else cloudBootstrapEnvelope = await accountClient.bootstrap();
    if (loginIntent || testLoginRequested) {
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete("login");
      cleanUrl.searchParams.delete("testLogin");
      history.replaceState(null, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    }
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
function attributeName(id, suffix = "") {
  const attribute = attributeById[id] ?? NEUTRAL_ATTRIBUTE;
  return `<strong class="attribute-label" style="color:${attribute.ink ?? "#757b6a"}">${attribute.name}${suffix}</strong>`;
}
function unitSpecialtyText(unit, rich = false) {
  const specialties = Array.isArray(unit.specialties) ? unit.specialties : [];
  if (!specialties.length) return "범용 · 모든 속성에 동일한 기본 성능";
  const attributes = specialties.map((id) => rich ? attributeName(id, "특화") : `${attributeById[id]?.name ?? "무속성"}특화`).join(" · ");
  return attributes;
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
  const limit = battleDuration(stage.id, mode);
  const boundaries = [0, Math.round(limit / 3), Math.round(limit * 2 / 3), limit];
  const phases = ["초반", "중반", "후반"].map((name, index) => ({
    label: `${name} · ${boundaries[index]}–${boundaries[index + 1]}초`,
  }));
  const phaseGroups = phases.map(() => []);
  for (const wave of stage.waves ?? []) {
    const time = Number.isFinite(wave.time) ? wave.time : 0;
    const phaseIndex = time < boundaries[1] ? 0 : time < boundaries[2] ? 1 : 2;
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
let sequenceDraftChoices = null;
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
  restartAt = 0;
let idleResultStage = null;
let idleIncome = { gold: 0, diamonds: 0 };
let toastTimer,
  tooltipTimer,
  longPressTimer,
  lastFrame = performance.now(),
  accumulator = 0,
  lastUi = 0,
  lastAccrual = Date.now(),
  lastSound = 0;
const gameAudio = new GameAudio();
const gameHidden = bindGameVisibility(handleGameVisibility);
let audioPreview = null;
let storageWarning = false;
const modals = new ModalController({
  getElement: $, document, canOpen: canOpenModal, hideTooltip,
  cleanup() { recruitCleanup?.(); recruitCleanup = null; },
});
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
    if (accountClient.status === "auth-required") return null;
    if (error?.payload?.error === "battle_version_mismatch") {
      showBattleUpdate();
      return null;
    }
    if (hostedMode && accountClient.status === "offline")
      showCloudGate({ status: "offline", operation: "command" });
    else toast(error?.message === "account_exists" ? "이미 연결된 계정이 있습니다." : "요청을 처리하지 못했습니다.");
    return null;
  }
}
function showBattleUpdate() {
  openModal("전투 업데이트", "battle-update", () => {
    $("modal-content").innerHTML = messagePanel({
      text: "전투 규칙이 업데이트되어 이번 결과는 저장하지 않았습니다. 기존 진행도와 생산 기록은 보존됩니다.<br>새로고침 후 전투를 다시 시작해 주세요.",
      actions: '<button class="primary-button" id="reload-battle">새로고침</button>',
    });
    $("reload-battle").onclick = () => location.reload();
  });
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
function syncAudio() {
  gameAudio.configure({ ...account.settings.audio, ...audioPreview }, stageId, !gameHidden() && !hostedHalted);
}
function chirp(type = "tap") {
  syncAudio();
  gameAudio.chirp(type);
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
  if (mode === "speedrun") return SPEEDRUN_STAGES.find(stage => stage.id === stageId) ?? SPEEDRUN_STAGES[0];
  return onboardingEncounter(account.onboarding?.phase) ?? (stageId === 2 ? earlyGuideEncounter(account.earlyGuide?.phase, mode) : null) ?? STAGES[stageId - 1] ?? STAGES[0];
}
async function startBattle() {
  if (!isOnboarding(account) && mode === "challenge" && firstIdleMissionPending()) {
    toast("1-1 방치 미션을 완료하고 보상을 받아 주세요.");
    return;
  }
  if (!isOnboarding(account) && mode === "challenge" && !growthUnlocked(account) && stageId > 2) {
    toast("1-2 방치 미션을 먼저 완료하세요.");
    return;
  }
  if (mode === "speedrun" && (!advancedContentUnlocked(account) || stageId > speedrunProgress(account))) {
    toast("먼저 열린 속공 스테이지를 선택하세요.");
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
    if (started.snapshot.balanceVersion !== BALANCE_VERSION) {
      battleStartPending = false;
      showBattleUpdate();
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
    earlyGuidePhase: mode !== "speedrun" && stageId === 2 ? account.earlyGuide?.phase : null,
  });
  idleIncome = { gold: 0, diamonds: 0 };
  battleSnapshot = {
    stageId,
    duration: battle.duration,
    balanceVersion: BALANCE_VERSION,
    levels: { ...levels },
    abilities: structuredClone(account.abilities),
    sequence: playableSequence(account, mode),
    gemEffects: structuredClone(gemModifiers(account, mode)),
    gemEquipment: structuredClone(account.gemEquipment ?? {}),
    dailyKey: account.daily.key,
    speedrunStageId: mode === "speedrun" ? stageId : null,
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
  $("ready-stage").textContent = mode === "speedrun" ? stageLabel(stageId) : stageId === 0 ? "0" : stageLabel(stageId);
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
function showIdleResult(result, previousRecord) {
  if (account.settings.hiddenIdleResults.includes(stageId) || !$("idle-result-popup").hidden) return;
  idleResultStage = stageId;
  const bonus = battleSnapshot.gemEffects?.acorn ?? 1;
  const gold = result.reward * bonus;
  const income = idleIncome;
  $("idle-result-title").textContent = result.won ? "방치 완료" : "방치 실패";
  $("idle-result-content").innerHTML = `<p class="idle-result-stage">${stageLabel(stageId)} · ${precise(result.survival)}</p><p class="settings-note">이 전투 동안 실제 지급된 재화</p><div class="idle-earned"><span>${icon("acorn")}도토리 <strong>+${fmt(income.gold)}</strong></span><span>${icon("gem")}다이아 <strong>+${income.diamonds.toFixed(2)}</strong></span></div>${idleRecordMarkup({ gold, duration: battleSnapshot.duration ?? battleDuration(stageId), previousRecord, icon, fmt })}<p class="settings-note">생산 기록은 즉시 지급되는 보상이 아닙니다.<br>최고 기록에 따라 재화가 계속 쌓이며 방치 전투도 계속 진행됩니다.</p>`;
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
    $("mission-rewards").innerHTML = `<span>${icon("acorn")}${fmt(mission.gold)}</span><span>${icon("gem")}${mission.diamonds}</span>${mission.unitReward ? `<span>${icon("envelope")}${names[mission.unitReward]}</span>` : ""}`;
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
        notifyMissionReward(reward);
      });
      return;
    }
    const reward = claimMission(account);
    if (reward) {
      persist();
      updateUi();
      notifyMissionReward(reward);
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
    $("modal-content").innerHTML = messagePanel({text:"2-2의 적은 훨씬 강해요.<br>보유한 보석의 기본 효과는 항상 적용되고, 추가옵션은 장착한 3개만 적용됩니다.<br>숲의 보물에서 보석을 무료로 모집해 보세요. 속공에서도 보석 조각을 얻습니다.",actions:'<button class="primary-button" id="gem-guide-open">보석 보기</button>'});
    $("gem-guide-open").onclick = openGems;
  });
}
function openGems() {
  if (!advancedContentUnlocked(account)) { toast("2-1을 완료하면 열립니다."); return; }
  openModal("보석", "gems", renderGems);
}
function renderGems() {
  $("modal-content").innerHTML = gemPage(account);
  $("modal-content").querySelectorAll("[data-gem-uid]").forEach(button => button.onclick = () => openGemDetail(button.dataset.gemUid));
  $("modal-content").querySelectorAll("[data-gem-option-pick]").forEach(button => button.onclick = () => openGemPicker());
  if($("gem-free")) $("gem-free").onclick = () => drawResourceGem("diamonds",true);
  $("gem-draw-tickets").onclick = () => drawResourceGem("tickets");
  $("gem-draw-diamonds").onclick = () => drawResourceGem("diamonds");
  $("gem-rates").onclick = () => openModal("확률","probability",() => {
    $("modal-content").innerHTML = `${gemRateMarkup()}<div class="modal-footer"><button class="secondary-button" id="gem-rates-back">돌아가기</button></div>`;
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
  settleProduction();
  const item=drawGem(account,{payment,free});
  if(!item) { toast("모집 재화를 확인해 주세요."); return; }
  persist(); updateUi(); chirp("win"); openGemDetail(item.uid);
}
function commitGemEquip(uid, replaceType = null, returnToDetail = false) {
  const finish = () => {
    toast("추가옵션을 장착했습니다. 다음 전투부터 적용됩니다.");
    if (returnToDetail) returnModal("보석","gem-detail",()=>renderGemDetail(uid));
    else returnModal("보석","gems",renderGems);
  };
  const args = replaceType === null ? { uid } : { uid, replaceType };
  if (hostedMode) {
    void sendCommand("gem.equip", args).then(envelope => {
      if (!envelope) return;
      updateUi();finish();
    });
    return;
  }
  settleProduction();
  if (!equipGem(account,uid,replaceType)) { toast("보석을 장착할 수 없습니다."); return; }
  persist();updateUi();finish();
}
function openGemPicker() {
  openModal("추가옵션 선택","gem-picker",()=>{
    $("modal-content").innerHTML=gemPicker(account);
    $("modal-content").querySelectorAll("[data-gem-equip]").forEach(button=>button.onclick=()=>{
      const uid=button.dataset.gemEquip,item=gemByUid(account,uid),equipped=equippedGemItems(account);
      if (!item) return;
      const replaceType=equipped.find(gem=>gem.type===item.type)?.type ?? null;
      if (equipped.length>=GEM_OPTION_LIMIT && replaceType===null) { openGemReplacePicker(uid); return; }
      commitGemEquip(uid,replaceType);
    });
    $("gem-picker-back").onclick=()=>returnModal("보석","gems",renderGems);
  });
}
function openGemReplacePicker(uid, returnToDetail = false) {
  if (!gemByUid(account,uid) || !equippedGemItems(account).length) return;
  openModal("교체할 추가옵션","gem-picker",()=>{
    $("modal-content").innerHTML=gemPicker(account,uid);
    $("modal-content").querySelectorAll("[data-gem-replace-type]").forEach(button=>button.onclick=()=>commitGemEquip(uid,button.dataset.gemReplaceType,returnToDetail));
    $("gem-picker-back").onclick=()=>{
      if (returnToDetail) returnModal("보석","gem-detail",()=>renderGemDetail(uid));
      else backModal() || returnModal("보석","gems",renderGems);
    };
  });
}
function openGemDetail(uid) {
  if(!gemByUid(account,uid)) return;
  openModal("보석", "gem-detail", () => renderGemDetail(uid));
}
function renderGemDetail(uid) {
  const item=gemByUid(account,uid);
  if(!item) { returnModal("보석","gems",renderGems); return; }
  $("modal-content").innerHTML=gemDetail(account,uid);
  $("gem-back").onclick=()=>returnModal("보석","gems",renderGems);
  const equipButton = $("gem-equip");
  if (equipButton) equipButton.onclick = () => {
    const item=gemByUid(account,uid),equipped=equippedGemItems(account);
    if (item && equipped.length>=GEM_OPTION_LIMIT && !equipped.some(gem=>gem.type===item.type)) {
      openGemReplacePicker(uid,true);return;
    }
    commitGemEquip(uid,null,true);
  };
  $("modal-content").querySelectorAll("[data-detail-unequip]").forEach(unequipButton => unequipButton.onclick = () => {
    const type = unequipButton.dataset.detailUnequip;
    if (hostedMode) {
      void sendCommand("gem.unequip", { type }).then((envelope) => {
        if (!envelope) return;
        updateUi();toast("해제했습니다. 다음 전투부터 적용됩니다.");renderGemDetail(uid);
      });
      return;
    }
    settleProduction();
    if(!unequipGem(account,type)) { toast("보석을 해제할 수 없습니다."); return; }
    persist();updateUi();toast("해제했습니다. 다음 전투부터 적용됩니다.");renderGemDetail(uid);
  });
  $("gem-upgrade").onclick=()=>showGemUpgrade(uid);
  $("gem-reroll").onclick=()=>showGemReroll(uid);
}
function showGemUpgrade(uid) {
  const item=gemByUid(account,uid),cost=gemUpgradeCost(item);
  if(!cost) return;
  const selected=new Set();
  let applied=false;
  openModal("강화 재료", "gem-upgrade",()=>{
    const candidates=gemUpgradeMaterials(account,uid);
    const reserves=account.gemReserves[item.type]??0;
    $("modal-content").innerHTML=`<p class="settings-note">같은 보석 ${cost.copies}개와 도토리 ${fmt(cost.gold)}개가 필요합니다. 선택한 보석은 소모됩니다. 장착 중이거나 강화한 보석은 재료에서 제외합니다.</p><p>이전 보석 재료 ${fmt(reserves)}개</p><div class="gem-grid">${candidates.map(candidate=>gemCard(candidate,"gem-material")).join("")}</div><p id="gem-material-count">선택 0 / ${cost.copies}</p><div class="modal-footer"><button class="secondary-button" id="gem-upgrade-cancel">취소</button><button class="primary-button" id="gem-upgrade-confirm">강화</button></div>`;
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
function showGemReroll(uid) {
  const item=gemByUid(account,uid),cost=gemRerollCost(item),tier=gemOptionTier(item);
  if (!item || !cost || !tier) return;
  let applied=false;
  openModal("추가옵션 재설정", "gem-reroll",()=>{
    const chance=Math.round(tier.promotionChance*100);
    $("modal-content").innerHTML=messagePanel({text:`${gemDefinition(item.type).name} ${tier.name} · ${tier.lines}줄의 옵션을 새로 뽑습니다.<br>도토리 ${fmt(cost)}개를 사용하며, 다음 등급 승급 확률은 ${chance}%입니다.<br>기존 옵션은 새 결과로 바뀌고, 적용은 다음 전투부터입니다.`,actions:'<button class="secondary-button" id="gem-reroll-cancel">취소</button><button class="primary-button" id="gem-reroll-confirm">재설정</button>'});
    $("gem-reroll-cancel").onclick=()=>returnModal("보석","gem-detail",()=>renderGemDetail(uid));
    $("gem-reroll-confirm").onclick=()=>{
      if (applied) return;
      if (hostedMode) {
        applied=true;
        void sendCommand("gem.reroll",{uid}).then(envelope=>{
          if (!envelope) { applied=false;return; }
          updateUi();returnModal("보석","gem-detail",()=>renderGemDetail(uid));chirp();
        });
        return;
      }
      settleProduction();
      if (!rerollGem(account,uid)) { toast("도토리가 부족하거나 재설정할 수 없습니다.");return; }
      applied=true;persist();updateUi();returnModal("보석","gem-detail",()=>renderGemDetail(uid));chirp();
    };
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
    $("modal-content").innerHTML=`<div class="return-income-summary"><p>마지막 접속 ${timestamp}</p><strong>${duration}</strong><div class="result-rewards"><span>${icon("acorn")}+${fmt(summary.gold)}</span><span>${icon("gem")}+${summary.diamonds.toFixed(2)}</span></div><p class="settings-note">재화는 이미 반영되었습니다.${summary.capped ? `<br>최대 ${OFFLINE_LIMIT_SECONDS / 3600}시간의 생산을 반영했어요.` : ""}</p><button class="primary-button" id="return-income-confirm">확인</button></div>`;
    $("return-income-confirm").onclick=()=>closeModal();
  });
}
function notifyMissionReward(reward) {
  const arrived = mailboxEntries(account).some(entry => !entry.claimed && entry.id.startsWith(`mission:${reward.id}:`));
  toast(`도토리 +${fmt(reward.gold)} · 다이아 +${reward.diamonds}${arrived ? " · 동료 보상이 우편함에 도착했어요." : ""}`);
}
function renderMailbox() {
  $("modal-content").innerHTML = mailboxPanel(account);
  $("modal-content").querySelectorAll("[data-mail-claim]").forEach(button => {
    button.onclick = async () => {
      button.disabled = true;
      const reward = hostedMode
        ? (await sendCommand("mail.claim", { id: button.dataset.mailClaim }))?.result
        : claimMail(account, button.dataset.mailClaim);
      if (!reward) { if (modalKind === "mailbox") renderMailbox(); return; }
      if (!hostedMode) persist();
      updateUi();
      toast(reward.isNew ? `${reward.unit.name} 합류` : `${reward.unit.name} · 징표 +${reward.marks}`);
      if (modalKind === "mailbox") renderMailbox();
    };
  });
}
function renderMenu() {
  const tutorial = isOnboarding(account);
  const unlocked = advancedContentUnlocked(account);
  const items = mode !== "idle" ? [["settings", "설정", "settings", true]] : [
    ["mission", "미션", "flag", !tutorial && !!currentMission(account)],
    ["mailbox", `우편함${mailboxEntries(account).some(entry => !entry.claimed) ? " · 새 우편" : ""}`, "envelope", !tutorial],
    ["growth", "동료", "units", !tutorial],
    ["recruit", "모집", "envelope", !tutorial],
    ["codex", "도감", "book", !tutorial],
    ["income", "방치", "leaf", !tutorial],
    ["daily", "속공", "bolt", !tutorial && unlocked],
    ["gems", "보석", "gem", !tutorial && unlocked],
    ["sequence", "순서", "sequence", sequenceUnlocked(account)],
    ["settings", "설정", "settings", true],
  ];
  if (hostedMode && cloudIdentity?.isAdmin) items.push(["admin", "관리자 기능", "settings", true]);
  $("modal-content").innerHTML = `<div class="content-menu-grid">${items.map(([id, title, glyph, enabled]) => `<button class="content-menu-item" data-content-menu="${id}" ${enabled ? "" : "disabled"} aria-label="${title}${enabled ? "" : " 잠김"}"><span>${icon(glyph)}</span><strong>${title}</strong>${!enabled ? `<small>${icon("lock")}${tutorial ? "" : id === "sequence" ? "1-2" : "2-2"}</small>` : ""}</button>`).join("")}</div>`;
  $("modal-content").querySelectorAll("[data-content-menu]").forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.contentMenu;
      if (id === "mission") { closeModal(); actOnMission(); }
      else if (id === "mailbox") openModal("우편함", "mailbox", renderMailbox);
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
      else if (id === "admin") openModal("관리자 기능", "admin", renderAdmin);
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
    const previousRecord = account.records[stageId];
    recordIdle(account, r, battleSnapshot);
    recordMissionBattle(account, { mode, stageId, won: r.won });
    persist();
    showIdleResult(r, previousRecord);
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
  if (mode === "speedrun" && r.won && battleSnapshot.speedrunStageId === stageId) {
    settleProduction();
    if (battleSnapshot.dailyKey === account.daily.key)
      recordSpeedrun(account, stageId, r.time);
    else {
      advanceSpeedrun(account, stageId, r.time);
      toast("새로운 하루가 시작돼 오늘 기록은 저장되지 않았어요.");
    }
  } else if (mode === "speedrun" && r.won) {
    toast("속공 스테이지를 확인하지 못해 기록하지 않았어요.");
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
    idleRecord: account.records[stageId],
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
    showIdleResult(result, before.idleRecord);
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
    toast("새로운 하루가 시작돼 오늘 기록은 저장되지 않았어요.");
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
  onboardingMessage("방치", "1-1을 돌파했어요! 이제 동료가 자동으로 소환되어 40초 동안 성을 지킵니다.<br>전투가 끝나면 생산 기록이 생겨요. 그 기록으로 게임을 꺼도 도토리와 다이아가 쌓입니다.", "방치 시작", () => {
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
function claimSpeedrunReward(speedrunStageId, onClaimed = () => {}) {
  if (hostedMode) {
    void sendCommand("speedrun.claim", { stageId: speedrunStageId }).then((envelope) => {
      if (!envelope) return;
      const reward = envelope.result;
      if (reward) toast(`보석 조각 +${reward}`);
      onClaimed(reward);
      updateUi();
    });
    return;
  }
  const reward = claimSpeedrun(account, speedrunStageId);
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
  const daily = mode === "speedrun";
  const speedrunRecord = daily ? speedrunStageRecord(account, stageId) : null;
  const speedrunRewardCount = daily ? speedrunReward(account, stageId) : 0;
  const targetWon = daily && r.won && r.time <= SPEEDRUN_TARGET_SECONDS;
  const nextSpeedrunAvailable = targetWon && stageId < SPEEDRUN_STAGES.length && speedrunProgress(account) >= stageId + 1;
  const speedrunHint = daily
    ? targetWon
      ? stageId < SPEEDRUN_STAGES.length
        ? `목표 ${precise(SPEEDRUN_TARGET_SECONDS)} 달성 · 다음 스테이지가 열렸어요.`
        : `목표 ${precise(SPEEDRUN_TARGET_SECONDS)} 달성 · 마지막 스테이지예요.`
      : r.won
        ? `목표 ${precise(SPEEDRUN_TARGET_SECONDS)} 안에 다시 클리어하면 다음 스테이지가 열려요.`
        : `${SPEEDRUN_LIMIT_SECONDS}초 안에 성을 무너뜨리면 보석 조각을 받을 수 있어요.`
    : "";
  const rewardMarkup =
      daily && r.won && !speedrunRecord?.claimed && speedrunRewardCount
        ? `<span>${icon("gem")}보석 조각 +${speedrunRewardCount}</span>`
        : r.won && rewards.gold
          ? `<span>${icon("acorn")}+${fmt(rewards.gold)}</span><span>${icon("gem")}+${rewards.diamonds}</span>`
          : "";
  $("battle-result").innerHTML =
    `<div class="result-card">${icon(r.won ? "trophy" : "shield")}<h2>${r.won ? "완료" : "다시 한 번"}</h2><div class="result-time">${precise(r.time)}</div>${rewardMarkup ? `<div class="result-rewards">${rewardMarkup}</div>` : ""}${daily ? `<p class="settings-note">${speedrunHint}</p>` : ""}<div class="result-actions"><button class="secondary-button" id="return-idle">방치로</button>${!r.won || (daily && (!targetWon || speedrunRecord?.claimed)) ? `<button class="secondary-button" id="retry-battle">${daily && speedrunRecord?.claimed ? "연습하기" : "다시 도전"}</button>` : ""}${daily && r.won && !speedrunRecord?.claimed && speedrunRewardCount ? '<button class="primary-button" id="claim-speedrun">보석 조각 받기</button>' : ""}${nextSpeedrunAvailable ? `<button class="primary-button" id="next-speedrun">${stageLabel(stageId + 1)} 속공</button>` : !daily && r.won && stageId < STAGES.length ? `<button class="primary-button" id="next-battle">${stageLabel(stageId + 1)} 도전</button>` : ""}</div>${daily && speedrunRecord?.claimed ? '<div class="new-record">오늘 보상 수령 완료 · 계속 연습할 수 있어요.</div>' : ""}${support}</div>`;
  $("battle-result").hidden = false;
  const completedStageId = stageId;
  $("return-idle").onclick = mode === "challenge" && stageId === 2 && account.earlyGuide?.phase === "idle-defense"
    ? enterSecondIdle
    : mode === "challenge" && r.won && stageId % 10 === 0
      ? () => enterRegionIdle(completedStageId)
      : () => setMode("idle");
  if (!r.won || (daily && !targetWon)) $("retry-battle").onclick = startBattle;
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
          notifyMissionReward(reward);
          showResult(r, rewards);
        });
        return;
      }
      const reward = claimMission(account);
      if (!reward) return;
      persist();
      updateUi();
      notifyMissionReward(reward);
      showResult(r, rewards);
    };
  }
  if ($("next-battle"))
    $("next-battle").onclick = () => startChallenge(stageId + 1);
  if ($("next-speedrun"))
    $("next-speedrun").onclick = () => { stageId += 1; startBattle(); };
  if ($("claim-speedrun"))
    $("claim-speedrun").onclick = () => {
      if (hostedMode) {
        claimSpeedrunReward(stageId, () => { showResult(r, rewards); updateUi(); });
        return;
      }
      const reward = claimSpeedrun(account, stageId);
      if (reward) {
        persist();
        toast(`보석 조각 +${reward}`);
      }
      showResult(r, rewards);
      updateUi();
    };
}
function updateUi() {
  syncAudio();
  const manualCombat = mode !== "idle" && !!battle && !battle.finished;
  $("game").dataset.manualCombat = String(manualCombat);
  $("game").dataset.mode = mode;
  $("challenge-start").hidden = mode !== "idle" || isOnboarding(account);
  $("challenge-start").disabled = firstIdleMissionPending();
  updateMission();
  const unreadMail = mode === "idle" && mailboxEntries(account).some(entry => !entry.claimed);
  $("menu").dataset.unread = String(unreadMail);
  $("menu").setAttribute("aria-label", unreadMail ? "메뉴 · 새 우편" : "메뉴");
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
  $("stage-number").textContent = stageId === 0 ? "0" : stageLabel(stageId);
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
      : clock(battleDuration(stageId, mode));
  $("pause-icon").innerHTML = icon(paused ? "play" : "pause");
  $("pause-text").textContent = paused ? "계속" : "정지";
  $("pause").dataset.tip = paused ? "계속하기" : "일시 정지";
  $("pause").setAttribute("aria-pressed", String(paused));
  $("pause").setAttribute("aria-label", paused ? "계속하기" : "일시 정지");
  $("pause").disabled = !battle || battle.finished;
  const layout = battlefieldLayout(renderer.width, renderer.height);
  const enemyMax =
    battle?.enemyMaxHp ??
    currentStage().enemyHp;
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
          ? speedrunStageRecord(account, stageId).claimed
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
  $("speed").setAttribute("aria-pressed", String(account.settings.speed === 2));
  $("upgrade-dot").hidden = !UNITS.some(
    (u) =>
      ownsUnit(account, u.id) &&
      effectiveUnitLevel(account, u.id) < 100 &&
      account.gold >= levelCost(effectiveUnitLevel(account, u.id)),
  );
}
function canOpenModal(kind) {
  if (["sequence", "sequence-pick"].includes(kind) && !sequenceUnlocked(account)) {
    toast("1-2 방치에서 처음 실패하면 편성 교체가 열립니다.");
    return false;
  }
  if (isOnboarding(account) && !["onboarding", "menu", "settings", "import", "codex", "reset-account", "battle-update", "leave-battle", "guest-choice", "account-choice", "test-login", "admin"].includes(kind)) return false;
  if (modals.kind === "onboarding" && !["onboarding", "battle-update"].includes(kind)) return false;
  return true;
}
function openModal(title, kind, render, options) {
  return modals.open(title, kind, render, options);
}
function backModal() {
  return modals.back();
}
function returnModal(title, kind, render) {
  return modals.returnTo(title, kind, render);
}
function closeModal(force = false) {
  return modals.close(force);
}
function handleAndroidBack() {
  if (!$("modal-backdrop").hidden) {
    if (!backModal()) closeModal();
    hideTooltip();
    return;
  }
  if (!$("idle-result-popup").hidden) { closeIdleResult(); return; }
  void backgroundNativeApp().catch(() => toast("앱을 백그라운드로 보내지 못했습니다."));
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
  $("modal-content").innerHTML = companionPanel(account, id, mode);
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
  sequenceDrafts = Object.fromEntries(["idle", "challenge", "speedrun"].map(id => [id,Array.from({length:10},(_,index) => [...sequenceForMode(account,id,index)] )]));
  sequenceDraftIndex = sequenceDraftChoices[preset] ?? 0;
  sequenceDraft = [...sequenceDrafts[preset][sequenceDraftIndex]];
  openModal("순서", "sequence", renderSequence);
}
function renderSequence() {
  $("modal-content").innerHTML =
    `<div class="sequence-presets" role="group" aria-label="콘텐츠 편성">${[["idle", "방치"], ["challenge", "도전"], ["speedrun", "속공"]].map(([id, label]) => `<button data-sequence-preset="${id}" aria-pressed="${sequenceDraftMode === id}">${label}</button>`).join("")}</div><div class="preset-numbers" role="group" aria-label="편성 프리셋">${Array.from({length:10},(_,index) => `<button data-lineup-index="${index}" aria-pressed="${sequenceDraftIndex === index}">${index+1}</button>`).join("")}</div><div class="sequence-list" id="sequence-list" role="list" aria-label="소환 순서">${sequenceDraft.map((id, i) => `<article class="sequence-slot" data-sequence-slot="${i}" tabindex="0" role="listitem" aria-label="${i+1}번 ${names[id] || "빈 슬롯"}, 끌거나 방향키로 순서 이동"><span class="slot-index">${i + 1}</span>${id ? portrait(id) : '<div class="empty-sequence-art"></div>'}<strong>${names[id] || "빈 슬롯"}</strong>${id && !canUseUnit(account, id) ? "<small>2-1에서 사용</small>" : ""}<button class="inspect-button secondary-button" data-replace="${i}" >교체</button></article>`).join("")}</div><span class="sr-only" id="sequence-status" role="status"></span><p class="sequence-hint">${sequenceDraftMode === "idle" ? "골드가 모이면 차례대로 소환합니다. 쿨타임은 건너뜁니다." : "전투에서 사용할 소환 카드의 순서를 정합니다."}</p><div class="modal-footer"><span class="hint">끌어서 순서를 바꿉니다.</span><button class="primary-button" id="apply-sequence">적용</button></div>`;
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
      sequenceDrafts[sequenceDraftMode][sequenceDraftIndex] = [...sequenceDraft];
      sequenceDraftMode = button.dataset.sequencePreset;
      sequenceDraftIndex = sequenceDraftChoices[sequenceDraftMode] ?? 0;
      sequenceDraft = [...sequenceDrafts[sequenceDraftMode][sequenceDraftIndex]];
      renderSequence();
    };
  });
  $("modal-content").querySelectorAll("[data-lineup-index]").forEach(button => {
    button.onclick = () => {
      sequenceDrafts[sequenceDraftMode][sequenceDraftIndex] = [...sequenceDraft];
      sequenceDraftIndex = Number(button.dataset.lineupIndex);
      sequenceDraftChoices[sequenceDraftMode] = sequenceDraftIndex;
      sequenceDraft = [...sequenceDrafts[sequenceDraftMode][sequenceDraftIndex]];
      renderSequence();
    };
  });
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
        });
        if (envelope) applied();
      })();
      return;
    }
    if (!setSequence(account, sequenceDraft, sequenceDraftMode, sequenceDraftIndex)) return;
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
    detailLines = enemy
      ? [
          u.attribute ? `속성 · ${attributeName(u.attribute)}` : "",
          ...(u.boss ? ["거대 적"] : []),
        ].filter(Boolean)
      : [unitSpecialtyText(u, true)];
  $("modal-content").innerHTML =
    `<div class="codex-layout"><div class="codex-art ${!enemy && !ownsUnit(account, id) ? "unowned" : ""}">${portrait(id)}</div><div class="codex-info">${enemy ? "" : rarityBadge(u)}<h3>${u.name}</h3>${!enemy ? `<span class="collection-state">${ownsUnit(account, id) ? `보유 · Lv. ${effectiveUnitLevel(account, id)}` : "미보유 · 모집에서 획득"} · ${u.theme || "숲"}</span>` : ""}<span class="role-label">${roles[u.role]}</span><p>${u.description || "전투 특성을 살펴보세요."}</p>${detailLines.length ? `<p class="settings-note"><strong>${enemy ? "속성과 특성" : "속성 특성"}</strong><br>${detailLines.join("<br>")}</p>` : ""}${effectMarkup(u)}<div class="stat-list">${[
      ["종족", familyName(u.family)],
      ...(!enemy ? [["속성", attributeLabel(u.attribute)]] : []),
      ["공격 유형", attackTypeName(u.attackType)],
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
          `<div class="stat-item">${enemy && !["공격 유형", "종족", "속성"].includes(label) ? "기본 " : ""}${label}<strong>${value}</strong></div>`,
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
    }<p class="settings-note">다른 전투를 하거나 게임을 닫아도 기록에 따라 쌓입니다.<br>게임을 닫은 동안에는 최대 ${OFFLINE_LIMIT_SECONDS / 3600}시간까지 쌓입니다.</p>`;
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
  const unlocked = speedrunProgress(account);
  $("modal-content").innerHTML = `<p class="settings-note">목표 ${SPEEDRUN_TARGET_SECONDS}초 이내 · 최대 보석 조각 ${speedrunStageReward(SPEEDRUN_TARGET_SECONDS)}개 · ${SPEEDRUN_LIMIT_SECONDS}초 제한</p><div class="speedrun-list">${SPEEDRUN_STAGES.map((stage) => {
    const record = speedrunStageRecord(account, stage.id);
    const reward = speedrunReward(account, stage.id);
    const isUnlocked = stage.id <= unlocked;
    const best = record.best === null ? "기록 —" : `기록 ${precise(record.best)}`;
    const amount = reward ? `보상 ${reward}개` : `최대 ${speedrunStageReward(SPEEDRUN_TARGET_SECONDS)}개`;
    const claim = record.claimed ? "수령 완료" : reward ? "보상받기" : "";
    return `<div class="income-row" style="gap:8px;align-items:center"><button class="${stage.id === stageId && mode === "speedrun" ? "selected" : ""}" data-speedrun-stage="${stage.id}" ${isUnlocked ? "" : "disabled"} style="flex:1;min-width:0;text-align:left;padding:3px 0"><strong>${stageLabel(stage.id)} · ${stage.name}${isUnlocked ? "" : " · 잠김"}</strong><span style="display:block;font-size:10px">${amount} · ${best}${record.claimed && record.practice !== null ? ` · 연습 ${precise(record.practice)}` : ""}</span></button>${reward ? `<button class="${record.claimed ? "secondary-button" : "primary-button"}" data-speedrun-claim="${stage.id}" ${record.claimed ? "disabled" : ""}>${claim}</button>` : ""}</div>`;
  }).join("")}</div>`;
  $("modal-content").querySelectorAll("[data-speedrun-stage]").forEach((button) => {
    button.onclick = () => {
      mode = "speedrun";
      stageId = Number(button.dataset.speedrunStage);
      closeModal();
      closeIdleResult();
      startBattle();
    };
  });
  $("modal-content").querySelectorAll("[data-speedrun-claim]").forEach((button) => {
    button.onclick = () => {
      const selected = Number(button.dataset.speedrunClaim);
      if (hostedMode) {
        claimSpeedrunReward(selected, () => renderDaily());
        return;
      }
      const reward = claimSpeedrun(account, selected);
      if (reward) {
        persist();
        toast(`보석 조각 +${reward}`);
      }
      renderDaily();
      updateUi();
    };
  });
}
async function switchToExistingAccount() {
  try {
    await accountClient.startNewSession("account");
    location.reload();
  } catch (error) {
    showCloudGate({ status: error instanceof SessionReplacedError ? "replaced" : "offline", operation: "start", error });
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
      openModal("계정 연결", "account-choice", () => {
        $("modal-content").innerHTML = messagePanel({
          text: "로그인 후 게스트 진행도를 연결합니다.",
          actions: `<a class="primary-button" href="${signInPath("link")}" target="_top">ChatGPT로 로그인</a>`,
        });
      }, { layout: "message" });
    } else if (code === "account_exists") {
      openModal("기존 계정", "account-choice", () => {
        $("modal-content").innerHTML = messagePanel({
          text: "이 로그인에는 이미 게임 계정이 있습니다. 게스트 진행도는 남겨 두고 기존 계정을 여기서 엽니다.",
          actions: '<button class="secondary-button" id="cancel-account-choice">취소</button><button class="primary-button" id="use-existing-account">기존 계정으로</button>',
        });
        $("cancel-account-choice").onclick = () => returnModal("설정", "settings", renderSettings);
        $("use-existing-account").onclick = () => switchToExistingAccount();
      }, { layout: "message" });
    } else if (!(error instanceof SessionReplacedError)) {
      toast("계정을 연결하지 못했습니다. 다시 시도해 주세요.");
    }
  }
}
function renderTestLogin() {
  if (!testLoginEnabled) return;
  const root = $("modal-content");
  root.innerHTML = testLoginPanel();
  bindTestLogin(root, accountClient, { onSuccess: () => location.reload(), onCancel: () => backModal() });
}
function renderAdmin() {
  if (!hostedMode || !cloudIdentity?.isAdmin) return;
  $("modal-content").innerHTML = adminPanel(account, fmt, icon);
  $("modal-content").querySelectorAll("[data-admin-grant]").forEach(button => {
    button.onclick = async () => {
      if (button.disabled) return;
      button.disabled = true;
      const envelope = await sendCommand("admin.grant", {
        currency: button.dataset.adminGrant, amount: Number(button.dataset.amount),
      });
      if (envelope) {
        updateUi();
        if (modals.kind === "admin") renderAdmin();
      } else button.disabled = false;
    };
  });
}
function audioSettingsMarkup() {
  return [["music", "배경음"], ["sfx", "효과음"]].map(([key, label]) => {
    const settings = account.settings.audio;
    return `<div class="settings-row"><span>${label}</span><div class="audio-controls"><button class="secondary-button" data-audio-toggle="${key}" aria-pressed="${settings[key + 'Enabled']}">${settings[key + 'Enabled'] ? '켜짐' : '꺼짐'}</button><input type="range" data-audio-volume="${key}" aria-label="${label} 볼륨" min="0" max="100" value="${Math.round(settings[key + 'Volume'] * 100)}"><output data-audio-output="${key}">${Math.round(settings[key + 'Volume'] * 100)}%</output></div></div>`;
  }).join('');
}
function bindAudioSettings() {
  const commit = async (patch) => {
    if (hostedMode) {
      const ok = await updatePreference({ audio: patch });
      audioPreview = null;
      syncAudio(); if (ok && modals.kind === 'settings') renderSettings();
      return;
    }
    Object.assign(account.settings.audio, patch); audioPreview = null; persist(); syncAudio(); renderSettings();
  };
  document.querySelectorAll('[data-audio-toggle]').forEach(button => {
    button.onclick = () => { const key = button.dataset.audioToggle + 'Enabled'; void commit({ [key]: !account.settings.audio[key] }); };
  });
  document.querySelectorAll('[data-audio-volume]').forEach(input => {
    input.oninput = () => {
      const value = Number(input.value) / 100, key = input.dataset.audioVolume;
      document.querySelector(`[data-audio-output="${key}"]`).value = `${input.value}%`;
      audioPreview = { [key + 'Volume']: value }; syncAudio();
    };
    input.onchange = () => void commit({ [input.dataset.audioVolume + 'Volume']: Number(input.value) / 100 });
  });
}
function renderSettings() {
  const hostedAccountRows = hostedMode
    ? `<div class="settings-row settings-account"><span>계정</span>${accountIdentityPanel(cloudIdentity)}<div>${cloudIdentity?.kind === "guest" ? `<a class="secondary-button" id="login-account" href="${signInPath()}" target="_top">계정 로그인</a> ${cloudIdentity?.canLink ? '<button class="secondary-button" id="link-account">계정 연결</button>' : ""}` : '<button class="secondary-button" id="switch-to-guest">게스트로</button>'}${testLoginEnabled ? ' <button class="secondary-button" id="test-login">테스트 로그인</button>' : ''}</div></div>`
    : "";
  $("modal-content").innerHTML =
    `${audioSettingsMarkup()}<div class="settings-row"><span>화면</span><button class="secondary-button" id="fullscreen">${icon("fullscreen")}전체 화면</button></div><div class="settings-row"><span>${hostedMode ? "진행도 기록" : "저장 파일"}</span><div><button class="secondary-button" id="export-save">내려받기</button>${hostedMode ? "" : ' <button class="secondary-button" id="import-save">불러오기</button><input type="file" id="save-file" accept="application/json,.json" hidden>'}</div></div>${hostedMode ? '<p class="settings-note">내려받은 파일은 기록 보관용입니다. 이 파일로 온라인 진행도를 복원할 수 없습니다.</p>' : ''}<div class="settings-row"><span>방치 결과</span><button class="secondary-button" id="restore-idle-results" ${account.settings.hiddenIdleResults.length ? "" : "disabled"}>다시 표시</button></div>${hostedAccountRows}<div class="settings-row"><span>계정</span><button class="secondary-button" id="reset-account">계정 초기화</button></div>${hostedMode && cloudBootstrapEnvelope.created ? '<p class="settings-note">새 온라인 계정을 만들었습니다. 기존 브라우저 저장 기록은 그대로 보존됩니다.</p>' : hostedMode ? '<p class="settings-note">진행도는 온라인 계정에 저장됩니다.</p>' : '<p class="settings-note">진행도는 이 브라우저에 저장됩니다.<br>다른 기기로 옮기려면 저장 파일을 사용하세요.</p>'}<p class="settings-note">키보드: 1–9·0 소환 · Space 일시 정지 · Esc 뒤로 / 닫기</p>`;
  if ($("link-account")) $("link-account").onclick = () => linkGuestAccount();
  if (testLoginEnabled) $("test-login").onclick = () => openModal("테스트 로그인", "test-login", renderTestLogin);
  if (hostedMode && $("login-account") && sitesSignedIn) $("login-account").onclick = (event) => {
    event.preventDefault();
    void switchToExistingAccount();
  };
  if ($("switch-to-guest")) $("switch-to-guest").onclick = () => {
    openModal("게스트로 시작", "guest-choice", () => {
      $("modal-content").innerHTML = messagePanel({
        text: "현재 계정은 보존됩니다. 게스트 진행도는 별도로 저장됩니다.",
        actions: '<button class="secondary-button" id="cancel-guest-choice">취소</button><button class="primary-button" id="confirm-guest-choice">게스트로</button>',
      });
      $("cancel-guest-choice").onclick = () => returnModal("설정", "settings", renderSettings);
      $("confirm-guest-choice").onclick = () => switchToGuestAccount();
    }, { layout: "message" });
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
  bindAudioSettings();
  $("fullscreen").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        const result = await enterLandscapeFullscreen();
        if (!result.fullscreen || (!result.landscapeLocked && matchMedia("(orientation: portrait)").matches))
          toast(result.message);
      }
    } catch {
      toast("이 환경에서는 전체 화면을 사용할 수 없습니다.");
    }
  };
  $("export-save").onclick = () => {
    const download = async () => {
      const contents = JSON.stringify(account, null, 2);
      const nativeResult = await exportNativeSave(contents);
      if (nativeResult !== null) {
        if (!nativeResult.cancelled) toast("저장 파일을 내보냈습니다.");
        return;
      }
      const blob = new Blob([contents], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
      a.href = url;
      a.download = "tiny-legion-save.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const failed = () => toast("저장 파일을 내보내지 못했습니다. 다시 시도해 주세요.");
    if (hostedMode) void settleServer(true).then(download).catch(failed);
    else { settleProduction(); persist(); void download().catch(failed); }
  };
  if (!hostedMode) $("import-save").onclick = () => $("save-file").click();
  $("reset-account").onclick = () => {
    openModal("계정 초기화", "reset-account", () => {
      $("modal-content").innerHTML = messagePanel({ text: `동료·재화·성장·전투 기록을 모두 지우고 0스테이지부터 다시 시작합니다.<br>${hostedMode ? "온라인 진행도는 초기화 후 복구할 수 없습니다. 내려받은 파일로도 온라인 진행도를 복원할 수 없습니다." : "복구하려면 초기화 전에 저장 파일을 내려받아 두세요."}`, actions: '<button class="secondary-button" id="cancel-reset-account">취소</button><button class="primary-button" id="confirm-reset-account">초기화하고 시작</button>' });
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
          accrue(imported);
          if (!saveAccount(imported)) {
            toast("저장할 수 없어 불러오지 않았습니다. 현재 진행도는 유지됩니다.");
            return;
          }
          recruitReceipt = null;
          pendingReturnIncome = null;
          sequenceDraft = null;
          sequenceDrafts = null;
          closeIdleResult();
          account = imported;
          storageWarning = false;
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
  syncAudio(); gameAudio.unlock();
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
bindNativeExportResults(status => {
  if (status === 'saved') toast("저장 파일을 내보냈습니다.");
  else if (status === 'cancelled') toast("파일 저장을 취소했습니다.");
  else toast("저장 파일을 내보내지 못했습니다. 다시 시도해 주세요.");
});
bindNativeBack(handleAndroidBack);
document.addEventListener("keydown", (e) => {
  syncAudio(); gameAudio.unlock();
  if (e.key === "Escape") {
    if (!backModal()) closeModal();
    closeIdleResult();
    hideTooltip();
    return;
  }
  if (!$("modal-backdrop").hidden) {
    modals.trapFocus(e);
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    setPaused();
  }
  if (/^[0-9]$/.test(e.key) && !e.repeat)
    manualSummon(handUnits()[e.key === "0" ? 9 : Number(e.key) - 1]);
});
modals.bindControls();
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
function handleGameVisibility(visible) {
  if (hostedMode) {
    if (!visible) void settleServer(true);
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
  } else if(!visible) settleProduction();
  else {
    const summary = collectReturnIncome(account);
    if(summary) pendingReturnIncome = pendingReturnIncome
      ? {...summary,from:pendingReturnIncome.from,gold:pendingReturnIncome.gold+summary.gold,diamonds:pendingReturnIncome.diamonds+summary.diamonds,seconds:pendingReturnIncome.seconds+summary.seconds,awaySeconds:pendingReturnIncome.awaySeconds+summary.awaySeconds,capped:pendingReturnIncome.capped||summary.capped}
      : summary;
  }
  if (!hostedMode) persist();
  accumulator = 0;
  lastFrame = performance.now();
  syncAudio();
  updateUi();
}
window.addEventListener("pagehide", () => {
  gameAudio.stop();
  settleProduction();
  if (!hostedMode) persist();
});
const renderer = new Renderer($("battle-canvas"));
hydrateIcons();
$("brand-icon").innerHTML = portrait("sheep");
createHand();
cloudAppReady = hostedMode;
if (loginIntent === "link") setTimeout(() => void linkGuestAccount(), 0);
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
  if(pendingReturnIncome && !isOnboarding(account) && $("modal-backdrop").hidden && !gameHidden()) showReturnIncome();
  const dt = Math.min(0.12, (now - lastFrame) / 1000);
  lastFrame = now;
  const portraitMode = matchMedia(
    "(orientation: portrait) and (max-width: 900px)",
  ).matches;
  const modalPauses = !$("modal-backdrop").hidden && mode !== "idle";
  const shouldAdvance =
    !hostedHalted &&
    !gameHidden() &&
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
    !gameHidden() &&
    !portraitMode
  )
    startBattle();
  if (!gameHidden() && Date.now() - lastAccrual >= 1000) {
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
