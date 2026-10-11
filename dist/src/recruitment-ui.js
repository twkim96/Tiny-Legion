import { UNITS, RARITIES, RECRUIT_BANNERS, bannerById, bannerPool, bannerRarities, ATTRIBUTES } from "./data.js";
import { portrait, icon } from "./art.js";
import { RECRUIT_COSTS } from "./account.js";
export const rarityOf = (unit) =>
  RARITIES.find((rarity) => rarity.id === unit.rarity) ?? RARITIES[0];
export const rarityBadge = (unit) =>
  `<span class="rarity-badge" style="--rarity:${rarityOf(unit).color}">${rarityOf(unit).name}</span>`;
export function recruitPanel(account, bannerId = "forest") {
  const banner = bannerById(bannerId) ?? RECRUIT_BANNERS[0];
  const attribute = ATTRIBUTES.find((item) => item.id === banner.attribute);
  const rates = bannerRarities(banner.id);
  return `<div class="banner-picker">${RECRUIT_BANNERS.map((item) => `<button class="secondary-button ${item.id === banner.id ? "selected" : ""}" data-banner="${item.id}" ${account.highestCleared < item.unlock ? "disabled" : ""}>${account.highestCleared < item.unlock ? icon("lock") : ""}${item.name}${account.highestCleared < item.unlock ? "<small>2-1에서 열림</small>" : ""}</button>`).join("")}</div><div class="companion-recruit" style="--banner-accent:${attribute.color}"><div class="recruit-showcase"><span class="summon-spark spark-one">✧</span><span class="summon-spark spark-two">✦</span><div class="summon-portal"></div>${portrait(banner.featured[0], "showcase-left")}${portrait(banner.featured[1], "showcase-main")}${portrait(banner.featured[2], "showcase-right")}<span class="showcase-title">${banner.name}</span><span class="banner-specialty">${attribute.name} 특화(${attribute.colorName})</span></div><div class="recruit-console"><div class="rarity-legend">${rates.map((r) => `<span style="--rarity:${r.color}">${r.name}<strong>${Math.round(r.rate * 100)}%</strong></span>`).join("")}</div><div class="pity-row"><span>희귀 이상 <strong>${10 - account.recruitment.sinceRare}회 이내</strong></span><span>영웅 이상 <strong>${50 - account.recruitment.sinceEpic}회 이내</strong></span></div><div class="recruit-buttons"><button class="secondary-button" data-draw-count="1" ${account.diamonds < RECRUIT_COSTS[1] ? "disabled" : ""}>1회 ${icon("gem")}${RECRUIT_COSTS[1]}</button><button class="primary-button" data-draw-count="10" ${account.diamonds < RECRUIT_COSTS[10] ? "disabled" : ""}>10회 ${icon("gem")}${RECRUIT_COSTS[10]}</button></div>${!account.recruitment.welcomeClaimed ? '<button class="welcome-draw" id="welcome-draw">첫 만남 · 무료 10회</button>' : ""}<span class="recruit-total">누적 ${account.recruitment.total}회</span></div></div>`;
}
export function probabilityPanel(account, bannerId = "forest") {
  const banner = bannerById(bannerId) ?? RECRUIT_BANNERS[0];
  const rates = bannerRarities(banner.id);
  return `<h3>${banner.name}</h3><div class="rate-table">${rates.map((r) => {
    const pool = bannerPool(banner.id).filter((u) => u.rarity === r.id);
    return `<section><h3 style="color:${r.color}">${r.name}<span>${Math.round(r.rate * 100)}%</span></h3>${pool.map((u) => `<div><span>${u.name}</span><strong>${((r.rate * 100) / pool.length).toFixed(2)}%</strong></div>`).join("")}</section>`;
  }).join("")}</div><p class="settings-note">선택한 모집의 기본 확률입니다. 같은 등급 안에서 동료별 확률은 같습니다.${banner.id === "forest" ? "<br>숲속 모집에는 전설이 없으며 영웅 확률은 12%입니다." : ""}<br>희귀 이상 10회 이내, 영웅 이상 50회 이내 보장. 보장 회차에서 일반 결과는 희귀로, 영웅 보장 회차의 일반·희귀 결과는 영웅으로 올라갑니다. 해당 등급 이상을 얻으면 횟수가 초기화됩니다. 모집을 바꿔도 보장 횟수는 이어집니다.<br>첫 획득은 동료를 해금하고 중복은 조각 1개를 줍니다. 같은 동료 조각 3개로 특별강화합니다. 무료 10회는 계정당 한 번이며 선택한 모집에서 지급됩니다.</p><div class="modal-footer"><span>희귀 ${account.recruitment.sinceRare}/10 · 영웅 ${account.recruitment.sinceEpic}/50</span><button class="secondary-button" id="rates-back">돌아가기</button></div>`;
}
// Rewards are already stored before this runs. Cancelling the scene never cancels ownership.
export function revealRecruit(root, results, { done, again, inspect, sound }) {
  let timers = [],
    alive = true;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.innerHTML = `<div class="draw-scene"><div class="draw-heading"><strong>동료 모집</strong><button class="secondary-button" id="draw-skip">모두 보기</button></div><div class="draw-grid ${results.length === 1 ? "single-draw" : ""}">${results.map((r, index) => `<button class="draw-card sealed" data-reveal="${index}" style="--rarity:${rarityOf(r.unit).color}" aria-label="${index + 1}번째 동료 공개"><span class="card-seal">${icon("envelope")}<small>열기</small></span><span class="card-revealed">${rarityBadge(r.unit)}${portrait(r.unit.id)}<strong>${r.unit.name}</strong><small>${r.isNew ? "NEW" : "조각 +1"}${r.guaranteed ? " · 보장" : ""}</small></span></button>`).join("")}</div><div class="draw-actions"><button class="secondary-button" id="draw-again" disabled>한 번 더</button><button class="primary-button" id="draw-done" disabled>확인</button></div><span class="draw-status" role="status" aria-live="polite">동료를 만나고 있습니다.</span></div>`;
  const cards = [...root.querySelectorAll("[data-reveal]")];
  const reveal = (index) => {
    if (!alive || !cards[index].classList.contains("sealed")) return;
    const r = results[index];
    cards[index].classList.remove("sealed");
    cards[index].classList.add("revealed");
    cards[index].setAttribute(
      "aria-label",
      `${rarityOf(r.unit).name} ${r.unit.name}, ${r.isNew ? "새 동료" : "조각 1개"}. 자세히`,
    );
    if (["epic", "legendary"].includes(r.unit.rarity))
      cards[index].classList.add("special-reveal");
    if (cards.every((c) => !c.classList.contains("sealed"))) {
      root.querySelector("#draw-done").disabled = false;
      root.querySelector("#draw-again").disabled = false;
      root.querySelector(".draw-status").textContent =
        `${results.filter((r) => r.isNew).length}명의 새 동료를 만났습니다.`;
      const skip = root.querySelector("#draw-skip");
      const moveFocus = document.activeElement === skip;
      skip.hidden = true;
      if (moveFocus) root.querySelector("#draw-done").focus();
      sound?.();
    }
  };
  cards.forEach((card, index) => {
    card.onclick = () =>
      card.classList.contains("sealed")
        ? reveal(index)
        : inspect(results[index].unit.id);
    timers.push(
      setTimeout(() => reveal(index), reduced ? 0 : 500 + index * 180),
    );
  });
  root.querySelector("#draw-skip").onclick = () => {
    timers.forEach(clearTimeout);
    cards.forEach((_, i) => reveal(i));
  };
  root.querySelector("#draw-done").onclick = done;
  root.querySelector("#draw-again").onclick = again;
  return () => {
    alive = false;
    timers.forEach(clearTimeout);
    timers = [];
  };
}
