import { spriteSvg } from "./art.js";
const INK = "#4b5140";
const SPRITES = {};
for (const id of [
  "sheep",
  "rabbit",
  "squirrel",
  "teapot",
  "cloud",
  "beetle",
  "mushroom",
  "boar",
]) {
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
    this.seenAttacks = new Map();
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
    c.fillStyle = "#eef1e1";
    c.fillRect(0, 0, w, h);
    const gradient = c.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#f2f4e7");
    gradient.addColorStop(1, "#e7edda");
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
        ["moveTo", 0, h * 0.82],
        ["bezierCurveTo", w * 0.3, h * 0.8, w * 0.57, h * 0.83, w, h * 0.8],
        ["lineTo", w, h * 0.955],
        ["bezierCurveTo", w * 0.6, h * 0.9, w * 0.35, h * 0.95, 0, h * 0.94],
        ["closePath"],
      ],
      "#ddd9b8",
    );
    path(
      c,
      [
        ["moveTo", 0, h * 0.82],
        ["bezierCurveTo", w * 0.3, h * 0.8, w * 0.57, h * 0.83, w, h * 0.8],
      ],
      null,
      "#a4b783",
      1.4,
    );
    for (let i = 0; i < 46; i++) {
      const x = w * ((i * 0.1973) % 1),
        y = h * (0.88 + Math.sin(i * 2.17) * 0.028);
      line(c, x, y, x + 3 + (i % 4), y - 0.3, "#c6c29b", 1.2);
    }
    for (let i = 0; i < 42; i++) {
      const x = w * ((i * 0.197) % 1),
        y = h * (0.72 + (i % 4) * 0.02),
        s = cs * 3;
      line(c, x, y, x - s, y - s * 1.3, "#93aa73", 1);
      line(c, x, y, x + s * 0.3, y - s * 1.8, "#93aa73", 1);
      line(c, x, y, x + s, y - s, "#93aa73", 1);
    }
    for (let i = 0; i < 15; i++) {
      const x = w * ((i * 0.187 + 0.04) % 1),
        y = h * (0.73 + (i % 3) * 0.025);
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
  render(battle, wallTime, paused = false) {
    const c = this.ctx,
      w = this.width,
      h = this.height;
    if (!w || !h) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.drawImage(this.bg, 0, 0, w, h);
    const ground = h * 0.82;
    const castleSize = Math.min(115, h * 0.37, w * 0.105);
    castle(c, w * (80 / 1200), ground, castleSize, false, wallTime);
    castle(c, w * (1120 / 1200), ground, castleSize, true, wallTime);
    if (!battle) return;
    const units = battle.units.filter((u) => !u.dead).sort((a, b) => a.x - b.x);
    const baseSize = Math.min(82, h * 0.29, w * 0.078);
    for (const u of units) {
      const previous = this.seenAttacks.get(u.uid) || 0;
      if (u.attackFlash > previous + 0.01 && !paused) {
        this.fx.push({
          x: (u.x / 1200) * w,
          y: ground - baseSize * 0.48,
          team: u.team,
          id: u.id,
          life: 0.3,
          maxLife: 0.3,
        });
      }
      this.seenAttacks.set(u.uid, u.attackFlash || 0);
    }
    const liveIds = new Set(units.map((u) => u.uid));
    for (const id of this.seenAttacks.keys())
      if (!liveIds.has(id)) this.seenAttacks.delete(id);
    for (const u of units) {
      const sprite = SPRITES[u.id];
      if (!sprite?.complete || !sprite.naturalWidth) continue;
      const uid = parseInt(u.uid.slice(1)) || 0;
      const size =
        baseSize *
        (u.id === "boar"
          ? 1.2
          : u.id === "sheep"
            ? 1.08
            : u.id === "beetle"
              ? 0.85
              : 1);
      const x = (u.x / 1200) * w;
      const row = (uid % 3) * Math.min(5, h * 0.011);
      const step = paused ? 0 : Math.sin(battle.time * 9 + uid) * 1.8;
      const bob =
        u.id === "cloud" ? Math.sin(wallTime * 2 + uid) * 3 : Math.abs(step);
      const y = ground - row - bob;
      oval(c, x, y + 1, size * 0.31, size * 0.058, "#405b301d");
      c.save();
      c.translate(x, y);
      if (u.team === "enemy") c.scale(-1, 1);
      if (u.attackFlash > 0) c.rotate(-u.attackFlash * 0.12);
      else if (!paused) c.rotate(step * 0.009);
      c.globalAlpha = u.hitFlash > 0 ? 0.58 : 1;
      c.drawImage(sprite, -size / 2, -size, size, size * 0.9375);
      c.restore();
      if (u.hp < u.maxHp) {
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
      }
    }
    for (const f of this.fx) {
      if (!paused) f.life -= 1 / 60;
      const ratio = f.life / f.maxLife;
      c.globalAlpha = Math.max(0, ratio);
      const dir = f.team === "player" ? 1 : -1,
        dist = (1 - ratio) * 30;
      c.strokeStyle = f.team === "player" ? "#f8f5d0" : "#d3a080";
      c.lineWidth = 2;
      c.beginPath();
      if (["squirrel", "mushroom", "cloud"].includes(f.id)) {
        oval(
          c,
          f.x + dir * dist,
          f.y - (1 - ratio) * 10,
          3,
          2.5,
          f.id === "cloud" ? "#d8dcb9" : "#a49367",
        );
      } else {
        c.arc(f.x + dir * 18, f.y, 8 + (1 - ratio) * 7, -1.1, 1.1);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    this.fx = this.fx.filter((f) => f.life > 0).slice(-45);
  }
  burst(x = 600) {
    this.fx.push({
      x: (x / 1200) * this.width,
      y: this.height * 0.7,
      team: "player",
      id: "teapot",
      life: 0.6,
      maxLife: 0.6,
    });
  }
}
