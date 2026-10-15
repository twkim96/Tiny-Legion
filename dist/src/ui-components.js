import { icon as defaultIcon } from "./art.js";
import { ATTRIBUTES, NEUTRAL_ATTRIBUTE, getCharacter } from "./characters.js";
import { RARITIES } from "./data.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

// Shared, non-interactive label for rarity, attributes and effect keywords.
export function uiTag(label, { tone = "neutral", className = "", keyword } = {}) {
  const classes = `ui-tag${className ? ` ${className}` : ""}`;
  return `<span class="${escapeHtml(classes)}" data-tone="${escapeHtml(tone)}"${keyword ? ` data-effect-keyword="${escapeHtml(keyword)}"` : ""}><strong>${escapeHtml(label)}</strong></span>`;
}

export function resourceChip({ glyph = "acorn", value, label = "", className = "", prefix = "", strong = false, icon = defaultIcon }) {
  const classes = className ? ` class="${escapeHtml(className)}"` : "";
  const amount = `${escapeHtml(prefix)}${escapeHtml(value)}`;
  return `<span${classes}>${icon(glyph)}${escapeHtml(label)}${strong ? `<strong>${amount}</strong>` : amount}</span>`;
}

export function statRow(label, value) {
  return `<div class="stat-item">${escapeHtml(label)}<strong>${escapeHtml(value)}</strong></div>`;
}

const shortCharacterNames = {
  sheep: "양 방패",
  rabbit: "속공 토끼",
  squirrel: "다람쥐",
  teapot: "주전자",
  cloud: "구름",
};

export function characterName(id, { short = false } = {}) {
  const character = getCharacter(id);
  if (!character) return String(id ?? "");
  return short ? shortCharacterNames[id] ?? character.name : character.name;
}

const attributesById = new Map(ATTRIBUTES.map((attribute) => [attribute.id, attribute]));

export function attributeMarkup(id, suffix = "") {
  const attribute = attributesById.get(id) ?? NEUTRAL_ATTRIBUTE;
  return uiTag(`${attribute.name}${suffix}`, { tone: attribute.id, className: "attribute-label" });
}

export function specialtyText(unit, rich = false) {
  const specialties = Array.isArray(unit?.specialties) ? unit.specialties : [];
  if (!specialties.length) return "";
  return specialties.map((id) => {
    const attribute = attributesById.get(id);
    return rich
      ? attributeMarkup(id, "특화")
      : `${attribute?.name ?? "무속성"}특화`;
  }).join(" · ");
}

export const rarityOf = (unit) =>
  RARITIES.find((rarity) => rarity.id === unit.rarity) ?? RARITIES[0];

export const rarityBadge = (unit) => {
  const rarity = rarityOf(unit);
  return uiTag(rarity.name, { tone: rarity.id, className: "rarity-badge" });
};
