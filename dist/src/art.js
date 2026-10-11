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
  fox: `<path d="m48 83-8 22h14l10-20m21-2 7 22h14L94 79" fill="#754c3d"/><path d="m42 49-13-35 34 19m32 15 22-30-3 43" fill="#c9774e"/><path d="m39 48 3-23 19 10m36 11 15-18-3 28" fill="#f4d9a8"/><ellipse cx="70" cy="73" rx="30" ry="31" fill="#cf7950"/><path d="M53 77q18-17 37 0l-5 21q-15 13-29 0Z" fill="#f8e7cb"/><circle cx="60" cy="66" r="2.7" fill="${stroke}"/><circle cx="80" cy="66" r="2.7" fill="${stroke}"/><path d="m67 78 4 3 4-3"/><path d="M96 68q23 7 19 25-4 11-18 1" fill="none" stroke="#f3d79c" stroke-width="8"/><path d="M92 68v-7q7-8 15 0v7m-18 0h21l-2 24H93Z" fill="#f5d985" stroke="#866243"/><path d="M98 73v14m7-14v14m-16-19h23" stroke="#866243" stroke-width="2"/><path d="m24 56 4-14 5 14 12-7-6 15" fill="#f5d985"/>`,
  hedgehog: `<path d="m43 89-7 15h15l9-15m23 0 6 15h15l-9-18" fill="#66564b"/><path d="m34 65-12-25 18 12-8-31 23 22 1-29 17 25 14-23 4 29 23-14-11 29" fill="#88684f"/><ellipse cx="65" cy="77" rx="36" ry="27" fill="#b68d68"/><ellipse cx="90" cy="76" rx="19" ry="15" fill="#efd3ae"/><circle cx="82" cy="66" r="2.8" fill="${stroke}"/><circle cx="99" cy="75" r="3" fill="#493d36"/><path d="M47 88q22 9 41 0"/><path d="m28 72-8-9m12 20-10 3m75-24 10-8" stroke="#d7b18a"/><path d="m36 53 13-8 8 13-13 9Z" fill="#a8b4a3"/><circle cx="48" cy="57" r="3" fill="#d5bb75"/>`,
  chick: `<path d="m48 90-5 14h16l4-13m19 0 3 13h16l-9-17" fill="#dc9e41"/><path d="m51 49-7-18 16 12q12-13 25-2l15-13-4 24" fill="#f6d65e"/><ellipse cx="68" cy="76" rx="34" ry="29" fill="#f3d15b"/><path d="m90 72 22 9-22 8Z" fill="#e69348"/><circle cx="58" cy="67" r="2.7" fill="${stroke}"/><circle cx="78" cy="67" r="2.7" fill="${stroke}"/><path d="m43 78-16 11 19 1m51-14 12-14" fill="none" stroke="#dfa840" stroke-width="7"/><path d="m39 36 17 3-6 13Z" fill="#e77e58"/><circle cx="23" cy="84" r="12" fill="#5b594e"/><path d="m22 72 5-7 5-2m-4-1 4 1m-11 27v-8m8 8v-8" stroke="#d5ac57" stroke-width="3"/><path d="m104 42 5 7-8 2 4 7-9-4-5 7-1-10-9-3 9-4 1-9 6 7Z" fill="#d99459"/>`,
  otter: `<path d="m49 87-8 17h16l9-14m17-3 5 17h16l-8-21" fill="#846552"/><path d="M45 53q-10-19 5-22 11-2 11 10m21 13q8-22 20-12 9 8-5 21" fill="#8f6d58"/><ellipse cx="70" cy="76" rx="31" ry="31" fill="#9b765c"/><ellipse cx="70" cy="86" rx="22" ry="15" fill="#e9d6b9"/><circle cx="60" cy="67" r="2.7" fill="${stroke}"/><circle cx="80" cy="67" r="2.7" fill="${stroke}"/><path d="m66 79 4 3 4-3m-4 3v4"/><path d="M43 80q-19 5-12 21 8 8 20-3" fill="none" stroke="#846552" stroke-width="9"/><path d="M45 47q24-12 49 0l-6 14H50Z" fill="#83bed0"/><path d="m61 44 9-15 9 15" fill="#d7f2ee"/><path d="M32 42c-13 6-13 19 0 24 13-5 13-18 0-24Z" fill="#9ee2e3"/><path d="M100 89c-11 5-11 16 0 21 11-5 11-16 0-21Z" fill="#8ed5e0"/>`,
  owl: `<path d="m47 84-6 20h17l6-16m18-4 5 20h17L94 82" fill="#80674e"/><path d="m39 47-12-28 28 15m42 13 20-27-3 38" fill="#a98b6a"/><path d="m37 43 4-14 13 9m43 5 13-14-2 19" fill="#e8d5a7"/><ellipse cx="68" cy="70" rx="35" ry="35" fill="#9c7f62"/><ellipse cx="56" cy="62" rx="15" ry="16" fill="#f0e8cf"/><ellipse cx="83" cy="62" rx="15" ry="16" fill="#f0e8cf"/><circle cx="59" cy="63" r="4" fill="#d0a947"/><circle cx="80" cy="63" r="4" fill="#d0a947"/><circle cx="59" cy="63" r="2" fill="${stroke}"/><circle cx="80" cy="63" r="2" fill="${stroke}"/><path d="m65 77 5 7 5-7Z" fill="#d69a53"/><path d="m35 85 34 8 36-9-7 17-27-7-28 7Z" fill="#d1b582"/><path d="m88 40 17-20 10 6-10 24" fill="#8b745c"/><circle cx="105" cy="29" r="5" fill="#e6bd58"/><path d="m95 32 9-2" stroke="#f7df91"/>`,
  "mushroom-witch": `<path d="m49 87-6 17h15l7-17m17 0 7 17h15l-8-19" fill="#d6c9d9"/><path d="M40 56q5-15 17-11h29q12-4 17 11l-6 31q-24 20-51 0Z" fill="#b28eb3"/><path d="M15 53q2-48 54-47 51-1 57 47-54 18-111 0Z" fill="#805c91"/><path d="m31 43 10-13 12 9m28-19 8 14 15-7" fill="none" stroke="#d7b4d6" stroke-width="7"/><circle cx="60" cy="68" r="2.7" fill="${stroke}"/><circle cx="79" cy="68" r="2.7" fill="${stroke}"/><path d="m64 78 6 4 6-4"/><path d="m98 43 18 51m-8-35 10-10m-14 0 9 12" stroke="#624e70" stroke-width="5"/><path d="m105 45 9-18 9 18Z" fill="#d9c6e2"/><path d="M24 86q-10 4-7 15m88-7q9-4 13 5" stroke="#e8d8ef" stroke-width="4"/><circle cx="30" cy="83" r="3" fill="#e8d57b"/><circle cx="98" cy="98" r="3" fill="#e8d57b"/>`,
  deer: `<path d="m47 87-7 18h16l8-18m20 0 5 18h16l-8-20" fill="#866c4c"/><path d="M50 54 40 20l-19-13 8 25-16 8 30 1m37 13 10-34 19-13-8 25 16 8-30 1" fill="none" stroke="#927651" stroke-width="7"/><path d="m40 24-10-10m-5 24-12 3m68-17 10-10m6 24 12 3" stroke="#c5a46a" stroke-width="4"/><ellipse cx="68" cy="71" rx="28" ry="34" fill="#bc9e71"/><path d="M50 77q18-14 36 0l-4 19q-14 9-28 0Z" fill="#f0e3c9"/><circle cx="58" cy="63" r="2.7" fill="${stroke}"/><circle cx="77" cy="63" r="2.7" fill="${stroke}"/><path d="m65 78 4 3 4-3"/><path d="m44 83 28 6 21-9-5 20-23-6-22 7Z" fill="#78936f"/><path d="m98 91 10-49 5-8 3 57" fill="#765b3e"/><path d="m108 47 9-10m-9 25 10-9" stroke="#c2a66d" stroke-width="4"/><path d="m34 90-13-9 17 1m-9 7-11 8" fill="#8aa17c"/>`,
  penguin: `<path d="m48 87-9 18h17l8-15m19-3 5 18h17L94 84" fill="#e9e7de"/><path d="m48 48-14-12-7 24 19 10m44-22 15-12 7 24-20 10" fill="#668da7"/><ellipse cx="69" cy="74" rx="34" ry="39" fill="#668da7"/><ellipse cx="69" cy="80" rx="22" ry="28" fill="#f4f0e4"/><ellipse cx="68" cy="51" rx="25" ry="22" fill="#f5f0e5"/><circle cx="60" cy="51" r="2.7" fill="${stroke}"/><circle cx="77" cy="51" r="2.7" fill="${stroke}"/><path d="m63 61 6 6 6-6Z" fill="#e8a64b"/><path d="m42 72q25 11 52 0l-3 10q-23 9-45 0Z" fill="#b6d8df"/><path d="m78 78 9 17 9-4" fill="#b6d8df"/><path d="m40 38 8-16 6 14m30-5 10-15 3 20" fill="none" stroke="#b6d8df" stroke-width="5"/><path d="m29 75-14 5 13 7m82-12 12 5-13 8" fill="none" stroke="#d8f1f0" stroke-width="4"/><path d="m68 20 3-7 3 7 7 1-6 4 2 7-6-4-6 4 2-7-6-4Z" fill="#e4f7f0"/>`,
  whale: `<path d="M31 74q-18-2-24-17 16 4 26-5m4 47q-10 12-5 18 11-3 17-14m43-9q11 15 8 22-12-2-21-14" fill="#6487aa"/><path d="M29 67q13-36 51-34 32 2 42 30 5 17-8 30-18 14-51 8-34-5-39-21Z" fill="#739cbd"/><path d="M39 83q30 17 72-2-8 32-40 31-25-2-32-29Z" fill="#e7eef0"/><circle cx="101" cy="65" r="3" fill="${stroke}"/><path d="M92 77q10 6 18-1" fill="none"/><path d="M70 34q-5-13 4-19m4 19q9-13 4-22" fill="none" stroke="#84c6d0" stroke-width="5"/><path d="m47 52 4 6m14-14 3 6m16 5 4 6m-25 15 3 5m20 9 3 5" stroke="#f5df9c" stroke-width="3"/><path d="m45 65 4 4m31-24 3 5m10 42 3 5" stroke="#fff5cf" stroke-width="2"/><path d="m61 98 8 8-9 3m25-13 8 7-9 4" fill="#6a8da9"/>`,
  turtle: `<path d="m45 83-7 22h18l8-18m20-4 5 22h18L94 80" fill="#71916e"/><path d="M31 69q0-35 38-39 40 1 43 39 1 23-21 28H51Q30 93 31 69Z" fill="#789c76"/><path d="M40 67q1-25 29-27 29 1 33 26-1 18-17 22H57Q41 84 40 67Z" fill="#b7b27d"/><path d="m68 42 1 44m-27-21h56m-47-16 17 16 19-16M47 80l22-15 21 16" fill="none" stroke="#8b9167" stroke-width="3"/><path d="M101 70q21-4 22 12 0 14-20 12" fill="#86a67a"/><circle cx="111" cy="79" r="2.5" fill="${stroke}"/><path d="m105 87 8 3"/><path d="m42 56-14-13m14 24-18 2m17 20-13 13m73-50 12-13" fill="none" stroke="#d6b66c" stroke-width="5"/><circle cx="69" cy="19" r="14" fill="#d8bd72"/><path d="M69 10v9l6 4m-15-4h2m20 0h2" fill="none" stroke="#6a6651" stroke-width="2.5"/><path d="m69 5 2 4-2 2-2-2Z" fill="#f6e5a8"/>`,
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
