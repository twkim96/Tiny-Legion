import test from "node:test";
import assert from "node:assert/strict";
import { portrait, spriteSvg } from "../dist/src/art.js";
import { sampleUnitPose } from "../dist/src/combat-visuals.js";
import { createBattle, summonUnit } from "../dist/src/engine.js";
import {
  ENEMIES,
  RARITIES,
  STARTER_UNIT_IDS,
  UNITS,
} from "../dist/src/data.js";

const NEW_UNIT_IDS = UNITS.filter(
  (unit) => !STARTER_UNIT_IDS.includes(unit.id),
).map((unit) => unit.id);

test("roster has unique IDs and reachable pools for every rarity", () => {
  assert.equal(new Set(UNITS.map((unit) => unit.id)).size, UNITS.length);
  assert.ok(
    STARTER_UNIT_IDS.every((id) => UNITS.some((unit) => unit.id === id)),
  );
  assert.ok(
    Math.abs(RARITIES.reduce((sum, rarity) => sum + rarity.rate, 0) - 1) <
      1e-12,
  );
  for (const rarity of RARITIES) {
    assert.ok(
      UNITS.some((unit) => unit.rarity === rarity.id),
      `empty pool for ${rarity.id}`,
    );
  }
  for (const unit of UNITS) {
    assert.ok(RARITIES.some((rarity) => rarity.id === unit.rarity));
    for (const stat of [
      "hp",
      "attack",
      "range",
      "speed",
      "cost",
      "cooldown",
      "attackInterval",
      "attackWindup",
      "attackRecovery",
    ]) {
      assert.ok(
        Number.isFinite(unit[stat]) && unit[stat] > 0,
        `${unit.id}.${stat} must be positive`,
      );
    }
  }
});

function assertWellFormedSvg(svg, id) {
  assert.match(
    svg,
    /^<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>[\s\S]*<\/svg>$/,
  );
  const tokens = svg.match(/<\/?[A-Za-z][^>]*>/g) ?? [];
  const stack = [];
  for (const token of tokens) {
    const closing = token.match(/^<\/([A-Za-z][\w:-]*)\s*>$/);
    if (closing) {
      assert.equal(stack.pop(), closing[1], `${id} has mismatched SVG tags`);
      continue;
    }
    const opening = token.match(/^<([A-Za-z][\w:-]*)\b[^>]*?(\/?)>$/);
    assert.ok(opening, `${id} has a malformed SVG tag: ${token}`);
    if (!opening[2]) stack.push(opening[1]);
  }
  assert.deepEqual(stack, [], `${id} has unclosed SVG tags`);
}

test("every companion has unique, well-formed portrait and battle SVG art", () => {
  const ids = UNITS.map((unit) => unit.id);
  const sprites = ids.map((id) => spriteSvg(id));
  assert.equal(new Set(sprites).size, ids.length);

  for (const [index, id] of ids.entries()) {
    assertWellFormedSvg(sprites[index], id);
    assert.match(portrait(id, "roster-check"), /class="portrait roster-check"/);
  }
  for (const id of NEW_UNIT_IDS) {
    assert.ok(ids.includes(id));
    assert.notEqual(
      spriteSvg(id),
      spriteSvg("sheep"),
      `${id} fell back to the sheep art`,
    );
  }
});

test("every companion is summonable within battle gold limits", () => {
  for (const unit of UNITS) {
    const battle = createBattle({ mode: "challenge", sequence: [] });
    battle._spawnSchedule = [];
    assert.ok(
      unit.cost <= battle.maxGold,
      `${unit.id} costs more than the gold cap`,
    );
    battle.gold = unit.cost;
    assert.equal(
      summonUnit(battle, unit.id),
      true,
      `${unit.id} should summon at its cost`,
    );
    assert.equal(battle.gold, 0);
    assert.equal(battle.units.length, 1);
    assert.equal(battle.units[0].id, unit.id);
  }
});

test("new companions receive finite visible idle, windup, and recovery poses", () => {
  for (const id of NEW_UNIT_IDS) {
    const base = { id, uid: `roster-${id}`, team: "player", moving: true };
    const poses = [
      sampleUnitPose(base, 1.25),
      sampleUnitPose(
        { ...base, action: { phase: "windup", elapsed: 0.4, duration: 0.8 } },
        1.25,
      ),
      sampleUnitPose(
        { ...base, action: { phase: "recovery", elapsed: 0.1, duration: 0.4 } },
        1.25,
      ),
    ];
    assert.deepEqual(
      poses.map((pose) => pose.phase),
      ["idle", "windup", "recovery"],
    );
    for (const pose of poses) {
      for (const value of Object.values(pose))
        if (typeof value === "number")
          assert.ok(Number.isFinite(value), `${id} has a non-finite pose`);
      assert.ok(pose.alpha > 0);
      assert.ok(pose.scaleX > 0 && pose.scaleY > 0);
    }
    assert.ok(
      Math.abs(poses[1].rotation) > 0 || Math.abs(poses[1].offsetX) > 0,
    );
    assert.ok(
      Math.abs(poses[2].rotation) > 0 || Math.abs(poses[2].offsetX) > 0,
    );
  }
});

test("renderer draws every roster companion and keeps enemy art aliases", async () => {
  const keys = ["Image", "ResizeObserver", "document", "devicePixelRatio"];
  const original = new Map(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const contexts = [];
  const makeCanvas = (width = 320, height = 180) => {
    const calls = [];
    const context = new Proxy(
      { calls, createLinearGradient: () => ({ addColorStop() {} }) },
      {
        get(target, key) {
          if (key in target) return target[key];
          return (...args) => calls.push([key, ...args]);
        },
        set(target, key, value) {
          target[key] = value;
          return true;
        },
      },
    );
    contexts.push(context);
    return {
      width,
      height,
      getContext: () => context,
      getBoundingClientRect: () => ({ width, height }),
    };
  };

  globalThis.Image = class {
    constructor() {
      this.complete = true;
      this.naturalWidth = 128;
    }
  };
  globalThis.ResizeObserver = class {
    observe() {}
  };
  globalThis.document = { createElement: () => makeCanvas() };
  globalThis.devicePixelRatio = 1;

  try {
    const { Renderer } = await import("../dist/src/renderer.js");
    const renderer = new Renderer(makeCanvas());
    const units = [
      ...UNITS.map((definition, index) => ({
        uid: `u${index + 1}`,
        id: definition.id,
        team: "player",
        x: 220 + index * 32,
        moving: true,
      })),
      ...ENEMIES.filter((definition) => definition.artId).map(
        (definition, index) => ({
          uid: `enemy${index + 1}`,
          id: definition.id,
          artId: definition.artId,
          team: "enemy",
          x: 820 + index * 100,
          moving: true,
        }),
      ),
    ];
    renderer.render({ time: 1, units, projectiles: [], finished: false });
    const spriteDraws = contexts[0].calls.filter(
      ([name]) => name === "drawImage",
    );
    assert.equal(spriteDraws.length, units.length + 1);
  } finally {
    for (const key of keys) {
      const descriptor = original.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
