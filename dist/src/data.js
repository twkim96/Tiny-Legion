// Initial tuning, subject to play acceptance. Bonuses of the same kind add.
export const BALANCE_VERSION = "early-growth-3";
export const ATTRIBUTES = [
  { id: "wild", name: "야생", symbol: "♧", color: "#72b54b", ink: "#3f852e", colorName: "초록색" },
  { id: "machine", name: "기계", symbol: "⚙", color: "#a8b5c5", ink: "#667487", colorName: "은색" },
  { id: "spirit", name: "정령", symbol: "◇", color: "#69c8ed", ink: "#287f9e", colorName: "하늘색" },
  { id: "shadow", name: "그림자", symbol: "☾", color: "#9a69cf", ink: "#7845ab", colorName: "보라색" },
];
export const NEUTRAL_ATTRIBUTE = { id: "normal", name: "무속성", color: "#f2f1e8", colorName: "흰색" };
export const stageLabel = (id) => id === 0 ? "0" : `${Math.floor((id - 1) / 10) + 1}-${(id - 1) % 10 + 1}`;
export const ROLE_SPECIALIZATION = {
  warrior: { attack: 0.2, effectiveHp: 0.2 },
  tank: { effectiveHp: 0.4 },
  fast: { attack: 0.4 },
  melee: { attack: 0.4 },
  ranged: { attack: 0.4 },
  splash: { attack: 0.4 },
  support: { duration: 0.3 },
};
export const ATTRIBUTE_BONUS_CAP = 0.4;
export const SHIELD_BONUS_CAP = 1;

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

export const UNITS = [
  {
    id: "sheep",
    rarity: "common",
    theme: "숲",
    name: "양 방패",
    role: "tank",
    specialties: ["wild"],
    hp: 360,
    attack: 24,
    range: 42,
    speed: 34,
    cost: 255,
    cooldown: 3.4,
    attackInterval: 1.25,
    attackWindup: 0.24,
    attackRecovery: 0.22,
    description: "튼튼한 앞줄 수호자예요.",
    color: "#eee5cb",
  },
  {
    id: "rabbit",
    rarity: "common",
    theme: "숲",
    name: "속공 토끼",
    role: "fast",
    specialties: ["wild"],
    hp: 155,
    attack: 38,
    castleDamageBonus: 4, // +400% when this unit hits the enemy castle.
    range: 48,
    speed: 115,
    cost: 270,
    cooldown: 2.6,
    attackInterval: 0.82,
    attackWindup: 0.16,
    attackRecovery: 0.2,
    description: "빠르게 달려들고 적 성에 큰 피해를 줘요.",
    color: "#dca68b",
  },
  {
    id: "squirrel",
    rarity: "common",
    theme: "숲",
    name: "씨앗 다람쥐",
    role: "ranged",
    specialties: ["wild"],
    hp: 145,
    attack: 34,
    range: 250,
    speed: 44,
    cost: 520,
    cooldown: 4,
    attackInterval: 1.1,
    attackWindup: 0.22,
    attackRecovery: 0.2,
    projectile: { kind: "seed", speed: 680 },
    description: "안전한 거리에서 씨앗을 날려요.",
    color: "#c88755",
  },
  {
    id: "teapot",
    rarity: "common",
    theme: "공방",
    name: "주전자",
    role: "splash",
    specialties: ["machine"],
    hp: 215,
    attack: 46,
    range: 165,
    speed: 35,
    cost: 775,
    cooldown: 5,
    attackInterval: 1.6,
    attackWindup: 0.34,
    attackRecovery: 0.28,
    projectile: { kind: "water", speed: 480 },
    splashRadius: 105,
    description: "가까이 모인 적에게 뜨거운 물을 퍼부어요.",
    color: "#df8669",
  },
  {
    id: "cloud",
    rarity: "common",
    theme: "별빛",
    name: "구름",
    role: "support",
    specialties: ["spirit"],
    slow: { factor: 0.75, duration: 2 },
    suppressRegen: { factor: 0.5, duration: 3 },
    shieldAura: { bonus: 1, range: 230 },
    hp: 235,
    attack: 23,
    range: 300,
    speed: 24,
    cost: 560,
    cooldown: 4.8,
    attackInterval: 1.5,
    attackWindup: 0.3,
    attackRecovery: 0.24,
    projectile: { kind: "bolt", speed: 1000 },
    heal: 28,
    healRange: 230,
    description:
      "가까운 동료를 회복하고 방어막 공격을 도와요. 번개는 적을 늦추고 재생을 억제해요.",
    color: "#c4cf9e",
  },
  {
    id: "fox",
    rarity: "rare",
    theme: "숲",
    name: "등불 여우",
    role: "warrior",
    specialties: ["wild"],
    hp: 265,
    attack: 39,
    range: 52,
    speed: 64,
    cost: 430,
    cooldown: 3.6,
    attackInterval: 1.18,
    attackWindup: 0.22,
    attackRecovery: 0.22,
    description: "작은 등불을 들고 숲길의 앞줄을 지켜요.",
    color: "#c9774e",
  },
  {
    id: "hedgehog",
    rarity: "rare",
    theme: "공방",
    name: "가시 고슴도치",
    role: "tank",
    specialties: ["machine"],
    hp: 455,
    attack: 19,
    range: 40,
    speed: 27,
    cost: 415,
    cooldown: 4.8,
    attackInterval: 1.42,
    attackWindup: 0.3,
    attackRecovery: 0.26,
    description: "톱니 방패와 뾰족한 가시로 동료 앞을 막아요.",
    color: "#aa8260",
  },
  {
    id: "chick",
    rarity: "rare",
    theme: "숲",
    name: "폭탄 병아리",
    role: "splash",
    specialties: ["wild"],
    hp: 175,
    attack: 29,
    range: 155,
    speed: 40,
    cost: 510,
    cooldown: 4.5,
    attackInterval: 1.5,
    attackWindup: 0.28,
    attackRecovery: 0.24,
    projectile: { kind: "seed", speed: 580 },
    splashRadius: 78,
    description: "작은 폭탄을 통통 던져 모인 적을 함께 맞혀요.",
    color: "#e8c858",
  },
  {
    id: "otter",
    rarity: "rare",
    theme: "별빛",
    name: "물방울 수달",
    role: "support",
    specialties: ["spirit"],
    hp: 250,
    attack: 23,
    range: 245,
    speed: 34,
    cost: 600,
    cooldown: 4.8,
    attackInterval: 1.55,
    attackWindup: 0.3,
    attackRecovery: 0.24,
    projectile: { kind: "bolt", speed: 900 },
    heal: 24,
    healRange: 190,
    description: "반짝이는 물방울을 나누어 가까운 동료를 보살펴요.",
    color: "#78aebe",
  },
  {
    id: "owl",
    rarity: "epic",
    theme: "공방",
    name: "태엽 부엉이",
    role: "ranged",
    specialties: ["machine"],
    hp: 170,
    attack: 43,
    range: 315,
    speed: 29,
    cost: 690,
    cooldown: 5.2,
    attackInterval: 1.2,
    attackWindup: 0.24,
    attackRecovery: 0.2,
    projectile: { kind: "seed", speed: 760 },
    description: "태엽 망원경으로 먼 곳의 적을 정확히 겨눠요.",
    color: "#a98b6a",
  },
  {
    id: "mushroom-witch",
    rarity: "epic",
    theme: "별빛",
    name: "버섯 마녀",
    role: "splash",
    specialties: ["spirit"],
    hp: 215,
    attack: 36,
    range: 180,
    speed: 30,
    cost: 730,
    cooldown: 5.3,
    attackInterval: 1.68,
    attackWindup: 0.34,
    attackRecovery: 0.28,
    projectile: { kind: "water", speed: 460 },
    splashRadius: 92,
    description: "별가루 물약을 터뜨려 한곳에 모인 적을 공격해요.",
    color: "#9874a9",
  },
  {
    id: "deer",
    rarity: "epic",
    theme: "숲",
    name: "숲 사슴 기사",
    role: "warrior",
    specialties: ["wild"],
    hp: 315,
    attack: 37,
    range: 54,
    speed: 55,
    cost: 700,
    cooldown: 3.8,
    attackInterval: 1.28,
    attackWindup: 0.26,
    attackRecovery: 0.23,
    description: "잎사귀 방패와 나무 창으로 숲을 수호해요.",
    color: "#ac9169",
  },
  {
    id: "penguin",
    rarity: "epic",
    theme: "겨울",
    name: "눈꽃 펭귄",
    role: "fast",
    specialties: ["spirit"],
    hp: 185,
    attack: 31,
    range: 48,
    speed: 124,
    cost: 670,
    cooldown: 3.1,
    attackInterval: 0.74,
    attackWindup: 0.14,
    attackRecovery: 0.18,
    description: "눈꽃 망토를 휘날리며 얼음 위를 쏜살같이 달려요.",
    color: "#719bb1",
  },
  {
    id: "whale",
    rarity: "legendary",
    theme: "별빛",
    name: "별바다 고래",
    role: "ranged",
    specialties: ["spirit", "shadow"],
    hp: 350,
    attack: 40,
    range: 335,
    speed: 22,
    cost: 920,
    cooldown: 6.6,
    attackInterval: 1.46,
    attackWindup: 0.34,
    attackRecovery: 0.28,
    projectile: { kind: "bolt", speed: 720 },
    slow: { factor: 0.9, duration: 0.8 },
    description: "별빛 물결을 보내 먼 적의 걸음을 잠시 늦춰요.",
    color: "#7194b5",
  },
  {
    id: "turtle",
    rarity: "legendary",
    theme: "공방",
    name: "시계 거북",
    role: "tank",
    specialties: ["machine", "wild"],
    hp: 620,
    attack: 21,
    range: 44,
    speed: 20,
    cost: 970,
    cooldown: 7,
    attackInterval: 1.62,
    attackWindup: 0.36,
    attackRecovery: 0.3,
    shieldAura: { bonus: 0.25, range: 140 },
    description: "태엽 등껍질의 힘으로 가까운 동료의 방어막 공격을 도와요.",
    color: "#7e9b78",
  },
];

export const ENEMIES = [
  {
    id: "beetle",
    attribute: "wild",
    name: "들판 너구리",
    description:
      "햇볕 아래 오래 지내 털이 짙어진 너구리예요. 바랜 풀잎 옷을 걸치고 앞줄로 다가와요.",
    role: "melee",
    hp: 190,
    attack: 24,
    range: 42,
    speed: 36,
    attackInterval: 1.35,
    attackWindup: 0.22,
    attackRecovery: 0.2,
    color: "#b78b5e",
  },
  {
    id: "mushroom",
    attribute: "spirit",
    regeneration: { hpRatio: 0.025, interval: 2 },
    name: "햇살 토끼",
    description:
      "햇볕에 그을린 들판의 토끼예요. 빛의 물결을 보내고 정령의 힘으로 상처를 회복해요.",
    role: "ranged",
    hp: 155,
    attack: 20,
    range: 190,
    speed: 27,
    attackInterval: 1.55,
    attackWindup: 0.32,
    attackRecovery: 0.24,
    projectile: { kind: "spore", speed: 430 },
    color: "#bb915f",
  },
  {
    id: "boar",
    attribute: "wild",
    name: "덤불 멧돼지",
    description:
      "야외 생활로 짙은 갈색이 된 멧돼지예요. 두꺼운 털과 엄니를 앞세워 전선을 밀어요.",
    role: "heavy",
    hp: 420,
    attack: 52,
    range: 48,
    speed: 43,
    attackInterval: 1.65,
    attackWindup: 0.38,
    attackRecovery: 0.3,
    color: "#a27649",
  },
  {
    id: "bear",
    attribute: "wild",
    name: "덩굴 곰",
    description: "햇볕에 그을린 큰 곰이에요. 덩굴 망토를 두르고 묵직한 앞발로 앞줄을 밀어요. 방패로 버티며 뒤에서 공격해 보세요.",
    role: "heavy",
    hp: 720, attack: 68, range: 52, speed: 25,
    attackInterval: 1.9, attackWindup: 0.48, attackRecovery: 0.36,
    color: "#94633e",
  },
  {
    id: "badger",
    attribute: "wild",
    name: "바람 오소리",
    description: "짙은 줄무늬와 풀잎 허리띠를 두른 오소리예요. 빠르게 다가오니 앞줄이 비지 않게 지켜 주세요.",
    role: "melee",
    hp: 280, attack: 34, range: 42, speed: 78,
    attackInterval: 0.95, attackWindup: 0.18, attackRecovery: 0.16,
    color: "#9b754f",
  },
  {
    id: "porcupine",
    attribute: "wild",
    name: "가시 호저",
    description: "그을린 털과 긴 가시를 가진 호저예요. 풀잎 주머니의 씨앗을 멀리 날려요. 방패 뒤에 원거리 동료를 모아 보세요.",
    role: "ranged",
    hp: 330, attack: 42, range: 285, speed: 24,
    attackInterval: 1.8, attackWindup: 0.34, attackRecovery: 0.26,
    projectile: { kind: "seed", speed: 610 },
    color: "#986849",
  },
  {
    id: "clock-beetle",
    artId: "beetle",
    name: "고철 두더지",
    description:
      "그을린 털 위에 낡은 판금과 고글을 두른 두더지예요. 얇은 방어막은 모든 공격으로 깎을 수 있어요.",
    attribute: "machine",
    role: "melee",
    shield: { hpRatio: 0.4 },
    hp: 230,
    attack: 26,
    range: 42,
    speed: 30,
    attackInterval: 1.5,
    attackWindup: 0.28,
    attackRecovery: 0.24,
    color: "#a9794e",
  },
  {
    id: "shadow-mushroom",
    artId: "mushroom",
    name: "그늘 여우",
    description:
      "햇볕에 그을린 여우가 바랜 그림자 망토를 걸쳤어요. 어둠을 빠르게 날리며 조금씩 재생해요.",
    attribute: "shadow",
    role: "ranged",
    regeneration: { hpRatio: 0.02, interval: 2 },
    hp: 125,
    attack: 17,
    range: 215,
    speed: 32,
    attackInterval: 1.2,
    attackWindup: 0.24,
    attackRecovery: 0.2,
    projectile: { kind: "spore", speed: 480 },
    color: "#a3714d",
  },
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

// Region one teaches a single weakness; region two gradually mixes counters.
const firstRegion = [...STAGES];
for (const stage of firstRegion) {
  stage.region = 1;
  stage.regionName = "초원";
  for (const wave of stage.waves) for (const group of wave.enemies) {
    group.attribute = "wild";
    group.shield = false;
    group.regeneration = false;
  }
}
for (const source of firstRegion) {
  const stage = JSON.parse(JSON.stringify(source));
  stage.id = source.id + 10;
  stage.region = 2;
  stage.regionName = "오래된 공방";
  stage.name = ["공방 입구", "녹슨 길", "작은 작업장", "빛의 샘", "톱니 언덕", "그늘 통로", "은빛 마당", "뒤섞인 숲", "깊은 공방", "공방의 문"][source.id - 1];
  stage.description = source.id < 4 ? "야생과 은색 기계 무리가 함께 나타나요." : "여러 색의 적을 보고 알맞은 동료를 골라 보세요.";
  stage.enemyHp = Math.round(source.enemyHp * 1.55);
  stage.enemyAttack = source.enemyAttack * 1.15;
  stage.baseReward = source.baseReward + 120;
  delete stage.missionReward;
  for (const [index, wave] of stage.waves.entries()) for (const group of wave.enemies) {
    delete group.attribute;
    delete group.shield;
    delete group.regeneration;
    if (group.id === "beetle" && index % 2 === 0) group.id = "clock-beetle";
    if (group.id === "mushroom") {
      if (source.id < 4) { group.attribute = "wild"; group.regeneration = false; }
      else if (source.id >= 6 && index % 2 === 0) group.id = "shadow-mushroom";
    }
  }
  STAGES.push(stage);
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
