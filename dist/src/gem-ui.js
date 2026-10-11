import { icon } from "./art.js";
import { GEM_BANNERS, gemByUid, gemDefinition, gemDescription, gemOptionText, gemUpgradeCost, gemTransferCost } from "./gems.js";

const fmt = n => Math.floor(n).toLocaleString("ko-KR");
export function gemArt(type) {
  return `<span class="gem-art" style="color:${gemDefinition(type)?.color ?? "#b7a25d"}">${icon("gem")}</span>`;
}
export function gemCard(item, attribute = "gem-uid") {
  return `<button class="gem-card" data-${attribute}="${item.uid}">${gemArt(item.type)}<strong>${gemDefinition(item.type).name}</strong><span>Lv. ${item.level}</span><span class="gem-card-options">${item.options.map(gemOptionText).join("<br>") || "추가옵션 없음"}</span></button>`;
}
export function gemPage(account, preset) {
  const slots = account.gemPresets[preset];
  return `<div class="preset-numbers" role="group" aria-label="보석 프리셋">${Array.from({length:10},(_,i) => `<button data-gem-preset="${i}" aria-pressed="${i===preset}">${i+1}</button>`).join("")}</div><div class="gem-equipment">${slots.map((uid,i) => {
    const item = gemByUid(account,uid);
    return `<button class="gem-equipment-slot ${!account.gemGuide?.equipped && account.gemGuide?.drawn ? "guide-highlight" : ""}" data-gem-slot="${i}"><small>${i+1}</small>${item ? `${gemArt(item.type)}<strong>${gemDefinition(item.type).name}</strong><span>Lv. ${item.level}</span>` : `${icon("plus")}<span>장착</span>`}</button>`;
  }).join("")}</div><p class="settings-note">순서에서 콘텐츠별 보석 프리셋을 선택하세요. 변경은 다음 전투부터 적용됩니다.</p><div class="gem-banner"><div><h3>${GEM_BANNERS[0].name}</h3><p>${GEM_BANNERS[0].description ?? "전투 골드와 도토리를 모으는 재화 보석입니다."}</p></div><div class="gem-banner-types">${GEM_BANNERS[0].types.map(type => `${gemArt(type)}<span>${gemDefinition(type).name}</span>`).join("")}</div><div class="gem-draw-actions">${!account.gemWelcomeClaimed ? '<button class="primary-button" id="gem-free">1회 무료</button>' : ""}<button class="secondary-button" id="gem-draw-tickets" ${account.tickets<5 ? "disabled" : ""}>조각 5 · 모집</button><button class="secondary-button" id="gem-draw-diamonds" ${account.diamonds<30 ? "disabled" : ""}>${icon("gem")}30 · 모집</button><button class="inspect-button" id="gem-rates">확률</button></div></div><h3 class="collection-heading">보유 보석 ${account.gemItems.length}</h3><div class="gem-grid">${account.gemItems.map(item => gemCard(item)).join("") || '<p class="settings-note">보석을 모집해 장착해 보세요.</p>'}</div>${Object.entries(account.gemReserves ?? {}).some(([,n])=>n>0) ? `<p class="settings-note">이전 보석 재료 · ${Object.entries(account.gemReserves).filter(([,n])=>n>0).map(([type,n])=>`${gemDefinition(type).name} ${fmt(n)}`).join(" · ")}</p>` : ""}<div class="modal-footer"><span>${icon("acorn")}${fmt(account.gold)}</span><span>${icon("gem")}${fmt(account.diamonds)} · 보석 조각 ${fmt(account.tickets)}</span></div>`;
}
export function gemDetail(account,uid,preset) {
  const item=gemByUid(account,uid), cost=gemUpgradeCost(item);
  if(!item) return "";
  const options=item.options.map(option => `<li>${gemOptionText(option)}</li>`).join("");
  return `<div class="gem-detail-heading">${gemArt(item.type)}<div><h3>${gemDefinition(item.type).name}</h3><strong>Lv. ${item.level} / 10</strong><p>${gemDescription(item)}</p></div></div><h4>추가옵션</h4>${options ? `<ul class="gem-options">${options}</ul>` : '<p class="settings-note">추가옵션이 없는 보석입니다.</p>'}<div class="gem-equip-actions">${[0,1,2].map(slot => `<button class="secondary-button" data-detail-equip="${slot}">${preset+1}번 프리셋 · ${slot+1}번 칸</button>`).join("")}</div><div class="gem-growth-actions"><button class="primary-button" id="gem-upgrade" ${!cost ? "disabled" : ""}>${cost ? `강화 · 같은 보석 ${cost.copies}개 + ${icon("acorn")}${fmt(cost.gold)}` : "강화 완료"}</button><button class="secondary-button" id="gem-transfer" ${item.level<=1 ? "disabled" : ""}>전승 · ${icon("acorn")}${fmt(gemTransferCost(item))}</button></div><p class="settings-note">강화는 추가옵션을 바꾸지 않습니다. 전승하면 원본 보석은 사라지고 강화 단계만 옮겨집니다.</p><div class="modal-footer"><button class="secondary-button" id="gem-back">보석 목록</button><span>${icon("acorn")}${fmt(account.gold)}</span></div>`;
}
