import { characterName, specialtyText } from './ui-components.js';
import { GOLD_PER_SECOND } from './engine.js';
import { icon, portrait } from './art.js';
import { UNITS, battleDuration, stageLabel } from './data.js';
import { gameUiState, MODES } from './navigation-ui.js';
import { combatPower, isOnboarding, sequenceUnlocked, ownsUnit, effectiveUnitLevel, levelCost, speedrunStageRecord, currentMission } from './account.js';
import { battlefieldLayout } from './combat-visuals.js';

const unitById = Object.fromEntries(UNITS.map(unit => [unit.id, unit]));
const names = Object.fromEntries(UNITS.map(unit => [unit.id, characterName(unit.id, { short: true })]));
const fmt = value => Math.floor(value).toLocaleString('ko-KR');
const clock = seconds => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;

export function summonHandMarkup(sequence) {
  return sequence
    .map((id, index) => {
      const unit = unitById[id];
      if (!unit) return `<button class="unit-card empty-slot" data-index="${index}" disabled aria-label="${index + 1}번 빈 슬롯"><span class="unit-card-number">${index + 1}</span></button>`;
      const tip = [
        unit.description,
        specialtyText(unit),
      ]
        .filter(Boolean)
        .join(" · ");
      return `<button class="unit-card" data-unit="${id}" data-index="${index}" aria-label="${unit.name} 소환" data-tip="${unit.name} · ${tip}"><span class="unit-card-number">${index + 1}</span>${portrait(id)}<span class="unit-auto" aria-hidden="true" hidden>${icon("auto")}<b>자동</b></span><span class="unit-card-text"><span class="unit-card-name">${names[id]}</span><span class="unit-cost">${icon("coin")}${unit.cost}</span></span><span class="unit-cooldown" hidden></span><span class="unit-cooldown-text"></span></button>`;
    })
    .join("");
}

export function updateHud($, { account, mode, battle, stageId, paused, waiting, skillRemaining, stage, width, height, isAdmin = false }) {
  const ui = gameUiState({ account, mode, battle, isAdmin });
  const { manualCombat } = ui;
  $("game").dataset.manualCombat = String(manualCombat);
  $("game").dataset.mode = mode;
  $("challenge-start").hidden = mode !== "idle" || isOnboarding(account);
  $("challenge-start").disabled = currentMission(account)?.id === "idle-intro";
  const unreadMail = mode === "idle" && ui.unreadMail;
  $("menu").dataset.unread = String(unreadMail);
  $("menu").setAttribute("aria-label", unreadMail ? "메뉴 · 새 우편" : "메뉴");
  for (const [id, visible] of Object.entries(ui.toolbar)) $(id).hidden = !visible;
  $("profile-button").hidden = !ui.profileVisible;
  $("income").hidden = !ui.incomeVisible;
  $("stage-chevron").hidden = manualCombat;
  $("skill").hidden = mode === "idle";
  $("gold").textContent = fmt(account.gold);
  $("diamonds").textContent = fmt(account.diamonds);
  $("combat-power").textContent = fmt(combatPower(account));
  $("stage-number").textContent = stageId === 0 ? "0" : stageLabel(stageId);
  $("stage-name").textContent = stage.regionName ?? "초원";
  $("current-mode").textContent = MODES[mode].label;
  $("current-mode-icon").innerHTML = icon(MODES[mode].glyph);
  $("battle-time").textContent = battle
    ? clock(mode === "idle" ? battle.duration - battle.time : battle.time)
    : mode !== "idle"
      ? "00:00"
      : clock(battleDuration(stageId, mode));
  $("pause-icon").innerHTML = icon(paused ? "play" : "pause");
  $("pause-text").textContent = paused ? "계속" : "정지";
  $("pause").dataset.tip = paused ? "계속하기" : "일시 정지";
  $("pause").setAttribute("aria-pressed", String(paused));
  $("pause").setAttribute("aria-label", paused ? "계속하기" : "일시 정지");
  $("pause").disabled = !battle || battle.finished;
  const layout = battlefieldLayout(width, height);
  const enemyMax =
    battle?.enemyMaxHp ??
    stage.enemyHp;
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
  const waves = stage.waves ?? [];
  const waveCount = Math.max(1, waves.length);
  const arrived = waves.filter(wave => wave.time <= (battle?.time ?? 0)).length;
  $("wave-progress").textContent = `${Math.max(1, Math.min(waveCount, arrived))} / ${waveCount}`;
  $("battle-gold").textContent = fmt(battle?.gold ?? 220);
  $("wallet-fill").style.width = `${Math.max(0, Math.min(100, (battle?.gold ?? 220) / (battle?.maxGold ?? 1000) * 100))}%`;
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
    if (next) note = `${names[next.id]} · ${Math.ceil(Math.max(0, next.cost - battle.gold) / (GOLD_PER_SECOND * (battle._modifiers?.goldIncome ?? 1)))}초`;
  }
  if (mode === "idle" && battle?.finished) note = "기록 저장";
  if (isOnboarding(account) && !battle?.finished) {
    const phase = account.onboarding.phase;
    if (phase === "intro") note = battle?.units.some((u) => u.team === "player") ? "적 성을 무너뜨리세요" : "양 방패 카드를 눌러 소환하세요";
    else if (phase === "first-battle") note = "양 방패로 적 성에 도전하세요";
    else if (phase === "retry-battle") note = battle?.units.some((u) => u.id === "sheep" && u.team === "player" && !u.dead) ? "골드를 모아 다람쥐도 소환하세요" : "양 방패를 먼저 소환하세요";
  }
  if (!isOnboarding(account) && stageId === 2) {
    if (mode === "challenge" && account.earlyGuide?.phase === "wall-battle") note = "증원이 몰려오기 전에 튼튼한 적 성을 공략하세요";
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
      btn.querySelector(".unit-auto").hidden = mode !== "idle";
      const cd = battle?.cooldowns?.[u.id] || 0;
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
