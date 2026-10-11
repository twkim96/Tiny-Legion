// Shared materials and silhouettes, independent of combat counter specialties.
const PALETTES = {
  wild: {
    ink: "#494637",
    body: "#ead5ae",
    light: "#fff5db",
    trim: "#849967",
    dark: "#8c6949",
    accent: "#72b54b",
  },
  machine: {
    ink: "#3e4c54",
    body: "#aabac0",
    light: "#e3ebdf",
    trim: "#cba365",
    dark: "#697d87",
    accent: "#a8b5c5",
  },
  spirit: {
    ink: "#427481",
    body: "#a0d6d9",
    light: "#eefcf5",
    trim: "#6bb6c3",
    dark: "#719eb7",
    accent: "#69c8ed",
  },
  shadow: {
    ink: "#41364f",
    body: "#706489",
    light: "#d9d3ec",
    trim: "#b2a1cf",
    dark: "#514862",
    accent: "#9a69cf",
  },
};
const p = (d, fill = "none", attrs = "") =>
  `<path d="${d}" fill="${fill}" ${attrs}/>`;
const c = (x, y, radius, fill, attrs = "") =>
  `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" ${attrs}/>`;
const e = (x, y, rx, ry, fill, attrs = "") =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${attrs}/>`;
const r = (x, y, width, height, radius, fill, attrs = "") =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" ${attrs}/>`;
const line = (d, color, width = 2) =>
  p(d, "none", `stroke="${color}" stroke-width="${width}"`);
function face(x, y, family, gap = 18) {
  const pal = PALETTES[family],
    left = x - gap / 2,
    right = x + gap / 2;
  const eyes =
    family === "machine"
      ? c(left, y, 6, pal.dark) +
        c(right, y, 6, pal.dark) +
        c(left + 1, y - 1, 2.4, pal.light, 'stroke="none"') +
        c(right + 1, y - 1, 2.4, pal.light, 'stroke="none"')
      : family === "shadow"
        ? p(`M${left - 4} ${y - 2}l8 1-3 5Z`, pal.light, 'stroke="none"') +
          p(`M${right + 4} ${y - 2}l-8 1 3 5Z`, pal.light, 'stroke="none"')
        : c(left, y, 2.6, pal.ink, 'stroke="none"') +
          c(right, y, 2.6, pal.ink, 'stroke="none"');
  return eyes + line(`M${x - 3} ${y + 10}q3 4 6 0`, pal.ink, 2);
}
const rivets = (points) =>
  points.map(([x, y]) => c(x, y, 2, "#e3ebdf", 'stroke-width="1.5"')).join("");
const glass = (d) => line(d, "#eefcf5", 3.5);
function figure(family, body, useAttributeAccent = false) {
  const paint = (accent = PALETTES[family].accent, outline = PALETTES[family].ink) =>
    `<g stroke="${outline}">${body({ ...PALETTES[family], accent })}</g>`;
  return {
    family,
    body: paint(),
    ...(useAttributeAccent ? { bodyForAttribute: (accent, outline = accent) => paint(accent, outline) } : {}),
  };
}

export const CHARACTER_ART = {
  // Wild: fur, overlapping leaves, warm wood and leather.
  sheep: figure(
    "wild",
    (a) =>
      p("m48 87-5 18h14l6-19m17 1 4 18h13l-4-19", a.dark) +
      p(
        "M33 83c-16-3-18-21-7-27-8-15 6-26 19-21 3-15 21-17 29-8 15-8 29 4 27 18 17 5 21 19 9 29 4 15-8 24-23 20-15 12-40 9-47-3Z",
        a.light,
      ) +
      p("m54 48-14 4 9 13m39-18 14 9-12 8", a.trim) +
      e(73, 61, 22, 24, a.body) +
      face(73, 57, "wild") +
      p("M49 83q23 12 43-1l-8 17-12-7-13 7Z", a.trim) +
      p("M20 65q16-9 35 0l-2 23-16 17-15-17Z", "#bda078") +
      line("m30 69-1 21m12-23 1 24m-18-12h29", a.dark) +
      p("M31 33q-6-15 7-18 14 10 4 21Z", a.trim),
  ),
  rabbit: figure(
    "wild",
    (a) =>
      p(
        "M50 43 39 18C31 1 47-2 53 13l9 26m11 1 4-26c3-18 19-14 14 4l-8 26",
        a.light,
      ) +
      line("m47 15 9 24m28-23-6 22", "#d6aa84", 4) +
      p("m47 83-13 19 16 1 13-14m18-6 15 20H79L65 88", a.body) +
      e(66, 77, 25, 25, a.body) +
      e(69, 54, 25, 23, a.light) +
      face(69, 53, "wild") +
      p("m45 74 40-5-9 13-13-3-12 9Z", a.trim) +
      p("m94 88 10-51-8-9-8 8-1 50Z", "#c5a574") +
      line("m95 39-3 38m-12 9 28 5m-15-1-3 14", a.dark, 3) +
      line("m74 84 17-4", a.light, 9),
  ),
  squirrel: figure(
    "wild",
    (a) =>
      p(
        "M49 96C9 111 7 63 25 46c24-15 35 21 18 28-13 5-20-9-10-17",
        "#b28a5b",
      ) +
      line("M20 62q-6 23 13 34", "#dab784", 5) +
      p("m49 39-6-16 18 7m20 0 13-11 2 24", "#c6a071") +
      e(70, 78, 24, 26, "#c6a071") +
      p("m52 96-3 9h15m13-8 14 8", a.dark) +
      e(70, 50, 25, 23, "#c6a071") +
      e(75, 61, 17, 12, a.light) +
      face(71, 48, "wild") +
      p("m49 75 32-4-7 13-13-3-7 8Z", a.trim) +
      line("m94 89-5-28m0 0-11-10m11 10 13-13", a.dark, 6) +
      line("m79 51 9 20 12-22", "#bf8165", 2.5) +
      line("m76 85 14-2", "#c6a071", 8),
  ),
  fox: figure(
    "wild",
    (a) =>
      p("M48 79C15 87 10 63 21 43q7 30 27 26Z", "#cb895b") +
      p("M21 43q-5 18 4 27l10-9Z", a.light) +
      p("m48 87-7 18h15l9-18m18-1 8 19h15l-12-22", a.dark) +
      p("m46 43-11-31 31 20m21 7 24-26-3 37", "#cb895b") +
      e(72, 74, 29, 30, "#cb895b") +
      e(72, 48, 28, 24, "#cb895b") +
      p("M49 52q22-26 43 0l-7 22H58Z", a.light) +
      face(71, 52, "wild") +
      p("M46 76q25-15 47 0l-7 24-14-12-15 12Z", a.trim) +
      p("M94 68v-8q7-8 15 0v8m-18 0h21l-3 24H94Z", "#e3c68b") +
      line("m98 75v11m8-11v11m-16-18h24", a.dark, 2),
  ),
  chick: figure(
    "wild",
    (a) =>
      p("m49 91-5 13h17l5-13m14 0 5 13h17l-10-17", "#cb9453") +
      p(
        "M49 47q-14-12-7-20 8-3 15 9-4-19 6-20 11 0 8 23 13-16 18-7 3 8-13 16Z",
        "#e9c576",
      ) +
      e(68, 75, 32, 29, "#e9c576") +
      e(69, 87, 21, 16, a.light) +
      p("m93 70 18 10-19 8Z", "#cb9453") +
      face(67, 65, "wild") +
      p("M39 69 24 89l23-7m48-16 15-7-9 21", "#dab06a") +
      p("m40 47 13-7 13 9-15 8Z", a.trim) +
      e(28, 89, 13, 14, a.dark) +
      p("M14 86q14-13 28 0l-3 7H16Z", "#b3936b") +
      line("m28 75 6-10 7 2", a.dark, 3) +
      p("M35 66q-3-11 10-9-1 12-10 9Z", a.trim),
  ),

  // Machine: metal shells, continuous panel seams, visible hinges and lenses.
  teapot: figure(
    "machine",
    (a) =>
      p("M42 48H27v29h17", "none", `stroke="${a.dark}" stroke-width="10"`) +
      p("m87 50 11 14 12-21 9 6-15 34-20-4", a.body) +
      p("m97 61 9 5m-7 8 10 5", "none") +
      p("m48 89-6 15h14l7-13m17-1 4 14h15l-8-18", a.dark) +
      c(52, 92, 5, a.trim) +
      c(86, 92, 5, a.trim) +
      r(40, 45, 53, 49, 12, a.body) +
      p("M37 45q2-14 57-2v6H37Z", a.dark) +
      r(57, 25, 19, 10, 3, a.trim) +
      r(49, 56, 35, 27, 5, a.light) +
      face(67, 64, "machine") +
      line("M43 86h48M65 47v8", a.dark, 2) +
      rivets([
        [46, 51],
        [86, 51],
        [45, 88],
        [86, 88],
      ]) +
      line("m51 34 8-5m15 7 10-7", a.light, 2),
  ),
  hedgehog: figure(
    "machine",
    (a) =>
      p(
        "m29 68-8-24 17 9-3-31 22 21 7-30 13 26 15-19 3 29 23-11-10 31Z",
        a.dark,
      ) +
      p("m36 50 19-7 21 1 17 12-10 30-37 1Z", a.body) +
      line("m55 43 2 33m19-30-6 33m-32-14 48 2", a.light, 2) +
      r(32, 85, 66, 20, 10, a.dark) +
      [43, 65, 87].map((x) => c(x, 95, 5, a.trim)).join("") +
      p("M78 61h16l18 12-6 15H79Z", a.body) +
      r(84, 63, 18, 13, 4, a.light) +
      c(95, 69, 4, a.dark) +
      line("m94 82 8-1m-55-3 2-8m6 8 2-8m6 8 2-8", a.dark, 2) +
      rivets([
        [41, 55],
        [64, 51],
        [83, 59],
        [81, 83],
      ]),
  ),
  owl: figure(
    "machine",
    (a) =>
      p("m46 85-5 13 11 7 13-16m17-3 9 18 14-6-12-14", a.dark) +
      c(54, 95, 5, a.trim) +
      c(91, 96, 5, a.trim) +
      p("M39 53 23 81l22 13 14-34m32-7 19 27-11 16-17-35", a.dark) +
      line("m34 70 10 8m-16 2 13 7m56-18 8 11m-11 0 6 8", a.body, 3) +
      r(42, 53, 49, 45, 9, a.body) +
      r(53, 77, 27, 15, 3, a.dark) +
      line("m60 81v7m7-7v7m7-7v7", a.light, 2) +
      p("m37 46-9-25 25 8h29l24-8-10 27Z", a.body) +
      e(67, 52, 34, 25, a.body) +
      c(53, 50, 14, a.trim) +
      c(82, 50, 14, a.trim) +
      c(53, 50, 9, a.dark) +
      c(82, 50, 9, a.dark) +
      c(56, 47, 3.3, a.light, 'stroke="none"') +
      c(85, 47, 3.3, a.light, 'stroke="none"') +
      p("m61 65 7 8 7-8Z", a.trim) +
      rivets([
        [39, 51],
        [95, 51],
        [48, 85],
        [86, 85],
      ]),
  ),
  turtle: figure(
    "machine",
    (a) =>
      p("m31 78-7 17 13 8 16-21m20 0 9 19 13-4-8-19", a.dark) +
      c(33, 91, 6, a.trim) +
      c(81, 91, 6, a.trim) +
      p("M18 76V57q0-27 35-27t36 27v22Z", a.body) +
      p("M29 72V54q5-18 24-18t25 18v18Z", a.dark) +
      c(54, 56, 17, a.trim) +
      c(54, 56, 11, a.light) +
      line("M54 47v10l8 4", a.dark, 3) +
      p("M18 76h70v11H19Z", a.trim) +
      line("m29 79v7m14-7v7m16-7v7m17-7v7", a.dark, 2) +
      p("M85 55h17l9 9v18H89l-6-15Z", a.body) +
      r(87, 57, 25, 18, 5, a.light) +
      face(100, 65, "machine", 13) +
      rivets([
        [24, 59],
        [34, 39],
        [73, 40],
        [83, 60],
      ]) +
      line("m92 90 9 2 5-3", a.dark, 3),
  ),

  // Spirit: pale water-glass bodies, curling contours and flowing fins.
  cloud: figure(
    "spirit",
    (a) =>
      p(
        "M24 76C4 73 3 52 20 47c-3-17 16-28 30-18 10-18 35-16 43 4 20-5 33 9 25 26 14 9 6 25-9 27H40Z",
        a.body,
      ) +
      p(
        "M40 78q0 20-16 23 28 13 43-9 5 25 25 22-12-10-7-27 24 15 34-1-18 5-22-10Z",
        a.body,
      ) +
      p("M31 67q31 19 71 1v12H31Z", a.light, 'stroke="none"') +
      face(70, 55, "spirit") +
      glass("M26 47q8-15 20-8m14-8q15-11 25 6") +
      line("M50 82q15 7 29-1", a.trim, 2),
  ),
  otter: figure(
    "spirit",
    (a) =>
      p("M43 83q-28-9-27 8t29 7q-17 3-17-8t15 0", a.body) +
      p("M46 48q-16-17-5-24 15-6 18 14m25 7q5-25 18-15 11 8-8 25", a.body) +
      e(69, 75, 28, 29, a.body) +
      p("M54 77q16-13 32 0l-5 23H61Z", a.light) +
      p("m48 90-8 14 19-3 8-10m18-2 16 15-17-3-13-8", a.body) +
      e(69, 55, 25, 23, a.body) +
      face(69, 51, "spirit") +
      p("M46 63q-14-15-20-8 0 18 21 19m44-10q9-20 16-13 4 19-18 24", a.trim) +
      glass("m50 44 8-5m-14 38q-9-6-17-1") +
      c(21, 49, 6, a.light, 'stroke-width="2"') +
      c(108, 36, 4, a.light, 'stroke-width="2"'),
  ),
  deer: figure(
    "spirit",
    (a) =>
      line(
        "M52 37 40 25l1-15m0 12-11-7m21 10 3-14m31 26 12-13 2-16m-2 15 11-9m-22 13-2-14",
        a.trim,
        5,
      ) +
      p("m45 83-2 20h12l9-17m17-3 4 20h12l-7-21", a.body) +
      e(67, 75, 24, 27, a.body) +
      p("M42 72q24 6 47-3l12 26-19-10-16 13-21-7Z", a.trim) +
      p("M56 63q12-11 26 1l-9 25-13-4Z", a.light) +
      p("m48 43-18-9 11 23m46-15 18-10-10 22", a.body) +
      e(69, 50, 23, 24, a.body) +
      face(69, 48, "spirit") +
      p("m96 84 7-43 8 8-11 39Z", a.light) +
      line("m95 82 14 3m-38-2 25-3", a.trim, 4) +
      glass("m50 47 4-5m-6 34 13 2"),
  ),
  whale: figure(
    "spirit",
    (a) =>
      p("M31 69 14 51 8 63l8 15-4 15 18-4 12-8", a.trim) +
      p("M29 70q-2-29 38-32t48 30q-3 27-47 27-30 0-39-25Z", a.body) +
      p("M31 78q44 15 81-4-3 20-44 21-24 0-37-17Z", a.light) +
      p("m57 40 7-18 17 17m-19 43-9 22 23-8 4-14", a.trim) +
      face(92, 62, "spirit", 18) +
      glass("M44 53q15-12 32-10M37 67q-2-6 2-11") +
      p("M73 35q-3-12 8-14-6-10 3-15 17 8 5 20 15-5 21 7-21-4-26 4", a.body) +
      line("m41 81 4 5m5-3 4 5m5-3 4 5", a.trim, 2),
  ),

  // Shadow: dark overlapping fabric, tapered points and pale eyes.
  "mushroom-witch": figure(
    "shadow",
    (a) =>
      p("M45 66q17-14 34-7l18 40-18-3-10 12-13-11-18 5Z", a.dark) +
      p("m47 70 19 22 14-26 5 27-14 16-19-11Z", a.body) +
      p("M45 44q22-12 41 0l-3 28-18 9-21-14Z", a.light) +
      p("M40 49 84 46l-3 20-16 8-22-9Z", a.dark) +
      face(63, 56, "shadow") +
      p("M19 49q18-3 22-20L50 8l11 13 16 3 14 25 23 9q-55 16-95-9Z", a.body) +
      p("M19 49q28 11 71 0l24 9q-55 16-95-9Z", a.dark) +
      line("m49 24-6 16m21-11 9 14", a.trim, 3) +
      p(
        "m85 77 13 10 10-8-5-19 10-8",
        "none",
        `stroke="${a.dark}" stroke-width="5"`,
      ) +
      e(98, 84, 9, 11, a.trim) +
      line("m48 82 8 6m22-5-6 8", a.trim, 2),
  ),
  penguin: figure(
    "shadow",
    (a) =>
      p("m46 91-13 13 23 3 10-13m18-1 15 11-23 3-9-12", a.dark) +
      p("M46 52q-6-27 22-32 27 4 27 32l-3 30q-2 23-24 22-28-2-29-24Z", a.dark) +
      p("M51 59q16-8 30 0l5 31-15 9-20-7Z", a.light) +
      p("M38 61 23 88l19-7 10-14m39-6 21 23-18-2-12-13", a.body) +
      p("M52 35q17-10 33 0l-3 22-14 8-17-8Z", a.body) +
      face(67, 44, "shadow") +
      p("m62 57 6 7 8-7Z", a.light) +
      p("M42 64q26-10 50-1l-10 13-16-6-14 7Z", a.trim) +
      p("m44 70-15 26 10-3 2 12 15-28Z", a.body) +
      line("m60 24 7-4 8 4m20 46 8 9", a.trim, 2),
  ),

  // Outdoor animals: sun-tanned fur/skin, faded cloth and weathered equipment.
  // Legacy enemy IDs and animation aliases remain stable.
  bear: figure("wild", (a) =>
    p("m39 87-8 21h26l5-20m15 0 2 20h26l-7-21", "#94633e") +
    e(66, 75, 34, 28, "#94633e") +
    c(39, 26, 12, "#94633e") + c(89, 26, 12, "#94633e") +
    c(39, 26, 6, "#c6a075") + c(89, 26, 6, "#c6a075") +
    e(64, 48, 31, 29, "#a9754b") + e(64, 59, 17, 12, "#d4af7c") +
    face(64, 45, "wild", 24) + p("m59 55 5-3 5 3-5 5Z", a.ink) +
    p("M34 66q30 17 62-1l-7 22-14-7-13 12-13-12-16 7Z", a.accent) +
    e(29, 81, 14, 18, "#94633e") + e(101, 81, 14, 18, "#94633e") +
    line("m21 87 2 8m6-7 1 9m6-11 1 8m58-7-1 8m7-7-1 9m7-10-2 8", "#d4af7c", 3), true),
  badger: figure("wild", (a) =>
    p("m43 83-17 22 24-2 12-18m13 2 10 18h20L90 81", "#9b754f") +
    p("M40 72Q12 43 13 83q8 19 32 11", "#73573f") +
    e(64, 76, 30, 25, "#9b754f") +
    p("m37 40-6-21 22 10m23 0 23-10-7 25", "#9b754f") +
    e(65, 49, 31, 27, "#c6a075") +
    p("M37 34q12 0 21 34l-10-4-10-16Zm56 0q-12 0-20 34l10-4 10-16Z", "#73573f") +
    face(65, 47, "wild", 26) + p("m60 61 5-3 5 3-5 5Z", a.ink) +
    p("M38 77q28 10 53-1l-5 13-16-4-13 12-17-9Z", a.accent) +
    p("m24 89-9 9 18-3m66-7 17 8-18 1", "#c6a075"), true),
  porcupine: figure("wild", (a) =>
    p("M40 97 17 85l10-8-14-18 15-1-3-21 17 7 1-23 15 15 11-20 8 23 17-10-3 27 17 2-10 17Z", "#735039") +
    line("m23 60 26 8m-11-31 16 22m12-31 0 27m25-13-12 24", "#d4af7c", 3) +
    p("m49 90-10 17h22l6-18m9 0 4 18h20l-8-22", "#986849") +
    e(69, 78, 27, 23, "#986849") +
    c(52, 43, 8, "#986849") + c(90, 43, 8, "#986849") +
    e(71, 58, 25, 22, "#b88960") + face(73, 54, "wild") +
    p("M46 76q23 13 48-1l-6 19-16-6-17 7Z", a.accent) +
    e(98, 87, 13, 12, "#c6a075") +
    p("m87 74 10 13 17-24", "none", `stroke="${a.dark}" stroke-width="5"`) +
    e(110, 66, 5, 7, a.accent), true),
  beetle: figure(
    "wild",
    (a) =>
      p("M43 84C13 99 8 84 17 65q-2-13 14-17l-5 17 14-1-7 16Z", "#a87950") +
      line("M17 60 27 67m-11 9 15 3m-12 9 15-2", "#6e513c", 6) +
      p("m49 87-5 18h14l7-17m15-2 6 19h14l-9-21", "#705340") +
      e(69, 75, 27, 28, "#ae7d51") +
      p("m45 40-5-19 20 10m22 0 18-13-3 24", "#a87950") +
      e(70, 51, 27, 24, "#b78b5e") +
      p("M44 48q10-12 24 3 16-16 28-5l-7 17-18-6-19 8Z", "#705340") +
      c(60, 51, 2.6, a.light, 'stroke="none"') +
      c(80, 51, 2.6, a.light, 'stroke="none"') +
      e(71, 65, 13, 8, "#d5b18b") +
      p("m68 61 4 3 3-3", a.dark) +
      p("m44 78 39-4 10 18-17-9-19 10Z", a.accent) +
      line("m47 75-17 8m57-9 18 6", "#ae7d51", 9),
    true,
  ),
  boar: figure(
    "wild",
    (a) =>
      p("m34 90-1 15h14l6-15m30-1 3 16h14l-6-19", "#624b38") +
      p("M27 59q-23-19-18 2", "none", 'stroke="#805b3d" stroke-width="5"') +
      e(59, 71, 38, 28, "#a27649") +
      p("m36 47 6-14 12 12 10-14 9 16", "#805b3d") +
      p("m78 43-7-19 21 9m10 13 12-15 1 22", "#a27649") +
      e(90, 65, 27, 26, "#a27649") +
      e(101, 76, 18, 13, "#ca9a6f") +
      c(99, 75, 2, "#624b38", 'stroke="none"') +
      c(111, 75, 2, "#624b38", 'stroke="none"') +
      c(80, 55, 3, a.ink, 'stroke="none"') +
      p("m83 83-12-16 17 8Z", "#f1e2bd") +
      line("m31 60 5-5m-5 17 7-5", "#d5ac75", 2) +
      p("M34 45q20-16 44-9l-5 22-10-8-11 12-9-11-10 5Z", a.accent) +
      p("M76 31l10 5 2 9-8-5Zm27 12 8-9 1 11-7 4Z", a.accent),
    true,
  ),
  mushroom: figure(
    "spirit",
    (a) =>
      p(
        "M50 43 36 19C28 4 42 0 49 12l14 28m12 1 2-28c1-15 16-12 13 4l-5 29",
        "#bb915f",
      ) +
      p(
        "M39 22 47 39m37-23-3 23",
        "none",
        'stroke="#ddbb90" stroke-width="4"',
      ) +
      p("m49 85-16 18 19 1 13-14m16-5 17 18H81L68 88", "#b58a5a") +
      e(68, 77, 25, 27, "#b58a5a") +
      p("M47 70q25-11 43 1l11 23-15-8-17 15-23-7Z", a.accent) +
      p("M57 71q11-5 21 1l-3 24-15-7Z", "#e2c49f") +
      e(70, 54, 25, 23, "#bb915f") +
      face(70, 52, "spirit") +
      glass("m52 42 6-5m-12 35 11 2") +
      p("M94 48q16-9 20-2-13 3-13 17-8 4-12-2 7-3 5-13Z", "#e8d5af") +
      line("m77 81 18-4", "#bb915f", 9),
    true,
  ),
  "clock-beetle": figure(
    "machine",
    (a) =>
      p("m46 88-10 14 18 3 12-14m19-4 14 15-17 4-14-16", "#916b49") +
      e(67, 72, 31, 29, "#a9794e") +
      p("M38 65 30 82l-12 1 11 9 18-15m42-12 18 7-3 13-12-4", "#bb956b") +
      line("m21 84 8 4m5-5 4 4m63-8-2 7", "#ead7b6", 3) +
      p("M42 59 56 50h20l15 14-4 26-19 9-23-11Z", a.accent) +
      line("M64 53v40m-20-18 40 2", "#665d4e", 2) +
      rivets([
        [49, 62],
        [79, 63],
        [49, 86],
        [78, 88],
      ]) +
      p("m46 38-7-12 17 3m25 1 15-5-4 14", "#a9794e") +
      e(68, 46, 27, 24, "#b58a60") +
      e(74, 60, 18, 10, "#d0a179") +
      c(84, 57, 4, "#72543e") +
      p("M42 40q25-15 50 0l-3 13H44Z", a.accent) +
      c(57, 42, 8, "#58686c") +
      c(79, 42, 8, "#58686c") +
      c(59, 40, 2.5, "#e3ebdf", 'stroke="none"') +
      c(81, 40, 2.5, "#e3ebdf", 'stroke="none"') +
      line("m53 74 6-6m13 16 9-6", "#d7c3a3", 2),
    true,
  ),
  "shadow-mushroom": figure(
    "shadow",
    (a) =>
      p("M46 79Q14 102 10 72l12-24q-1 21 23 19Z", "#a3714d") +
      p("M18 56q1 15 13 19l-9 14q-14-6-12-17Z", "#c59f7e") +
      p("m48 86-8 18h15l11-16m16-2 11 18h15l-13-20", "#72523c") +
      e(70, 75, 27, 28, "#a3714d") +
      p("M41 68q27-11 51-1l7 29-19-9-12 16-16-15-17 10Z", a.accent) +
      p("m46 40-12-25 30 15m18-1 23-18-3 31", "#a3714d") +
      e(70, 47, 26, 24, "#a3714d") +
      p("M50 44q19-8 38 0l-6 22-11 6-17-6Z", "#c09b7c") +
      face(69, 47, "shadow", 18) +
      line("m46 75 8 8m25-6-7 9", "#a493aa", 2) +
      p("M97 62q13-13 16-2l-9 17-8 13-3-11Z", "#a493aa"),
    true,
  ),
};

// Bosses keep their species' movement silhouette and wear distinct large armor.
for (const [id, baseId, equipment] of [
  ['grove-bear', 'bear', (a) => p('M37 25 33 10l13 9 8-16 10 13 13-13 7 16 13-9-3 16Z', a.accent) + p('M14 65 28 59l14 11-8 20-18-4Z', '#bda078')],
  ['grove-boar', 'boar', (a) => p('M24 55 28 30l14 10 10-21 14 15 17-12-3 23-17 10-17-9Z', a.accent) + p('m101 86 14-15 3 19-15 9Z', '#f1e2bd')],
  ['workshop-bear', 'bear', (a) => p('M35 26 40 10h47l8 16-12 8H48Z', '#aabac0') + r(45, 17, 39, 10, 3, '#697d87') + p('M13 62h26l-3 31H17Zm78 0h24l-4 31H95Z', a.accent) + rivets([[21,70],[30,83],[100,70],[106,83]])],
  ['workshop-boar', 'boar', (a) => p('M69 48 73 23l27 3 14 17-5 16-16-8Z', '#aabac0') + p('M25 50 34 32l29 3 16 19-9 26-33-6Z', a.accent) + rivets([[39,44],[57,47],[40,65],[89,34],[102,43]])],
]) {
  const base = CHARACTER_ART[baseId];
  const paint = (accent = PALETTES.wild.accent, outline = PALETTES.wild.ink) =>
    (base.bodyForAttribute?.(accent, outline) ?? base.body) + `<g stroke="${outline}">${equipment({ ...PALETTES.wild, accent })}</g>`;
  CHARACTER_ART[id] = { family: base.family, body: paint(), bodyForAttribute: paint };
}
