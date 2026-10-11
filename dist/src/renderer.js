import { spriteSvg } from "./art.js";
import { ENEMIES, UNITS } from "./data.js";
import { sampleUnitPose, battlefieldLayout } from "./combat-visuals.js";
const INK = "#4b5140";
const MAX_FX = 96;
const FX_LIFETIME = {
  attack: 0.2,
  impact: 0.42,
  hit: 0.2,
  heal: 0.62,
  death: 0.56,
  "castle-hit": 0.5,
  summon: 0.44,
  spawn: 0.38,
  burst: 0.72,
};
const ATTACK_KIND = {
  sheep: "melee",
  rabbit: "melee",
  squirrel: "seed",
  teapot: "water",
  cloud: "bolt",
  beetle: "melee",
  mushroom: "spore",
  boar: "melee",
};
const SPRITES = {};
const SPRITE_IDS = new Set(
  [...UNITS, ...ENEMIES]
    .flatMap((definition) => [definition.id, definition.artId])
    .filter(Boolean),
);
for (const id of SPRITE_IDS) {
  const im = new Image();
  im.src =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(spriteSvg(id));
  SPRITES[id] = im;
}
function path(ctx, coords, fill, stroke = null, line = 1) {
  ctx.beginPath();
  for (const [op, ...args] of coords) ctx[op](...args);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = line;
    ctx.stroke();
  }
}
function oval(c, x, y, rx, ry, fill, stroke = null, line = 1) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = line;
    c.stroke();
  }
}
function line(c, x1, y1, x2, y2, color, width = 1) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function round(c, x, y, w, h, r, fill, stroke = null, lw = 1) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}
function cloud(c, x, y, s) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  path(
    c,
    [
      ["moveTo", 0, 12],
      ["bezierCurveTo", -20, 12, -23, -6, -8, -12],
      ["bezierCurveTo", -12, -27, 7, -36, 18, -25],
      ["bezierCurveTo", 24, -40, 44, -38, 51, -21],
      ["bezierCurveTo", 71, -26, 78, -6, 65, 7],
      ["bezierCurveTo", 73, 16, 59, 22, 49, 17],
      ["bezierCurveTo", 31, 23, 16, 18, 0, 12],
    ],
    "#f9faec",
    "#d8dfc5",
    1.3,
  );
  c.restore();
}
function bush(c, x, y, s, color) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  path(
    c,
    [
      ["moveTo", -30, 10],
      ["bezierCurveTo", -50, -1, -34, -28, -20, -19],
      ["bezierCurveTo", -15, -39, 12, -36, 18, -18],
      ["bezierCurveTo", 36, -31, 49, -7, 36, 9],
      ["closePath"],
    ],
    color,
    "#adb993",
    1.2,
  );
  c.restore();
}
function castle(c, x, ground, size, enemy, time) {
  c.save();
  c.translate(x, ground);
  c.scale(size / 128, size / 128);
  const wall = enemy ? "#e6d7b8" : "#eee7cd",
    roof = enemy ? "#a58b6e" : "#8c9b72";
  const outline = "#62634e";
  oval(c, 0, 5, 72, 10, "#546d3720");
  if (enemy) {
    round(c, -44, -91, 89, 93, 8, wall, outline, 2.7);
    path(
      c,
      [
        ["moveTo", -54, -86],
        ["lineTo", -50, -113],
        ["quadraticCurveTo", 0, -152, 52, -113],
        ["lineTo", 58, -86],
        ["quadraticCurveTo", 0, -68, -54, -86],
      ],
      roof,
      outline,
      2.7,
    );
    oval(c, -21, -112, 7, 4, "#d8c7a3");
    oval(c, 12, -123, 6, 4, "#d8c7a3");
    oval(c, 36, -105, 6, 4, "#d8c7a3");
    round(c, -17, -39, 34, 42, 15, "#827354", outline, 2.7);
    line(c, 0, -36, 0, 0, "#675d48", 2);
    round(c, -32, -70, 13, 13, 4, "#a59977", outline, 1.7);
    round(c, 19, -70, 13, 13, 4, "#a59977", outline, 1.7);
  } else {
    round(c, -40, -90, 80, 92, 3, wall, outline, 2.7);
    round(c, -62, -101, 29, 106, 4, wall, outline, 2.7);
    round(c, 34, -101, 29, 106, 4, wall, outline, 2.7);
    for (const tx of [-65, 31])
      path(
        c,
        [
          ["moveTo", tx, -96],
          ["lineTo", tx, -117],
          ["lineTo", tx + 8, -117],
          ["lineTo", tx + 8, -108],
          ["lineTo", tx + 16, -108],
          ["lineTo", tx + 16, -117],
          ["lineTo", tx + 25, -117],
          ["lineTo", tx + 25, -108],
          ["lineTo", tx + 33, -108],
          ["lineTo", tx + 33, -96],
          ["closePath"],
        ],
        roof,
        outline,
        2.4,
      );
    path(
      c,
      [
        ["moveTo", -42, -89],
        ["lineTo", 0, -115],
        ["lineTo", 42, -89],
        ["closePath"],
      ],
      roof,
      outline,
      2.7,
    );
    round(c, -17, -37, 34, 40, 15, "#a19b77", outline, 2.2);
    line(c, 0, -34, 0, 0, "#777451", 1.4);
    round(c, -52, -77, 9, 15, 4, "#b3b08c", outline, 1.6);
    round(c, 44, -77, 9, 15, 4, "#b3b08c", outline, 1.6);
    round(c, -7, -81, 14, 14, 5, "#c4c0a0", outline, 1.6);
  }
  for (const row of [-53, -26]) {
    line(c, -34, row, -22, row, "#c8c4a5", 1.4);
    line(c, 22, row, 34, row, "#c8c4a5", 1.4);
  }
  const fy = enemy ? -145 : -148;
  line(c, 1, fy + 38, 1, fy - 13, outline, 2);
  const flutter = Math.sin(time * 2) * 3;
  path(
    c,
    [
      ["moveTo", 2, fy - 13],
      ["quadraticCurveTo", 17, fy - 18 + flutter, 32, fy - 10],
      ["lineTo", 28, fy + 5],
      ["quadraticCurveTo", 15, fy - 1 + flutter, 2, fy + 2],
      ["closePath"],
    ],
    enemy ? "#c39878" : "#9dae82",
    outline,
    1.5,
  );
  c.restore();
}
function windmill(c, x, y, s, time) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  path(
    c,
    [
      ["moveTo", -13, 50],
      ["lineTo", -8, 1],
      ["lineTo", 8, 1],
      ["lineTo", 13, 50],
      ["closePath"],
    ],
    "#d9dec3",
    "#b4bf9c",
    1.5,
  );
  c.save();
  c.rotate(time * 0.04);
  for (let i = 0; i < 4; i++) {
    c.rotate(Math.PI / 2);
    line(c, 0, 0, 28, 0, "#b9c4a2", 2);
    round(c, 9, -3, 20, 7, 1, "#e9edd7", "#bec8a9", 1);
  }
  c.restore();
  oval(c, 0, 0, 3, 3, "#b5c09d");
  c.restore();
}
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.fx = [];
    this.battleIdentity = null;
    this.bg = document.createElement("canvas");
    this.width = 0;
    this.height = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }
  resize() {
    const b = this.canvas.getBoundingClientRect();
    this.width = b.width;
    this.height = b.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(b.width * dpr);
    this.canvas.height = Math.round(b.height * dpr);
    this.dpr = dpr;
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;
    this.drawBackground();
  }
  drawBackground() {
    const c = this.bg.getContext("2d"),
      w = this.width,
      h = this.height;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = "#b6c7b0";
    c.fillRect(0, 0, w, h);
    const gradient = c.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#728f8c");
    gradient.addColorStop(1, "#b6c7b0");
    c.fillStyle = gradient;
    c.fillRect(0, 0, w, h);
    oval(
      c,
      w * 0.78,
      h * 0.2,
      Math.min(h * 0.083, 30),
      Math.min(h * 0.083, 30),
      "#e6e5b8",
    );
    oval(
      c,
      w * 0.78,
      h * 0.2,
      Math.min(h * 0.105, 38),
      Math.min(h * 0.105, 38),
      "#e6e5b821",
    );
    path(
      c,
      [
        ["moveTo", 0, h * 0.51],
        [
          "bezierCurveTo",
          w * 0.11,
          h * 0.45,
          w * 0.13,
          h * 0.08,
          w * 0.3,
          h * 0.34,
        ],
        [
          "bezierCurveTo",
          w * 0.45,
          h * 0.05,
          w * 0.45,
          h * 0.6,
          w * 0.61,
          h * 0.44,
        ],
        ["bezierCurveTo", w * 0.76, h * 0.17, w * 0.82, h * 0.33, w, h * 0.41],
        ["lineTo", w, h],
        ["lineTo", 0, h],
        ["closePath"],
      ],
      "#dae3c5",
    );
    path(
      c,
      [
        ["moveTo", 0, h * 0.65],
        [
          "bezierCurveTo",
          w * 0.08,
          h * 0.2,
          w * 0.21,
          h * 0.52,
          w * 0.31,
          h * 0.53,
        ],
        [
          "bezierCurveTo",
          w * 0.45,
          h * 0.29,
          w * 0.54,
          h * 0.34,
          w * 0.62,
          h * 0.52,
        ],
        ["bezierCurveTo", w * 0.74, h * 0.2, w * 0.89, h * 0.48, w, h * 0.51],
        ["lineTo", w, h],
        ["lineTo", 0, h],
        ["closePath"],
      ],
      "#c9d6b0",
    );
    path(
      c,
      [
        ["moveTo", w * 0.24, h * 0.52],
        [
          "bezierCurveTo",
          w * 0.31,
          h * 0.39,
          w * 0.4,
          h * 0.41,
          w * 0.48,
          h * 0.46,
        ],
      ],
      null,
      "#bbcaa7",
      1.4,
    );
    path(
      c,
      [
        ["moveTo", w * 0.58, h * 0.54],
        [
          "bezierCurveTo",
          w * 0.67,
          h * 0.42,
          w * 0.7,
          h * 0.37,
          w * 0.78,
          h * 0.42,
        ],
      ],
      null,
      "#b8c8a1",
      1.4,
    );
    const cs = Math.min(w / 1200, h / 360);
    cloud(c, w * 0.19, h * 0.2, cs * 0.83);
    cloud(c, w * 0.47, h * 0.13, cs * 0.6);
    cloud(c, w * 0.85, h * 0.29, cs * 0.75);
    windmill(c, w * 0.33, h * 0.43, cs * 0.57, 0);
    windmill(c, w * 0.69, h * 0.45, cs * 0.38, 1);
    path(
      c,
      [
        ["moveTo", 0, h * 0.7],
        [
          "bezierCurveTo",
          w * 0.23,
          h * 0.61,
          w * 0.31,
          h * 0.71,
          w * 0.52,
          h * 0.65,
        ],
        ["bezierCurveTo", w * 0.74, h * 0.59, w * 0.88, h * 0.64, w, h * 0.68],
        ["lineTo", w, h],
        ["lineTo", 0, h],
        ["closePath"],
      ],
      "#baca9c",
    );
    for (let i = 0; i < 9; i++) {
      bush(
        c,
        w * (0.025 + i * 0.117),
        h * (0.675 + Math.sin(i * 5) * 0.012),
        cs * (0.3 + (i % 3) * 0.06),
        i % 2 ? "#afc18d" : "#c6d2a5",
      );
    }
    path(
      c,
      [
        ["moveTo", 0, h * 0.74],
        ["bezierCurveTo", w * 0.3, h * 0.72, w * 0.57, h * 0.75, w, h * 0.72],
        ["lineTo", w, h * 0.875],
        ["bezierCurveTo", w * 0.6, h * 0.82, w * 0.35, h * 0.87, 0, h * 0.86],
        ["closePath"],
      ],
      "#ddd9b8",
    );
    path(
      c,
      [
        ["moveTo", 0, h * 0.74],
        ["bezierCurveTo", w * 0.3, h * 0.72, w * 0.57, h * 0.75, w, h * 0.72],
      ],
      null,
      "#a4b783",
      1.4,
    );
    for (let i = 0; i < 46; i++) {
      const x = w * ((i * 0.1973) % 1),
        y = h * (0.8 + Math.sin(i * 2.17) * 0.028);
      line(c, x, y, x + 3 + (i % 4), y - 0.3, "#c6c29b", 1.2);
    }
    for (let i = 0; i < 42; i++) {
      const x = w * ((i * 0.197) % 1),
        y = h * (0.64 + (i % 4) * 0.02),
        s = cs * 3;
      line(c, x, y, x - s, y - s * 1.3, "#93aa73", 1);
      line(c, x, y, x + s * 0.3, y - s * 1.8, "#93aa73", 1);
      line(c, x, y, x + s, y - s, "#93aa73", 1);
    }
    for (let i = 0; i < 15; i++) {
      const x = w * ((i * 0.187 + 0.04) % 1),
        y = h * (0.65 + (i % 3) * 0.025);
      line(c, x, y, x, y - 5 * cs, "#8fa476", 1);
      oval(c, x, y - 6 * cs, 2.7 * cs, 2.7 * cs, i % 2 ? "#f5eed1" : "#d9d6aa");
      oval(c, x, y - 6 * cs, 1 * cs, 1 * cs, "#c2ad6c");
    }
    path(
      c,
      [
        ["moveTo", 0, h * 0.96],
        [
          "bezierCurveTo",
          w * 0.2,
          h * 0.88,
          w * 0.5,
          h * 0.99,
          w * 0.66,
          h * 0.94,
        ],
        ["bezierCurveTo", w * 0.8, h * 0.91, w * 0.9, h * 0.94, w, h * 0.93],
        ["lineTo", w, h],
        ["lineTo", 0, h],
        ["closePath"],
      ],
      "#b1c48f",
    );
    for (let i = 0; i < 12; i++)
      bush(c, w * (i * 0.095), h * 1.01, cs * 0.3, "#a6bb82");
  }
  resetForBattle(battle) {
    const identity = battle ?? null;
    if (identity === this.battleIdentity) return;
    this.battleIdentity = identity;
    this.fx = [];
  }
  addFx(fx) {
    this.fx.push(fx);
    if (this.fx.length > MAX_FX) this.fx.splice(0, this.fx.length - MAX_FX);
  }
  consumeEvents(events, battle) {
    this.resetForBattle(battle);
    const fallbackTime = Number.isFinite(battle?.time) ? battle.time : 0;
    for (const event of Array.isArray(events) ? events : []) {
      const life =
        event?.type === "hit" && event.kind === "cannon"
          ? 0.58
          : FX_LIFETIME[event?.type];
      if (!life || !Number.isFinite(event.x)) continue;
      this.addFx({
        ...event,
        type: event.type,
        time: Number.isFinite(event.time) ? event.time : fallbackTime,
        life,
      });
    }
  }
  drawWindupAccent(c, unit, size) {
    const kind = unit.action?.kind ?? ATTACK_KIND[unit.id];
    const color = unit.team === "enemy" ? "#c59a79" : "#a8b987";
    c.save();
    c.globalAlpha = 0.76;
    if (unit.id === "rabbit") {
      line(
        c,
        size * 0.27,
        -size * 0.42,
        size * 0.4,
        -size * 0.75,
        "#c3ad82",
        Math.max(1.5, size * 0.035),
      );
      line(
        c,
        size * 0.36,
        -size * 0.52,
        size * 0.44,
        -size * 0.69,
        "#f0dfb8",
        1.3,
      );
    } else if (unit.id === "sheep") {
      c.strokeStyle = "#d8dfc5";
      c.lineWidth = Math.max(1.5, size * 0.04);
      c.beginPath();
      c.ellipse(
        size * 0.3,
        -size * 0.4,
        size * 0.12,
        size * 0.2,
        0.15,
        -1.2,
        1.2,
      );
      c.stroke();
      line(
        c,
        size * 0.2,
        -size * 0.5,
        size * 0.34,
        -size * 0.47,
        "#e9e8c9",
        1.5,
      );
    } else if (unit.id === "boar") {
      oval(c, size * 0.38, -size * 0.06, size * 0.085, size * 0.035, color);
      oval(c, size * 0.5, -size * 0.1, size * 0.05, size * 0.025, "#d8d6bd");
    } else if (kind === "seed") {
      oval(c, size * 0.27, -size * 0.53, size * 0.055, size * 0.04, "#c9b47e");
      line(c, size * 0.27, -size * 0.53, size * 0.35, -size * 0.61, color, 1.5);
    } else if (kind === "water") {
      for (let i = 0; i < 3; i++)
        oval(
          c,
          size * (0.38 + i * 0.055),
          -size * (0.69 + (i % 2) * 0.07),
          size * 0.025,
          size * 0.035,
          "#d9e5d0",
        );
    } else if (kind === "bolt") {
      oval(c, size * 0.08, -size * 0.82, size * 0.13, size * 0.035, "#d9dda9");
      line(
        c,
        size * 0.05,
        -size * 0.87,
        size * 0.12,
        -size * 0.77,
        "#c2c894",
        1.6,
      );
      oval(
        c,
        -size * 0.22,
        -size * 0.77,
        size * 0.075,
        size * 0.045,
        "#f3f3e8",
      );
      oval(c, size * 0.26, -size * 0.78, size * 0.065, size * 0.04, "#f3f3e8");
    } else if (kind === "spore") {
      for (const [dx, dy] of [
        [-0.14, -0.85],
        [0.08, -0.9],
        [0.25, -0.82],
      ])
        oval(c, size * dx, size * dy, size * 0.035, size * 0.035, "#e4d7b6");
    } else {
      oval(c, size * 0.36, -size * 0.12, size * 0.05, size * 0.026, color);
      oval(c, size * 0.43, -size * 0.08, size * 0.03, size * 0.02, color);
    }
    c.restore();
  }
  drawStatusMarks(c, unit, x, y, size) {
    const marks = [];
    if (!unit.dead && unit.regeneration)
      marks.push({ kind: "regen", color: "#8da574" });
    if (unit.slowRemaining > 0) marks.push({ kind: "slow", color: "#78a9b7" });
    if (unit.regenSuppressionRemaining > 0)
      marks.push({ kind: "suppressed", color: "#bb8b81" });
    if (!marks.length) return;
    const radius = Math.max(3, size * 0.095);
    const startX = x + size * 0.34;
    const markY = y - size * 0.78;
    marks.forEach((mark, index) => {
      const markX = startX + index * radius * 2.2;
      oval(c, markX, markY, radius, radius, "#f8f6e8", mark.color, 1.2);
      if (mark.kind === "regen") {
        line(
          c,
          markX - radius * 0.45,
          markY,
          markX + radius * 0.45,
          markY,
          mark.color,
          1.1,
        );
        line(
          c,
          markX,
          markY - radius * 0.45,
          markX,
          markY + radius * 0.45,
          mark.color,
          1.1,
        );
      } else if (mark.kind === "slow") {
        line(
          c,
          markX,
          markY - radius * 0.5,
          markX,
          markY + radius * 0.35,
          mark.color,
          1.1,
        );
        line(
          c,
          markX - radius * 0.35,
          markY + radius * 0.05,
          markX,
          markY + radius * 0.42,
          mark.color,
          1.1,
        );
        line(
          c,
          markX + radius * 0.35,
          markY + radius * 0.05,
          markX,
          markY + radius * 0.42,
          mark.color,
          1.1,
        );
      } else {
        line(
          c,
          markX - radius * 0.48,
          markY + radius * 0.4,
          markX + radius * 0.48,
          markY - radius * 0.4,
          mark.color,
          1.3,
        );
      }
    });
  }
  drawProjectile(c, projectile, ground, baseSize, w, h) {
    const duration = Number.isFinite(projectile.duration)
      ? projectile.duration
      : 0;
    const progress = Math.max(
      0,
      Math.min(1, duration > 0 ? projectile.elapsed / duration : 1),
    );
    const startX = Number.isFinite(projectile.startX) ? projectile.startX : 0;
    const targetX = Number.isFinite(projectile.targetX)
      ? projectile.targetX
      : startX;
    const kind = projectile.kind ?? "seed";
    const team = projectile.team === "enemy" ? "enemy" : "player";
    const colors = {
      seed: team === "enemy" ? "#b18c69" : "#9c9c68",
      water: team === "enemy" ? "#c49c82" : "#a9c9bf",
      bolt: team === "enemy" ? "#d1a27e" : "#d5d69e",
      spore: team === "enemy" ? "#c18f78" : "#b5a675",
    };
    const color = colors[kind] ?? colors.seed;
    const arcHeight =
      kind === "water"
        ? Math.min(h * 0.16, 34)
        : kind === "spore"
          ? Math.min(h * 0.12, 27)
          : kind === "seed"
            ? Math.min(h * 0.045, 10)
            : 0;
    const pointAt = (t) => ({
      x: ((startX + (targetX - startX) * t) / 1200) * w,
      y: ground - baseSize * 0.58 - Math.sin(Math.PI * t) * arcHeight,
    });
    const point = pointAt(progress);
    const tail = pointAt(Math.max(0, progress - 0.12));
    const dir = Math.sign(targetX - startX) || (team === "player" ? 1 : -1);
    const radius = Math.max(4, baseSize * 0.105);

    c.save();
    c.globalAlpha = 0.66;
    c.strokeStyle = color;
    c.lineWidth = Math.max(1.4, radius * 0.45);
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(tail.x, tail.y);
    c.lineTo(point.x, point.y);
    c.stroke();
    c.globalAlpha = 1;
    c.translate(point.x, point.y);
    if (kind === "bolt") {
      c.strokeStyle = color;
      c.lineWidth = Math.max(2, radius * 0.48);
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      c.moveTo(-dir * radius, -radius * 0.9);
      c.lineTo(dir * radius * 0.15, -radius * 0.2);
      c.lineTo(-dir * radius * 0.15, radius * 0.2);
      c.lineTo(dir * radius, radius * 0.9);
      c.stroke();
    } else if (kind === "water") {
      c.rotate(dir * (0.2 + progress * 0.24));
      c.beginPath();
      c.moveTo(0, -radius * 1.35);
      c.quadraticCurveTo(
        radius * 1.05,
        -radius * 0.1,
        radius * 0.78,
        radius * 0.68,
      );
      c.quadraticCurveTo(0, radius * 1.4, -radius * 0.78, radius * 0.68);
      c.quadraticCurveTo(-radius * 1.05, -radius * 0.1, 0, -radius * 1.35);
      c.fillStyle = color;
      c.fill();
      oval(
        c,
        -radius * 0.22,
        radius * 0.32,
        radius * 0.18,
        radius * 0.27,
        "#f8f7e8",
      );
    } else if (kind === "spore") {
      round(
        c,
        -radius * 0.19,
        0,
        radius * 0.38,
        radius * 0.9,
        radius * 0.16,
        "#f1e5c8",
      );
      oval(c, 0, -radius * 0.08, radius * 0.9, radius * 0.48, color);
    } else {
      c.rotate(dir * (0.15 + progress * 0.35));
      oval(c, 0, 0, radius * 0.72, radius * 0.48, color, "#766d4f", 1);
      path(
        c,
        [
          ["moveTo", radius * 0.15, -radius * 0.05],
          [
            "quadraticCurveTo",
            radius * 0.9,
            -radius * 0.95,
            radius * 1.15,
            -radius * 0.15,
          ],
          [
            "quadraticCurveTo",
            radius * 0.65,
            radius * 0.12,
            radius * 0.15,
            -radius * 0.05,
          ],
        ],
        "#a9b585",
      );
    }
    c.restore();
  }
  drawEffect(c, fx, age, ground, baseSize, w, h) {
    const progress = Math.max(0, Math.min(1, age / fx.life));
    const fade = (1 - progress) ** 1.25;
    const x = (fx.x / 1200) * w;
    const y = fx.type === "burst" ? h * 0.7 : ground - baseSize * 0.54;
    const dir = fx.team === "enemy" ? -1 : 1;
    const warm = fx.team === "enemy";
    const main = warm ? "#c08d74" : "#a5b484";
    const pale = warm ? "#e9d3be" : "#e9e8c9";

    c.save();
    c.globalAlpha =
      fade * (fx.type === "impact" && fx.hit === false ? 0.62 : 1);
    if (fx.type === "attack") {
      if ((fx.kind ?? ATTACK_KIND[fx.id]) === "melee") {
        c.translate(x, y);
        c.scale(dir, 1);
        c.strokeStyle = pale;
        c.lineWidth = Math.max(2, baseSize * 0.045);
        c.lineCap = "round";
        c.beginPath();
        c.arc(
          baseSize * 0.16,
          0,
          baseSize * (0.26 + progress * 0.12),
          -1.05,
          0.86,
        );
        c.stroke();
        c.strokeStyle = main;
        c.lineWidth = Math.max(1, baseSize * 0.018);
        c.beginPath();
        c.arc(
          baseSize * 0.16,
          0,
          baseSize * (0.33 + progress * 0.12),
          -0.96,
          0.78,
        );
        c.stroke();
      } else {
        oval(
          c,
          x + dir * baseSize * 0.18,
          y,
          baseSize * (0.11 - progress * 0.055),
          baseSize * 0.085,
          pale,
        );
        line(
          c,
          x + dir * baseSize * 0.18,
          y,
          x + dir * baseSize * 0.42,
          y - baseSize * 0.045,
          main,
          1.5,
        );
      }
    } else if (
      fx.type === "impact" ||
      fx.type === "burst" ||
      fx.type === "castle-hit" ||
      fx.type === "summon" ||
      fx.type === "spawn"
    ) {
      const splash = Number.isFinite(fx.splashRadius)
        ? (fx.splashRadius / 1200) * w * 0.72
        : 0;
      const maxRadius =
        fx.type === "burst"
          ? Math.min(h * 0.19, 58)
          : fx.type === "castle-hit"
            ? baseSize * 0.45
            : Math.min(Math.max(baseSize * 0.22, splash), 44);
      const radius = maxRadius * (0.28 + progress * 0.72);
      c.strokeStyle = fx.hit === false ? pale : main;
      c.lineWidth = Math.max(
        1.5,
        (1 - progress) * (fx.type === "burst" ? 5 : 3),
      );
      c.beginPath();
      c.arc(x, y, radius, 0, Math.PI * 2);
      c.stroke();
      if (
        fx.type === "burst" ||
        fx.type === "impact" ||
        fx.type === "castle-hit"
      ) {
        const count = fx.type === "burst" ? 9 : 6;
        for (let index = 0; index < count; index++) {
          const angle = (Math.PI * 2 * index) / count + (warm ? 0.2 : 0);
          const distance = radius * (0.5 + (index % 3) * 0.15);
          const dotX = x + Math.cos(angle) * distance;
          const dotY =
            y + Math.sin(angle) * distance * 0.62 - progress * baseSize * 0.09;
          oval(
            c,
            dotX,
            dotY,
            Math.max(1.2, baseSize * 0.035 * (1 - progress)),
            Math.max(1, baseSize * 0.025 * (1 - progress)),
            index % 2 ? pale : main,
          );
        }
      }
    } else if (fx.type === "hit") {
      if (fx.kind === "cannon") {
        const radius = baseSize * (0.28 + progress * 0.48);
        c.strokeStyle = "#e8dcb5";
        c.lineWidth = Math.max(2, baseSize * 0.055 * (1 - progress * 0.65));
        c.beginPath();
        c.arc(x, y, radius, 0, Math.PI * 2);
        c.stroke();
        for (let index = 0; index < 7; index++) {
          const angle = (Math.PI * 2 * index) / 7;
          const distance = radius * (0.58 + (index % 3) * 0.12);
          oval(
            c,
            x + Math.cos(angle) * distance,
            y + Math.sin(angle) * distance * 0.62,
            baseSize * 0.045 * (1 - progress),
            baseSize * 0.033 * (1 - progress),
            index % 2 ? pale : main,
          );
        }
      } else {
        const radius = baseSize * (0.12 + progress * 0.18);
        c.strokeStyle = warm ? "#e2b79a" : "#e9e5c3";
        c.lineWidth = Math.max(1.5, baseSize * 0.025);
        for (let index = 0; index < 4; index++) {
          const angle = (Math.PI * 2 * index) / 4 + Math.PI / 4;
          line(
            c,
            x + Math.cos(angle) * radius * 0.35,
            y + Math.sin(angle) * radius * 0.35,
            x + Math.cos(angle) * radius,
            y + Math.sin(angle) * radius,
            c.strokeStyle,
            c.lineWidth,
          );
        }
      }
    } else if (fx.type === "heal") {
      for (let index = 0; index < 4; index++) {
        const drift = progress * baseSize * (0.2 + index * 0.045);
        const dotX = x + Math.sin(index * 2.2) * baseSize * 0.2;
        const dotY = y - drift - (index % 2) * baseSize * 0.14;
        oval(
          c,
          dotX,
          dotY,
          baseSize * 0.035,
          baseSize * 0.06,
          index % 2 ? "#dfe6c6" : "#a9bd91",
        );
      }
    } else if (fx.type === "death") {
      for (let index = 0; index < 5; index++) {
        const spread = (index - 2) * baseSize * 0.09;
        const lift = progress * baseSize * (0.12 + (index % 3) * 0.035);
        oval(
          c,
          x + spread,
          y + baseSize * 0.18 - lift,
          baseSize * 0.075,
          baseSize * 0.035,
          index % 2 ? pale : main,
        );
      }
    }
    c.restore();
  }
  render(battle, wallTime, paused = false) {
    // `paused` stays in the public signature; battle.time is the frozen visual clock.
    void paused;
    const c = this.ctx,
      w = this.width,
      h = this.height;
    if (!w || !h) return;
    this.resetForBattle(battle);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.drawImage(this.bg, 0, 0, w, h);
    const { ground, castleSize, playerX, enemyX } = battlefieldLayout(w, h);
    const simulationTime = Number.isFinite(battle?.time)
      ? battle.time
      : wallTime;
    castle(c, playerX, ground, castleSize, false, simulationTime);
    castle(c, enemyX, ground, castleSize, true, simulationTime);
    if (!battle) return;
    const units = battle.units
      .filter((u) => !u.dead || (u.deathTimer ?? 0) > 0)
      .sort((a, b) => a.x - b.x);
    const baseSize = Math.min(82, h * 0.29, w * 0.078);
    for (const u of units) {
      const artId = u.artId ?? u.id;
      const sprite = SPRITES[u.id] ?? SPRITES[artId];
      if (!sprite?.complete || !sprite.naturalWidth) continue;
      const visualUnit = artId === u.id ? u : { ...u, id: artId };
      const uid =
        Number.parseInt(String(u.uid ?? "").replace(/^\D+/, ""), 10) || 0;
      const size =
        baseSize *
        (artId === "boar"
          ? 1.2
          : artId === "sheep"
            ? 1.08
            : artId === "beetle"
              ? 0.85
              : 1);
      const pose = sampleUnitPose(visualUnit, simulationTime);
      const facing =
        u.facing === -1 || u.facing === 1
          ? u.facing
          : u.team === "enemy"
            ? -1
            : 1;
      const x = (u.x / 1200) * w + pose.offsetX * size;
      const row = (uid % 3) * Math.min(5, h * 0.011);
      const y = ground - row + pose.offsetY * size;
      c.globalAlpha = 0.34 * pose.alpha;
      oval(c, x, ground - row + 1, size * 0.31, size * 0.058, "#405b301d");
      c.globalAlpha = 1;
      c.save();
      c.translate(x, y);
      c.scale(facing, 1);
      c.rotate(pose.rotation);
      c.scale(pose.scaleX, pose.scaleY);
      c.globalAlpha = pose.alpha * (u.hitFlash > 0 ? 0.58 : 1);
      c.drawImage(sprite, -size / 2, -size, size, size * 0.9375);
      if (u.action?.phase === "windup" && pose.phase === "windup")
        this.drawWindupAccent(c, visualUnit, size);
      c.restore();
      const hasShield = Number.isFinite(u.maxShield) && u.maxShield > 0;
      if (!u.dead && hasShield && u.shield > 0) {
        c.save();
        c.globalAlpha = 0.78 * pose.alpha;
        path(
          c,
          [
            ["moveTo", x, y - size * 0.98],
            [
              "quadraticCurveTo",
              x + size * 0.46,
              y - size * 0.88,
              x + size * 0.43,
              y - size * 0.43,
            ],
            [
              "quadraticCurveTo",
              x + size * 0.34,
              y - size * 0.08,
              x,
              y + size * 0.02,
            ],
            [
              "quadraticCurveTo",
              x - size * 0.34,
              y - size * 0.08,
              x - size * 0.43,
              y - size * 0.43,
            ],
            [
              "quadraticCurveTo",
              x - size * 0.46,
              y - size * 0.88,
              x,
              y - size * 0.98,
            ],
            ["closePath"],
          ],
          null,
          "#7eafa4",
          Math.max(1.1, size * 0.022),
        );
        c.restore();
      }
      if (!u.dead && (u.hp < u.maxHp || hasShield)) {
        round(
          c,
          x - size * 0.22,
          y - size - 4,
          size * 0.44,
          3.5,
          2,
          "#5b624524",
        );
        round(
          c,
          x - size * 0.22,
          y - size - 4,
          size * 0.44 * Math.max(0, u.hp / u.maxHp),
          3.5,
          2,
          u.team === "player" ? "#8da574" : "#bf9672",
        );
        if (hasShield) {
          const shieldY = y - size - 8;
          round(c, x - size * 0.22, shieldY, size * 0.44, 2, 1, "#5b624524");
          round(
            c,
            x - size * 0.22,
            shieldY,
            size *
              0.44 *
              Math.max(0, Math.min(1, (u.shield ?? 0) / u.maxShield)),
            2,
            1,
            "#7eafa4",
          );
        }
      }
      if (!u.dead) this.drawStatusMarks(c, u, x, y, size);
    }
    const projectiles = Array.isArray(battle.projectiles)
      ? battle.projectiles
      : [];
    for (const projectile of projectiles)
      this.drawProjectile(c, projectile, ground, baseSize, w, h);
    this.fx = this.fx
      .filter((fx) => simulationTime - fx.time < fx.life)
      .slice(-MAX_FX);
    for (const fx of this.fx) {
      const age = Math.max(0, simulationTime - fx.time);
      this.drawEffect(c, fx, age, ground, baseSize, w, h);
    }
  }
  burst(x = 600, time = 0) {
    this.addFx({
      type: "burst",
      x,
      team: "player",
      id: "teapot",
      time: Number.isFinite(time) ? time : 0,
      life: FX_LIFETIME.burst,
    });
  }
}
