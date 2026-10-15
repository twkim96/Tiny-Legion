import { GEM_BANNERS, GEM_OPTIONS, GEM_OPTION_LIMIT, GEM_OPTION_TIERS, GEM_TYPES, equippedGemItems, gemByUid, gemDefinition, gemDescription, gemOptionText, gemOptionTier, gemRerollCost, gemUpgradeCost, isGemEquipped, ownedGemBasics } from "./gems.js";
import { icon } from "./art.js";

const fmt = value => Math.floor(value).toLocaleString("ko-KR");
const upgradeChance = cost => cost.successChance === 1 ? "확정" : `${Math.round(cost.successChance * 100)}%`;
export function gemArt(type) {
  return `<span class="gem-art" style="color:${gemDefinition(type)?.color ?? "#b7a25d"}">${icon("gem")}</span>`;
}
export function gemCard(item, attribute = "gem-uid", account = null) {
  const equipped = account && isGemEquipped(account, item.uid);
  return `<button class="gem-card ${equipped ? "equipped" : ""}" data-${attribute}="${item.uid}">${gemArt(item.type)}<strong>${gemDefinition(item.type)?.name ?? item.type}</strong><span>Lv. ${item.level} · ${gemOptionTier(item).name}</span>${equipped ? '<small class="gem-equipped-state">추가옵션 장착 중</small>' : ""}<span class="gem-card-options">${item.options.map(gemOptionText).join("<br>") || "추가옵션 없음"}</span></button>`;
}
function equippedBox(item, index) {
  return item
    ? `<button class="gem-option-slot is-filled" data-gem-uid="${item.uid}" aria-label="추가옵션 ${index + 1}: ${gemDefinition(item.type)?.name ?? item.type} 교체 또는 상세 보기">${gemArt(item.type)}<strong>${gemDefinition(item.type)?.name ?? item.type}</strong><span>${item.options.map(gemOptionText).join(" · ") || "추가옵션 없음"}</span><small>상세 보기 · 교체</small></button>`
    : `<button class="gem-option-slot is-empty" data-gem-option-pick="" aria-label="추가옵션 ${index + 1} 장착">+ 추가옵션 장착</button>`;
}
export function gemPage(account) {
  const equipped = equippedGemItems(account);
  const options = Array.from({ length: GEM_OPTION_LIMIT }, (_, i) => equippedBox(equipped[i], i)).join("");
  const basics = ownedGemBasics(account);
  const visibleTypes = GEM_TYPES.filter(type => !type.legacy || basics.some(item => item.type === type.id));
  const collection = visibleTypes.map(type => {
    const item = basics.find(gem => gem.type === type.id);
    const current = equipped.find(gem => gem.type === type.id);
    return `<article class="gem-type-card ${current ? "is-equipped" : ""} ${item ? "has-basic" : "is-unowned"}">${gemArt(type.id)}<strong>${type.name}</strong><span class="gem-type-effect">${item ? `${gemDescription(item)} · 항상 적용` : "미보유 · 효과 없음"}</span>${item ? `<button class="gem-type-instance" data-gem-uid="${item.uid}">최고 Lv. ${item.level} · 기본 효과</button>${current ? '<small class="gem-equipped-state">추가옵션 장착 중</small>' : ""}` : '<span class="gem-unowned-label">미보유</span>'}</article>`;
  }).join("");
  return `<section class="gem-option-equipment"><div class="gem-section-heading"><div><h3>추가옵션 장착 <span>${equipped.length}/${GEM_OPTION_LIMIT}</span></h3><p>빈 칸을 누르면 보유 보석 전체에서 고릅니다.</p></div></div><div class="gem-option-slots">${options}</div><p class="settings-note gem-equipment-note">보유한 보석의 기본 효과는 항상 적용됩니다. 추가옵션은 장착한 3개만 적용됩니다. 같은 종류는 하나만 장착하며, 장착 효과는 모든 전투 모드의 다음 전투부터 반영됩니다.</p></section><section class="gem-basics"><h3>보유 보석의 기본 효과</h3><div class="gem-type-grid">${collection}</div></section><div class="gem-banner"><div><h3>${GEM_BANNERS[0].name}</h3><p>${GEM_BANNERS[0].description ?? "전투 골드와 도토리를 모으는 재화 보석입니다."}</p></div><div class="gem-draw-actions">${!account.gemWelcomeClaimed ? '<button class="primary-button" id="gem-free">1회 무료</button>' : ""}<button class="secondary-button" id="gem-draw-tickets" ${account.tickets<5 ? "disabled" : ""}>조각 5 · 모집</button><button class="secondary-button" id="gem-draw-diamonds" ${account.diamonds<30 ? "disabled" : ""}>${icon("gem")}30 · 모집</button><button class="inspect-button" id="gem-rates">확률</button></div></div><h3 class="collection-heading">보유 보석 ${account.gemItems.length}</h3><div class="gem-grid">${account.gemItems.map(item => gemCard(item, "gem-uid", account)).join("") || '<p class="settings-note">보석을 모집해 기본 효과와 추가옵션을 모아 보세요.</p>'}</div>${Object.entries(account.gemReserves ?? {}).some(([,n])=>n>0) ? `<p class="settings-note">이전 보석 재료 · ${Object.entries(account.gemReserves).filter(([,n])=>n>0).map(([type,n])=>`${gemDefinition(type)?.name ?? type} ${fmt(n)}`).join(" · ")}</p>` : ""}<div class="modal-footer"><span>${icon("acorn")}${fmt(account.gold)}</span><span>${icon("gem")}${fmt(account.diamonds)} · 보석 조각 ${fmt(account.tickets)}</span></div>`;
}
export function gemPicker(account, replaceUid = null) {
  const equipped = equippedGemItems(account);
  const candidate = gemByUid(account, replaceUid);
  const items = candidate ? equipped : account.gemItems ?? [];
  return `<div class="gem-picker-heading"><strong>${candidate ? "교체할 추가옵션 선택" : "추가옵션 선택"}</strong></div><p class="settings-note">${candidate ? `${gemDefinition(candidate.type)?.name ?? candidate.type} 보석을 선택한 칸과 바로 교체합니다.` : "보유한 모든 종류에서 선택할 수 있습니다. 같은 종류는 한 칸만 사용합니다."}</p><div class="gem-grid">${items.map(item => candidate
    ? `<button class="gem-card equipped" data-gem-replace-type="${item.type}">${gemArt(item.type)}<strong>${gemDefinition(item.type)?.name ?? item.type}</strong><span>교체할 현재 칸 · ${item.options.length}줄</span><span class="gem-card-options">${item.options.map(gemOptionText).join("<br>") || "추가옵션 없음"}</span></button>`
    : `<button class="gem-card ${isGemEquipped(account, item.uid) ? "equipped" : ""}" data-gem-equip="${item.uid}">${gemArt(item.type)}<strong>${gemDefinition(item.type)?.name ?? item.type}</strong><span>Lv. ${item.level} · ${gemOptionTier(item).name}${isGemEquipped(account, item.uid) ? " · 장착 중" : ""}</span><span class="gem-card-options">${item.options.map(gemOptionText).join("<br>") || "추가옵션 없음"}</span></button>`
  ).join("") || '<p class="settings-note">보유한 보석이 없습니다.</p>'}</div><div class="modal-footer"><button class="secondary-button" id="gem-picker-back">${candidate ? "돌아가기" : "보석 목록"}</button></div>`;
}
export function gemDetail(account, uid) {
  const item = gemByUid(account, uid);
  if (!item) return "";
  const basic = ownedGemBasics(account).find(gem => gem.type === item.type);
  const cost = gemUpgradeCost(item);
  const tier = gemOptionTier(item);
  const rerollCost = gemRerollCost(item);
  const equipped = isGemEquipped(account, uid);
  const full = equippedGemItems(account).length >= GEM_OPTION_LIMIT;
  const sameType = equippedGemItems(account).find(gem => gem.type === item.type && gem.uid !== uid);
  const equipAction = equipped
    ? `<button class="secondary-button" id="gem-unequip" data-detail-unequip="${item.type}">추가옵션 해제</button>`
    : `<button class="secondary-button" id="gem-equip" data-detail-equip="${uid}">${sameType ? "같은 종류 교체" : full ? "다른 칸과 교체" : "추가옵션 장착"}</button>`;
  return `<div class="gem-detail-heading">${gemArt(item.type)}<div><h3>${gemDefinition(item.type)?.name ?? item.type}</h3><strong>Lv. ${item.level} / 10 · ${tier.name}</strong><p>보유 기본 효과 · 최고 Lv. ${basic?.level ?? item.level} ${gemDescription(basic ?? item)}</p></div></div><h4>추가옵션 · ${tier.lines}줄</h4>${item.options.length ? `<ul class="gem-options">${item.options.map(option => `<li>${gemOptionText(option)}</li>`).join("")}</ul>` : '<p class="settings-note">추가옵션 없음</p>'}<div class="gem-option-tier-info"><strong>${tier.name} · ${tier.lines}줄</strong><span>${icon("acorn")} 재설정 ${fmt(rerollCost ?? 0)}</span><span>승급 ${Math.round(tier.promotionChance * 100)}%</span></div><div class="gem-equip-actions">${equipAction}</div><div class="gem-growth-actions"><button class="primary-button" id="gem-reroll">재설정 · ${icon("acorn")}${fmt(rerollCost ?? 0)}</button><button class="secondary-button" id="gem-upgrade" ${!cost ? "disabled" : ""}>${cost ? `강화 Lv. ${item.level + 1} · 같은 보석 ${cost.copies}개 + ${icon("acorn")}${fmt(cost.gold)} · ${upgradeChance(cost)}` : "강화 완료"}</button></div><p class="settings-note">재설정은 옵션을 새로 뽑으며 같은 등급을 유지하거나 한 단계 승급합니다. 승급하면 옵션 줄 수도 늘어날 수 있습니다. 보석 레벨 강화는 옵션 등급·수치를 유지합니다.</p><div class="modal-footer"><button class="secondary-button" id="gem-back">보석 목록</button><span>${icon("acorn")}${fmt(account.gold)}</span></div>`;
}
export function gemRateMarkup() {
  const upgrades = Array.from({ length: 9 }, (_, index) => {
    const level = index + 1, cost = gemUpgradeCost({ level });
    return `<p>Lv. ${level} → Lv. ${level + 1} · 같은 보석 ${cost.copies}개 · ${fmt(cost.gold)} · ${upgradeChance(cost)}</p>`;
  }).join("");
  return `<h3>${GEM_BANNERS[0].name}</h3><div class="income-list">${GEM_BANNERS[0].types.map(type => `<div class="income-row"><strong>${gemDefinition(type).name}</strong><span>25%</span></div>`).join("")}</div><p class="settings-note">모집 보석은 일반 등급 1줄 옵션입니다. 재설정은 보석 등급별 비용으로 진행하며, 승급 확률은 아래와 같습니다. 각 옵션 종류는 같은 확률이고 범위 안 정수 %를 같은 확률로 뽑습니다.</p><div class="gem-options"><h4>보석 강화</h4>${upgrades}${GEM_OPTION_TIERS.map(tier => `<p>${tier.name} · ${tier.lines}줄 · 재설정 ${fmt(tier.cost)} · 승급 ${Math.round(tier.promotionChance * 100)}%</p>`).join("")}${GEM_OPTIONS.map(option => `<p>${option.name} ${Math.round(option.min*100)}~${Math.round(option.max*100)}%</p>`).join("")}</div>`;
}
