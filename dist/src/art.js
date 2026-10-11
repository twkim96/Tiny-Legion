import { CHARACTER_ART } from "./character-art.js";
import { ATTRIBUTES, ENEMIES, NEUTRAL_ATTRIBUTE } from "./data.js";

const iconPaths = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16" stroke-width="2.2"/>',
  auto: '<path d="M20 9a8 8 0 0 0-14-3L3 9m0-5v5h5M4 15a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
  acorn: '<g stroke="#705039"><path d="M6 11h12c0 6-3 9-6 10-3-1-6-4-6-10Z" fill="#efb77c"/><path d="M4 11c0-4 3-6 8-6s8 2 8 6H4Z" fill="#a7734c"/><path d="M12 5V2m0 2c1-3 4-3 6-2-1 3-3 4-6 2Z" fill="#a4bd79"/><path d="m7 7 2 4m3-5 2 5m2-4 2 4" opacity=".5"/><path d="M9 14c0 2 1 3 2 4" stroke="#fff2d2"/></g>',
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5"/><path d="M12 8v8m-2-6h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3"/>',
  gem: '<path d="m3 9 4-5h10l4 5-9 12L3 9Zm0 0h18M7 4l5 17 5-17M7 9l5-5 5 5"/>',
  settings:
    '<path d="m10 3-1 3-3 1-2-1-2 4 2 2v3l-1 2 3 3 3-1 3 1 1 2h4l1-3 3-1 1-4-2-2v-3l-2-2-3 1-1-3Z" transform="translate(1 -1) scale(.9)"/><circle cx="12" cy="12" r="3"/>',
  map: '<path d="m3 5 6-2 6 3 6-2v16l-6 2-6-3-6 2V5ZM9 3v16m6-13v16"/>',
  leaf: '<path d="M20 3C9 2 2 8 5 15c4 7 15 3 15-12ZM4 21l11-12m-5 5v-4m0 4h5"/>',
  swords:
    '<path d="m4 3 3 1 10 11-2 2L4 7 4 3Zm16 0-3 1-6 7m-4 4-2 2m9-1 4-4M2 17l5 5m-4-1 3-3m11-1 4 4m-4 1 5-5"/>',
  bolt: '<path d="m13 2-8 12h6l-1 8 9-13h-7l1-7Z"/>',
  castle:
    '<path d="M3 20V9h4v3h3V6h4v6h3V9h4v11H3Zm7 0v-5h4v5M10 6V2h6l-2 2h-4"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6l8-3Zm0 4v10m-4-5h8"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6v6l4 2"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="3"/>',
  play: '<path d="m7 4 13 8-13 8V4Z"/>',
  purse:
    '<path d="m8 3 2 4h4l2-4H8Zm1 4c-6 5-7 9-5 12 2 3 14 3 16 0 2-3 1-7-5-12M9 8h6m-3 4v6m-2-4h4"/>',
  sequence:
    '<path d="M8 5h13M8 12h13M8 19h13M3 4v3m-1 6 2-2m-2 0 2 2M2 18h2v2H2"/>',
  units:
    '<circle cx="9" cy="7" r="3"/><path d="M2 21v-4a6 6 0 0 1 12 0v4M17 4a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5v3"/>',
  envelope:
    '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="m3 7 9 7 9-7m-13 2 4-4 4 4"/>',
  book: '<path d="M12 6C9 3 4 3 2 5v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 1Zm0 0v14M5 8h3m-3 4h3m8-4h3m-3 4h3"/>',
  forward: '<path d="m3 5 9 7-9 7V5Zm9 0 9 7-9 7V5Z"/>',
  sound:
    '<path d="M4 9h4l5-5v16l-5-5H4V9Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
  "sound-off": '<path d="M3 9h4l5-5v16l-5-5H3V9Zm13 1 6 6m0-6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  rotate:
    '<rect x="6" y="2" width="12" height="20" rx="2" transform="rotate(-35 12 12)"/><path d="M2 9a10 10 0 0 1 16-6m-1-1 2 2-3 1M22 15a10 10 0 0 1-16 6m1 1-2-2 3-1"/>',
  cannon:
    '<path d="m4 11 13-7 3 6-13 7-3-6Zm0 1-2 1 3 6 2-2M10 15l6 3m-9 2h14"/><circle cx="14" cy="18" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 5 5 10-11"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 8M3 3v7h7"/>',
  flag: '<path d="M5 22V3h14l-3 5 3 5H5"/>',
  trophy:
    '<path d="M7 3h10v8a5 5 0 0 1-10 0V3ZM7 5H3v4a4 4 0 0 0 4 4m10-8h4v4a4 4 0 0 1-4 4m-5 3v5m-4 0h8"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
  star: '<path d="m12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1 3-7Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  heart: '<path d="M12 21 3 12C-2 5 7 0 12 7 17 0 26 5 21 12l-9 9Z"/>',
  fullscreen: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6M9 21H3v-6"/>',
};
export function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.star}</svg>`;
}

const stroke = "#35372e";
const ENEMY_DEFINITIONS = new Map(ENEMIES.map((enemy) => [enemy.id, enemy]));
const ATTRIBUTE_COLORS = new Map(
  ATTRIBUTES.filter(({ color }) => color).map(({ id, color }) => [id, color]),
);
ATTRIBUTE_COLORS.set(NEUTRAL_ATTRIBUTE.id, NEUTRAL_ATTRIBUTE.color);
function bodyFor(id, attribute) {
  const enemy = ENEMY_DEFINITIONS.get(id);
  const art = CHARACTER_ART[id] || CHARACTER_ART[enemy?.artId] || CHARACTER_ART.sheep;
  if (!art.bodyForAttribute || !enemy) return art.body;
  const attributeId = attribute ?? enemy.attribute ?? NEUTRAL_ATTRIBUTE.id;
  const color = ATTRIBUTE_COLORS.get(attributeId) ?? NEUTRAL_ATTRIBUTE.color;
  const outline = ATTRIBUTES.find((item) => item.id === attributeId)?.ink ?? color;
  return art.bodyForAttribute(color, outline);
}
export function portrait(id, cls = "", attribute) {
  return `<svg class="portrait ${cls}" viewBox="0 0 128 120" fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${bodyFor(id, attribute)}</svg>`;
}
export function spriteSvg(id, attribute) {
  return portrait(id, "", attribute).replace(
    'class="portrait "',
    'xmlns="http://www.w3.org/2000/svg"',
  );
}
