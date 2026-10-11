import test from "node:test";
import assert from "node:assert/strict";
import { sampleUnitPose } from "../dist/src/combat-visuals.js";

test("windup crouches back more as its simulation phase advances", () => {
  const unit = {
    uid: "u7",
    id: "rabbit",
    team: "player",
    facing: 1,
    action: { phase: "windup", elapsed: 0.8, duration: 1, kind: "melee" },
  };
  const early = sampleUnitPose(
    { ...unit, action: { ...unit.action, elapsed: 0.1 } },
    0.1,
  );
  const late = sampleUnitPose(unit, 0.8);

  assert.equal(late.phase, "windup");
  assert.ok(late.offsetX < early.offsetX);
  assert.ok(late.scaleY < early.scaleY);
});

test("recovery lunges at release and settles to idle by its end", () => {
  const unit = {
    uid: "u2",
    id: "boar",
    team: "enemy",
    facing: -1,
    action: { phase: "recovery", elapsed: 0, duration: 0.3, kind: "melee" },
  };
  const release = sampleUnitPose(unit, 2);
  const settled = sampleUnitPose(
    { ...unit, action: { ...unit.action, elapsed: 0.3 } },
    2.3,
  );

  assert.equal(release.phase, "recovery");
  assert.ok(release.offsetX < 0);
  assert.ok(Math.abs(settled.offsetX) < 1e-10);
  assert.ok(Math.abs(settled.rotation) < 1e-10);
});

test("hit recoil overrides a frozen attack pose and follows the hit direction", () => {
  const pose = sampleUnitPose(
    {
      uid: "u4",
      id: "sheep",
      team: "player",
      facing: 1,
      action: { phase: "windup", elapsed: 0.6, duration: 0.8, kind: "melee" },
      hitStun: 0.09,
      hitStunDuration: 0.18,
      hitDirection: -1,
    },
    3,
  );

  assert.equal(pose.phase, "hit");
  assert.ok(pose.offsetX < 0);
  assert.ok(pose.scaleY < 1);

  const heavyHit = sampleUnitPose(
    {
      uid: "u4",
      id: "sheep",
      team: "player",
      facing: 1,
      hitStun: 0.09,
      hitStunDuration: 0.24,
      hitDirection: -1,
    },
    3,
  );
  assert.ok(Math.abs(heavyHit.offsetX) < Math.abs(pose.offsetX));
});

test("walking and idle poses are fixed by simulation time", () => {
  const unit = { uid: "u8", id: "cloud", team: "player", moving: true };
  const first = sampleUnitPose(unit, 1);
  const repeated = sampleUnitPose(unit, 1);
  const later = sampleUnitPose(unit, 99);

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, later);
});

test("renderer effects follow simulation time, reset by battle identity, and stay bounded", async () => {
  const original = new Map();
  const canvasContexts = [];
  const keys = ["Image", "ResizeObserver", "document", "devicePixelRatio"];
  for (const key of keys)
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));

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
    canvasContexts.push(context);
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
    const canvas = makeCanvas();
    const renderer = new Renderer(canvas);
    const context = canvasContexts[0];
    const unit = {
      uid: "u1",
      id: "cloud",
      team: "player",
      x: 500,
      moving: true,
    };
    const battle = {
      time: 0.5,
      units: [unit],
      projectiles: ["seed", "water", "bolt", "spore"].map((kind) => ({
        kind,
        team: kind === "spore" ? "enemy" : "player",
        startX: kind === "spore" ? 700 : 500,
        targetX: kind === "spore" ? 500 : 700,
        elapsed: 0.25,
        duration: 0.5,
      })),
      finished: false,
    };

    renderer.consumeEvents(
      [
        {
          type: "impact",
          x: 520,
          team: "player",
          kind: "water",
          time: 0.5,
          hit: true,
        },
      ],
      battle,
    );
    battle.time = 0.75;
    renderer.consumeEvents(
      [
        {
          type: "impact",
          x: 610,
          team: "enemy",
          kind: "spore",
          time: 0.75,
          hit: true,
        },
      ],
      battle,
    );
    assert.equal(renderer.fx.length, 2);

    const visualCalls = () =>
      context.calls.filter(([name]) =>
        ["translate", "rotate", "scale", "drawImage", "arc"].includes(name),
      );
    context.calls.length = 0;
    renderer.render(battle, 100, true);
    const firstFrame = visualCalls();
    assert.ok(
      context.calls.every(([, ...args]) =>
        args.every(
          (value) => typeof value !== "number" || Number.isFinite(value),
        ),
      ),
    );
    context.calls.length = 0;
    renderer.render(battle, 1000, true);
    assert.deepEqual(visualCalls(), firstFrame);
    assert.equal(renderer.fx.length, 2);

    battle.time = 1;
    renderer.render(battle, 1001, false);
    assert.equal(renderer.fx.length, 1);
    battle.time = 2;
    renderer.render(battle, 1002, false);
    assert.equal(renderer.fx.length, 0);

    renderer.consumeEvents(
      [
        {
          type: "impact",
          x: 700,
          team: "player",
          kind: "seed",
          time: 2,
          hit: true,
        },
      ],
      battle,
    );
    const nextBattle = {
      time: 0,
      units: [{ ...unit, x: 500 }],
      projectiles: [],
      finished: false,
    };
    renderer.consumeEvents([], nextBattle);
    assert.equal(renderer.fx.length, 0);

    renderer.consumeEvents(
      Array.from({ length: 140 }, (_, index) => ({
        type: "impact",
        x: 100 + index,
        team: "player",
        kind: "water",
        time: 0,
        hit: true,
      })),
      nextBattle,
    );
    assert.equal(renderer.fx.length, 96);
  } finally {
    for (const key of keys) {
      const descriptor = original.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
