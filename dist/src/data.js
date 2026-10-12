import { UNITS, getEnemy } from "./characters.js";
export { UNITS, ENEMIES, ATTRIBUTES, NEUTRAL_ATTRIBUTE, ROLE_SPECIALIZATION, ATTRIBUTE_BONUS_CAP, SHIELD_BONUS_CAP, stageLabel } from "./characters.js";
// Initial tuning, subject to play acceptance. Permanent equipment/specialty bonuses add.
export const BALANCE_VERSION = "early-tempo-13";
export const RARITIES = [
  { id: "common", name: "일반", color: "#7b8974", rate: 0.6 },
  { id: "rare", name: "희귀", color: "#6094a4", rate: 0.28 },
  { id: "epic", name: "영웅", color: "#9676ad", rate: 0.1 },
  { id: "legendary", name: "전설", color: "#c79b55", rate: 0.02 },
];
export const STARTER_UNIT_IDS = [
  "sheep",
  "rabbit",
  "squirrel",
  "teapot",
  "cloud",
];

// Each wave starts at `time` seconds. Its enemy groups may set count, interval,
// and x (the enemy spawn position) to shape the pace of the lane.
export const STAGES = [
  {
    id: 1,
    name: "첫 숲길",
    description: "작은 숲길에서 첫 무리를 막아 봐요.",
    baseReward: 100,
    enemyHp: 2000,
    enemyAttack: 1,
    waves: [
      {
        time: 0.6,
        enemies: [{ id: "beetle", count: 2, interval: 1.3, x: 1080 }],
      },
      {
        time: 13,
        enemies: [{ id: "mushroom", count: 2, interval: 1.5, x: 890 }],
      },
      {
        time: 27,
        enemies: [
          { id: "boar", count: 1, x: 920 },
          { id: "beetle", count: 2, interval: 1.2, x: 990 },
        ],
      },
      {
        time: 45,
        enemies: [
          { id: "mushroom", count: 3, interval: 1.6, x: 910 },
          { id: "beetle", count: 2, interval: 1.2, x: 1010 },
        ],
      },
      { time: 64, enemies: [{ id: "boar", count: 2, interval: 2, x: 960 }] },
      {
        time: 82,
        enemies: [
          { id: "mushroom", count: 4, interval: 1.5, x: 920 },
          { id: "beetle", count: 3, interval: 1.1, x: 1010 },
        ],
      },
      {
        time: 102,
        enemies: [
          { id: "boar", count: 2, interval: 2, x: 960 },
          { id: "mushroom", count: 3, interval: 1.4, x: 1030 },
        ],
      },
    ],
  },
  {
    id: 2,
    name: "버섯 오솔길",
    description: "원거리 버섯 무리가 숲길을 지켜요.",
    baseReward: 120,
    enemyHp: 2200,
    enemyAttack: 1.05,
    waves: [
      { time: 1, enemies: [{ id: "beetle", count: 3, interval: 1.2, x: 1080 }] },
      {
        time: 17,
        enemies: [{ id: "mushroom", count: 4, interval: 1.3, x: 930 }],
      },
      {
        time: 38,
        enemies: [
          { id: "boar", count: 2, interval: 2, x: 970 },
          { id: "beetle", count: 3, interval: 1.1, x: 1020 },
        ],
      },
      {
        time: 63,
        enemies: [{ id: "mushroom", count: 5, interval: 1.3, x: 940 }],
      },
      {
        time: 88,
        enemies: [
          { id: "boar", count: 3, interval: 1.8, x: 990 },
          { id: "mushroom", count: 3, interval: 1.5, x: 1040 },
        ],
      },
      {
        time: 108,
        enemies: [{ id: "beetle", count: 5, interval: 1, x: 1000 }],
      },
    ],
  },
  {
    id: 3,
    name: "돌다리",
    description: "튼튼한 돌다리 위로 무거운 적이 다가와요.",
    baseReward: 145,
    enemyHp: 2450,
    enemyAttack: 1.1,
    waves: [
      { time: 1, enemies: [{ id: "beetle", count: 3, interval: 1, x: 1080 }] },
      { time: 18, enemies: [{ id: "boar", count: 2, interval: 1.8, x: 950 }] },
      {
        time: 38,
        enemies: [
          { id: "mushroom", count: 4, interval: 1.3, x: 920 },
          { id: "beetle", count: 3, interval: 1, x: 1030 },
        ],
      },
      { time: 62, enemies: [{ id: "boar", count: 3, interval: 1.7, x: 980 }] },
      {
        time: 86,
        enemies: [
          { id: "mushroom", count: 5, interval: 1.2, x: 940 },
          { id: "boar", count: 2, interval: 1.8, x: 1030 },
        ],
      },
      {
        time: 107,
        enemies: [{ id: "beetle", count: 6, interval: 0.9, x: 990 }],
      },
    ],
  },
  {
    id: 4,
    name: "달빛 초원",
    description: "덩굴 곰이 앞줄을 막아요. 방패와 원거리 동료를 키워 돌파해 보세요.",
    baseReward: 170,
    enemyHp: 2700,
    enemyAttack: 1.15,
    waves: [
      { time: 1, enemies: [{ id: "beetle", count: 3, interval: 1, x: 1080 }] },
      {
        time: 17,
        enemies: [
          { id: "bear", count: 1, x: 1080 },
          { id: "mushroom", count: 2, interval: 1.5, x: 1080 },
        ],
      },
      {
        time: 39,
        enemies: [
          { id: "boar", count: 1, x: 1080 },
          { id: "beetle", count: 3, interval: 1.2, x: 1080 },
        ],
      },
      {
        time: 65,
        enemies: [{ id: "bear", count: 1, x: 1080 }, { id: "mushroom", count: 2, interval: 1.5, x: 1080 }],
      },
      {
        time: 88,
        enemies: [
          { id: "boar", count: 2, interval: 2, x: 1080 },
          { id: "beetle", count: 3, interval: 1.2, x: 1080 },
        ],
      },
      {
        time: 108,
        enemies: [{ id: "bear", count: 1, x: 1080 }],
      },
    ],
  },
  {
    id: 5,
    name: "풍차 언덕",
    description: "언덕길을 따라 빠른 적들이 모여들어요.",
    baseReward: 200,
    enemyHp: 3000,
    enemyAttack: 1.2,
    waves: [
      { time: 1, enemies: [{ id: "beetle", count: 4, interval: 0.9, x: 1080 }] },
      {
        time: 17,
        enemies: [
          { id: "mushroom", count: 5, interval: 1.1, x: 930 },
          { id: "boar", count: 2, interval: 1.6, x: 1020 },
        ],
      },
      { time: 40, enemies: [{ id: "boar", count: 4, interval: 1.4, x: 980 }] },
      {
        time: 65,
        enemies: [
          { id: "mushroom", count: 6, interval: 1, x: 940 },
          { id: "beetle", count: 4, interval: 0.9, x: 1030 },
        ],
      },
      {
        time: 89,
        enemies: [
          { id: "boar", count: 4, interval: 1.3, x: 990 },
          { id: "mushroom", count: 4, interval: 1.1, x: 1040 },
        ],
      },
      {
        time: 108,
        enemies: [{ id: "beetle", count: 8, interval: 0.8, x: 1000 }],
      },
    ],
  },
  {
    id: 6,
    name: "잿빛 늪",
    description: "늪지대의 단단한 적을 함께 상대해요.",
    baseReward: 235,
    enemyHp: 3350,
    enemyAttack: 1.25,
    waves: [
      {
        time: 1,
        enemies: [{ id: "beetle", count: 5, interval: 0.85, x: 1080 }],
      },
      {
        time: 18,
        enemies: [
          { id: "boar", count: 3, interval: 1.4, x: 970 },
          { id: "mushroom", count: 4, interval: 1.1, x: 1030 },
        ],
      },
      {
        time: 41,
        enemies: [{ id: "mushroom", count: 7, interval: 0.95, x: 940 }],
      },
      {
        time: 66,
        enemies: [
          { id: "boar", count: 5, interval: 1.2, x: 990 },
          { id: "beetle", count: 4, interval: 0.85, x: 1040 },
        ],
      },
      {
        time: 90,
        enemies: [
          { id: "mushroom", count: 7, interval: 0.9, x: 950 },
          { id: "boar", count: 3, interval: 1.3, x: 1040 },
        ],
      },
      {
        time: 109,
        enemies: [{ id: "beetle", count: 9, interval: 0.75, x: 1000 }],
      },
    ],
  },
  {
    id: 7,
    name: "종탑 앞",
    description: "종탑을 지키는 무리가 끝없이 이어져요.",
    baseReward: 275,
    enemyHp: 3750,
    enemyAttack: 1.3,
    waves: [
      { time: 1, enemies: [{ id: "beetle", count: 5, interval: 0.8, x: 1080 }] },
      {
        time: 17,
        enemies: [
          { id: "mushroom", count: 6, interval: 0.95, x: 930 },
          { id: "boar", count: 3, interval: 1.3, x: 1030 },
        ],
      },
      {
        time: 40,
        enemies: [
          { id: "boar", count: 5, interval: 1.1, x: 980 },
          { id: "beetle", count: 5, interval: 0.8, x: 1040 },
        ],
      },
      {
        time: 65,
        enemies: [{ id: "mushroom", count: 8, interval: 0.85, x: 940 }],
      },
      {
        time: 89,
        enemies: [
          { id: "boar", count: 5, interval: 1, x: 990 },
          { id: "mushroom", count: 6, interval: 0.9, x: 1040 },
        ],
      },
      {
        time: 108,
        enemies: [{ id: "beetle", count: 10, interval: 0.7, x: 1000 }],
      },
    ],
  },
  {
    id: 8,
    name: "수정 동굴",
    description: "수정 동굴의 강한 수비대를 돌파해요.",
    baseReward: 320,
    enemyHp: 4200,
    enemyAttack: 1.35,
    waves: [
      {
        time: 1,
        enemies: [{ id: "beetle", count: 6, interval: 0.75, x: 1080 }],
      },
      {
        time: 17,
        enemies: [
          { id: "mushroom", count: 7, interval: 0.85, x: 940 },
          { id: "boar", count: 3, interval: 1.2, x: 1030 },
        ],
      },
      {
        time: 40,
        enemies: [
          { id: "boar", count: 6, interval: 1, x: 990 },
          { id: "beetle", count: 5, interval: 0.75, x: 1040 },
        ],
      },
      {
        time: 65,
        enemies: [{ id: "mushroom", count: 9, interval: 0.75, x: 950 }],
      },
      {
        time: 89,
        enemies: [
          { id: "boar", count: 6, interval: 0.9, x: 1000 },
          { id: "mushroom", count: 7, interval: 0.8, x: 1040 },
        ],
      },
      {
        time: 108,
        enemies: [{ id: "beetle", count: 11, interval: 0.65, x: 1000 }],
      },
    ],
  },
  {
    id: 9,
    name: "폭풍 능선",
    description: "폭풍 속에서도 끝까지 진형을 지켜요.",
    baseReward: 370,
    enemyHp: 4700,
    enemyAttack: 1.4,
    waves: [
      { time: 1, enemies: [{ id: "beetle", count: 6, interval: 0.7, x: 1080 }] },
      {
        time: 16,
        enemies: [
          { id: "mushroom", count: 8, interval: 0.75, x: 940 },
          { id: "boar", count: 4, interval: 1, x: 1040 },
        ],
      },
      {
        time: 39,
        enemies: [
          { id: "boar", count: 7, interval: 0.85, x: 990 },
          { id: "beetle", count: 6, interval: 0.7, x: 1040 },
        ],
      },
      {
        time: 64,
        enemies: [{ id: "mushroom", count: 10, interval: 0.7, x: 950 }],
      },
      {
        time: 88,
        enemies: [
          { id: "boar", count: 7, interval: 0.8, x: 1000 },
          { id: "mushroom", count: 8, interval: 0.7, x: 1040 },
        ],
      },
      {
        time: 108,
        enemies: [{ id: "beetle", count: 12, interval: 0.6, x: 1000 }],
      },
    ],
  },
  {
    id: 10,
    name: "마지막 정원",
    description: "가장 큰 무리를 막고 마지막 문을 열어요.",
    baseReward: 430,
    enemyHp: 5300,
    enemyAttack: 1.45,
    waves: [
      {
        time: 1,
        enemies: [{ id: "beetle", count: 7, interval: 0.65, x: 1080 }],
      },
      {
        time: 16,
        enemies: [
          { id: "mushroom", count: 9, interval: 0.65, x: 950 },
          { id: "boar", count: 4, interval: 0.9, x: 1040 },
        ],
      },
      {
        time: 39,
        enemies: [
          { id: "boar", count: 8, interval: 0.75, x: 1000 },
          { id: "beetle", count: 7, interval: 0.65, x: 1040 },
        ],
      },
      {
        time: 64,
        enemies: [{ id: "mushroom", count: 11, interval: 0.6, x: 950 }],
      },
      {
        time: 88,
        enemies: [
          { id: "boar", count: 8, interval: 0.7, x: 1000 },
          { id: "mushroom", count: 9, interval: 0.65, x: 1040 },
        ],
      },
      {
        time: 107,
        enemies: [
          { id: "beetle", count: 14, interval: 0.55, x: 1000 },
          { id: "boar", count: 3, interval: 0.9, x: 1040 },
        ],
      },
    ],
  },
];

// Early milestones fund growth; later missions return to the normal reward pace.
for (const [id, gold] of [[3, 900], [4, 1200], [5, 1400], [6, 1600]]) {
  STAGES.find((stage) => stage.id === id).missionReward = { gold, diamonds: 30 };
}
// Introduce each silhouette separately, then mix the familiar threats.
for (const stage of STAGES) {
  for (const [index, wave] of stage.waves.entries()) {
    if (!index) continue;
    for (const group of wave.enemies) {
      if (stage.id >= 6 && group.id === "beetle" && index % 2 === 1) group.id = "badger";
      if (stage.id >= 8 && group.id === "mushroom" && index % 2 === 1) group.id = "porcupine";
      if (stage.id >= 5 && group.id === "boar" && index === 2) {
        group.id = "bear";
        group.count = Math.max(1, Math.ceil(group.count / 2));
      }
      if (stage.id === 5 || stage.id === 6) group.count = Math.max(1, Math.ceil((group.count ?? 1) * 0.6));
    }
  }
}

STAGES.find((stage) => stage.id === 6).waves[1].enemies[0].id = "badger";
STAGES.find((stage) => stage.id === 6).description = "바람 오소리가 빠르게 파고들어요. 앞줄을 지켜 주세요.";
STAGES.find((stage) => stage.id === 8).description = "가시 호저가 멀리서 씨앗을 날려요. 앞줄과 뒷줄을 함께 준비해 보세요.";

// Milestone bosses arrive before the first castle push, so they must be fought.
for (const [stageId, bossId] of [[5, "grove-bear"], [10, "grove-boar"]]) {
  const stage = STAGES.find((entry) => entry.id === stageId);
  stage.waves[0].enemies.push({ id: bossId, count: 1, x: 1080 });
  // The early boss replaces the old bear reinforcement, preserving mission growth.
  if (stageId === 5) {
    stage.waves[0].enemies[0].count = 1;
    stage.waves[2].enemies = [];
  } else {
    for (const wave of stage.waves) for (const group of wave.enemies) {
      if (group.id !== bossId) group.count = Math.ceil(group.count * 0.55);
    }
  }
  stage.description = "거대한 우두머리가 길을 막아요. 동료를 키워 함께 돌파해 보세요.";
}

// Region one teaches a single weakness; region two gradually mixes counters.
const firstRegion = [...STAGES];
for (const stage of firstRegion) {
  stage.region = 1;
  stage.regionName = "초원";
  for (const wave of stage.waves) for (const group of wave.enemies) {
    delete group.attribute;
    group.effects = { ...(group.effects ?? {}), shield: false, regeneration: false };
  }
}
for (const source of firstRegion) {
  const stage = JSON.parse(JSON.stringify(source));
  stage.id = source.id + 10;
  stage.region = 2;
  stage.regionName = "오래된 공방";
  stage.name = ["공방 입구", "녹슨 길", "작은 작업장", "빛의 샘", "톱니 언덕", "그늘 통로", "은빛 마당", "뒤섞인 숲", "깊은 공방", "공방의 문"][source.id - 1];
  stage.description = source.id < 4 ? "야생과 은색 기계 무리가 함께 나타나요." : "여러 색의 적을 보고 알맞은 동료를 골라 보세요.";
  stage.enemyHp = source.id === 1 ? 3600 : 9000 + (source.id - 2) * 500;
  stage.enemyAttack = source.id === 1 ? 1.1 : 5 + (source.id - 2) * 0.04;
  stage.baseReward = 480 + (source.id - 1) * 45;
  delete stage.missionReward;
  for (const [index, wave] of stage.waves.entries()) for (const group of wave.enemies) {
    // Long-range late-region enemies need fewer bodies than the opening metal swarm.
    if (source.id >= 2) group.count = Math.ceil((group.count ?? 1) * (source.id === 10 ? 1.25 : source.id >= 7 ? .6 : 2.5));
    if (group.id === "grove-bear") { group.id = "workshop-bear"; group.count = 1; }
    if (group.id === "grove-boar") { group.id = "workshop-boar"; group.count = 1; }
    if (source.id === 10 && !getEnemy(group.id).boss) group.count = Math.ceil(group.count * 0.5);
    delete group.attribute;
    delete group.effects;
    if (group.id === "beetle" && index % 2 === 0) group.id = "clock-beetle";
    if (group.id === "mushroom") {
      if (source.id >= 4) group.id = source.id >= 6 && index % 2 === 0 ? "shadow-mushroom" : "spirit-rabbit";
    }
  }
  if (source.id === 2) {
    stage.enemyHp = 9800;
    stage.enemyAttack = 6.5;
    stage.description = "기계 무리가 더 거세게 몰려와요. 보석으로 골드 수급을 늘리고 동료를 키워 보세요.";
  }
  if (source.id === 1) {
    stage.description = "공방 입구에서 쉬어 가요. 적은 무리를 막으며 도토리를 모아 보세요.";
    stage.waves = [
      { time: 1, enemies: [{ id: "beetle", count: 2, interval: 2, x: 1080 }] },
      { time: 28, enemies: [{ id: "clock-beetle", count: 2, interval: 3, x: 1080 }] },
      { time: 56, enemies: [{ id: "boar", count: 1, x: 1080 }] },
      { time: 85, enemies: [{ id: "clock-beetle", count: 2, interval: 3, x: 1080 }] },
    ];
  }
  STAGES.push(stage);
}

// Preserve opening threats and castle-push windows. Bring late reinforcements
// into the shorter defense window without dropping groups or milestone bosses.
for (const stage of STAGES) {
  const lastSpawn = Math.max(...stage.waves.flatMap((wave) =>
    wave.enemies.map((group) => wave.time + ((group.count ?? 1) - 1) * (group.interval ?? 0)),
  ));
  const lateScale = lastSpawn > 89 ? (89 - 85) / (lastSpawn - 85) : 1;
  const compress = (time) => time <= 85 ? time : 85 + (time - 85) * lateScale;
  for (const wave of stage.waves) {
    const originalTime = wave.time;
    wave.time = compress(originalTime);
    for (const group of wave.enemies) {
      if (group.interval !== undefined && (group.count ?? 1) > 1) {
        const span = ((group.count ?? 1) - 1) * group.interval;
        group.interval = (compress(originalTime + span) - wave.time) / (group.count - 1);
      }
    }
  }
}

// Region-one sessions stay short; other regions and speedrun retain their limit.
export function battleDuration(stageId, mode = "idle") {
  if (mode === "speedrun" || Number(stageId) > 10) return 90;
  return Number(stageId) <= (mode === "idle" ? 3 : 2) ? 40 : 60;
}
// A short opening, a recognizable threat and one reinforcement leave room
// to push the castle instead of flooding the lane at the old deadline.
const firstRegionHp = [1, 1, .3, .7, .3, 1, .85, .85, .7, .3];
for (const stage of STAGES.filter(stage => stage.region === 1)) {
  stage.enemyHp = Math.round(stage.enemyHp * (stage.id === 10 ? .85 : .6));
  stage.enemyModifiers = { ...(stage.enemyModifiers ?? {}), hp: firstRegionHp[stage.id - 1] };
  stage.waves = stage.waves.slice(0, 3);
  stage.waves.forEach((wave, index) => {
    wave.time = (stage.id <= 3 ? [.6, 8, 20] : [.6, 12, 26])[index];
    for (const group of wave.enemies) {
      group.count = Math.max(1, Math.ceil((group.count ?? 1) * .6));
      if (group.interval !== undefined) group.interval = Math.max(.7, group.interval);
    }
  });
}
// The defense lesson uses costly raiders: saving the rabbit's summon budget
// for shields and ranged allies keeps the same threat survivable.
STAGES[1].waves = [
  { time: 1, enemies: [{ id: "beetle", count: 2, interval: 1.2, x: 1080 }] },
  { time: 9, enemies: [{ id: "boar", count: 4, interval: 1.5, x: 500,
    statMultipliers: { hp: 1.7, attack: 1.3, speed: .58, attackInterval: 1.15 } }] },
];

for (const wave of STAGES[1].waves) for (const group of wave.enemies) {
  group.effects = { shield: false, regeneration: false };
}

export const RECRUIT_BANNERS = [
  { id: "forest", name: "숲속 친구들", attribute: "wild", unlock: 0,
    units: ["sheep", "rabbit", "squirrel", "fox", "chick", "deer"],
    featured: ["fox", "deer", "chick"], rates: { common: .6, rare: .28, epic: .12 } },
  { id: "workshop", name: "공방 친구들", attribute: "machine", unlock: 10,
    units: ["teapot", "hedgehog", "owl", "turtle"], featured: ["hedgehog", "turtle", "owl"] },
  { id: "starlight", name: "별빛 친구들", attribute: "spirit", unlock: 10,
    units: ["cloud", "otter", "mushroom-witch", "penguin", "whale"], featured: ["otter", "whale", "mushroom-witch"] },
];
export const bannerById = (id) => RECRUIT_BANNERS.find((banner) => banner.id === id);
export const bannerPool = (id) => {
  const banner = bannerById(id);
  return banner ? UNITS.filter((unit) => banner.units.includes(unit.id)) : [];
};
export const bannerRarities = (id) => {
  const banner = bannerById(id);
  return banner ? RARITIES.map((rarity) => ({ ...rarity, rate: banner.rates ? (banner.rates[rarity.id] ?? 0) : rarity.rate })).filter((rarity) => rarity.rate > 0) : [];
};
