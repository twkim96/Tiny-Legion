const iconPaths = {
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
  star: '<path d="m12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1 3-7Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  heart: '<path d="M12 21 3 12C-2 5 7 0 12 7 17 0 26 5 21 12l-9 9Z"/>',
  fullscreen: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6M9 21H3v-6"/>',
};
export function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.star}</svg>`;
}

const stroke = "#35372e",
  cream = "#faf7ea",
  sage = "#a4b78e",
  peach = "#dca68b";
const eyes =
  '<circle cx="67" cy="62" r="2.6" fill="#35372e"/><circle cx="82" cy="62" r="2.6" fill="#35372e"/><path d="m71 71 3 2 3-2" fill="none"/>';
const figures = {
  sheep: `<path d="m42 88-2 16h12l4-17m23 1 3 16h12l-3-18" fill="${stroke}"/><path d="M31 81c-15 0-19-18-7-24-10-13 1-26 14-22 0-15 19-21 27-9 12-10 29-2 27 12 17-2 25 16 14 26 9 14-2 27-16 24-14 13-42 13-51-2Z" fill="${cream}"/><path d="m55 48-12 7 9 10m37-17 10 8-9 8" fill="${sage}"/><ellipse cx="73" cy="62" rx="21" ry="24" fill="#c8cfb7"/>${eyes}<path d="M22 66q-4 26 16 39 22-14 20-39Z" fill="${sage}"/><path d="M38 75v20m-8-11h16" stroke="#f8f4e7"/>`,
  rabbit: `<path d="m53 45-9-24c-9-21 8-25 13-9l9 31m9 0 1-28c0-18 17-16 13 2l-6 29" fill="${cream}"/><path d="m52 30 5 12m25-15-1 14" stroke="${peach}" stroke-width="4"/><path d="M45 79c-13 7-18 19-13 24l17-3m31-17 16 20H80L67 91" fill="${cream}"/><ellipse cx="66" cy="77" rx="25" ry="25" fill="${cream}"/><ellipse cx="69" cy="55" rx="25" ry="23" fill="${cream}"/><circle cx="61" cy="54" r="2.5" fill="${stroke}"/><circle cx="78" cy="54" r="2.5" fill="${stroke}"/><path d="m67 62 3 2 3-2"/><path d="m46 74 36-2-6 9-26 2Z" fill="${peach}"/><path d="m98 86 10-47-6-10-9 8-3 47Z" fill="#c3ad82"/><path d="m81 86 29 5m-17-3-3 14"/><path d="m72 87 19-5" stroke-width="9" stroke="${cream}"/>`,
  squirrel: `<path d="M51 95C9 114 9 52 27 48c23-8 27 35 12 30-15-4-1-22 3-10" fill="#c5b89a"/><path d="m50 42-7-17 18 5m20 1 11-10 3 23" fill="#d8c9a7"/><ellipse cx="70" cy="79" rx="24" ry="25" fill="#d8c9a7"/><path d="M50 97v8h15m15-7 11 7"/><ellipse cx="71" cy="51" rx="25" ry="23" fill="#d8c9a7"/><ellipse cx="76" cy="61" rx="17" ry="12" fill="${cream}"/><circle cx="62" cy="48" r="2.6" fill="${stroke}"/><circle cx="80" cy="48" r="2.6" fill="${stroke}"/><path d="m74 57 3 2 3-2"/><path d="m54 75 30 1-9 10-16-2Z" fill="${sage}"/><path d="m94 87-5-27m0 0-11-9m11 9 10-12" stroke="#8c7858" stroke-width="6"/><path d="m80 53 5 18 13-18" fill="none" stroke="${peach}"/><path d="m78 87 15-3" stroke-width="8" stroke="#d8c9a7"/>`,
  teapot: `<path d="M48 50C8 33 15 94 47 81" fill="none" stroke-width="9" stroke="#c2c6b4"/><path d="m87 49 11 16 13-18 8 5-17 32-22-3" fill="${cream}"/><path d="m47 91-5 14h13l7-12m16-2 6 14h11l-6-17" fill="#c2c6b4"/><path d="M40 48h51l6 27c6 35-62 36-60 3Z" fill="${cream}"/><path d="M37 47q4-15 57-1Z" fill="#c2c6b4"/><path d="m59 32 3-9h12l3 9" fill="${sage}"/><circle cx="61" cy="63" r="2.6" fill="${stroke}"/><circle cx="77" cy="63" r="2.6" fill="${stroke}"/><path d="m66 72 3 2 3-2"/><path d="M42 84q22 9 52 0" stroke="${peach}"/><path d="M48 41h15" stroke="${cream}"/>`,
  cloud: `<path d="M25 79c-23 1-25-28-7-34-5-17 14-30 27-20 8-23 37-21 44 3 19-7 35 9 28 25 18 10 7 32-10 31Z" fill="#eef0e5"/><path d="M45 86q-7 14-16 8m52-7q7 14 17 9"/><circle cx="60" cy="53" r="2.5" fill="${stroke}"/><circle cx="80" cy="53" r="2.5" fill="${stroke}"/><path d="m66 63 5 3 5-3"/><path d="m29 61 8 1m55 0 8-1" stroke="${peach}" stroke-width="4"/><path d="m66 77-6 13h9l-4 17 18-23h-9l3-7" fill="#c4cf9e"/><path d="M30 39q6-7 13-3" stroke="#fff"/>`,
  beetle: `<path d="m35 75-13 9m16-22-16-2m15 31-10 11m61-26 15 9m-16-24 16-3m-17 33 12 11"/><ellipse cx="61" cy="74" rx="31" ry="28" fill="#c3ad78"/><path d="M61 49v50"/><ellipse cx="75" cy="44" rx="24" ry="20" fill="#d6c591"/><path d="m64 26-4-10m22 9 5-11"/><circle cx="70" cy="42" r="3" fill="${stroke}"/><circle cx="86" cy="42" r="3" fill="${stroke}"/><path d="M74 52h7"/>`,
  mushroom: `<path d="m49 83-4 21h13l5-19m15-2 7 21h12l-8-22" fill="#e4dfcd"/><path d="M41 51h50l5 30c4 26-62 26-58 0Z" fill="#e4dfcd"/><path d="M17 54c3-54 93-60 96 0q-49 15-96 0Z" fill="#c68d73"/><path d="M35 40q4-10 13-8m20-12h13m11 21 7 4" stroke="${cream}" stroke-width="8"/><circle cx="60" cy="70" r="2.5" fill="${stroke}"/><circle cx="79" cy="70" r="2.5" fill="${stroke}"/><path d="m63 81 9-1"/>`,
  boar: `<path d="m33 90-2 14h14l7-16m30 1 3 15h14l-4-18" fill="${stroke}"/><path d="M27 52c-25-9-21 11-9 8" fill="none"/><ellipse cx="57" cy="68" rx="38" ry="29" fill="#b9b5a3"/><path d="m77 46-9-23 22 9m9 13 13-14 1 22" fill="#b9b5a3"/><ellipse cx="89" cy="64" rx="29" ry="27" fill="#b9b5a3"/><ellipse cx="103" cy="71" rx="21" ry="15" fill="#e0c5b1"/><circle cx="99" cy="69" r="2.3" fill="${stroke}"/><circle cx="111" cy="69" r="2.3" fill="${stroke}"/><circle cx="81" cy="55" r="3" fill="${stroke}"/><path d="m81 83-8-15 13 8" fill="${cream}"/><path d="m37 40 5-8 6 9 7-8 6 8" fill="#b9b5a3"/>`,
};
export function portrait(id, cls = "") {
  return `<svg class="portrait ${cls}" viewBox="0 0 128 120" fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${figures[id] || figures.sheep}</svg>`;
}
export function spriteSvg(id) {
  return portrait(id).replace(
    'class="portrait "',
    'xmlns="http://www.w3.org/2000/svg"',
  );
}
