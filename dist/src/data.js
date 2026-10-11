export const UNITS = [
  {
    id: "sheep",
    name: "양 방패",
    role: "tank",
    hp: 360,
    attack: 24,
    range: 42,
    speed: 34,
    cost: 85,
    cooldown: 3.4,
    attackInterval: 1.25,
    attackWindup: 0.24,
    attackRecovery: 0.22,
    description: "튼튼한 앞줄 수호자예요.",
    color: "#eee5cb",
  },
  {
    id: "rabbit",
    name: "목검 토끼",
    role: "fast",
    hp: 155,
    attack: 38,
    range: 48,
    speed: 115,
    cost: 90,
    cooldown: 2.6,
    attackInterval: 0.82,
    attackWindup: 0.16,
    attackRecovery: 0.2,
    description: "빠르게 달려들어 연속으로 공격해요.",
    color: "#dca68b",
  },
  {
    id: "squirrel",
    name: "씨앗 다람쥐",
    role: "ranged",
    hp: 145,
    attack: 34,
    range: 250,
    speed: 44,
    cost: 130,
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
    name: "주전자",
    role: "splash",
    hp: 215,
    attack: 46,
    range: 165,
    speed: 35,
    cost: 155,
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
    name: "구름",
    role: "support",
    hp: 235,
    attack: 23,
    range: 300,
    speed: 24,
    cost: 140,
    cooldown: 4.8,
    attackInterval: 1.5,
    attackWindup: 0.3,
    attackRecovery: 0.24,
    projectile: { kind: "bolt", speed: 1000 },
    heal: 28,
    healRange: 230,
    description: "멀리서 공격하며 가까운 동료를 보살펴요.",
    color: "#c4cf9e",
  },
];

export const ENEMIES = [
  {
    id: "beetle",
    name: "딱정벌레",
    role: "melee",
    hp: 190,
    attack: 24,
    range: 42,
    speed: 36,
    attackInterval: 1.35,
    attackWindup: 0.22,
    attackRecovery: 0.2,
    color: "#718c5a",
  },
  {
    id: "mushroom",
    name: "버섯 몽이",
    role: "ranged",
    hp: 155,
    attack: 20,
    range: 190,
    speed: 27,
    attackInterval: 1.55,
    attackWindup: 0.32,
    attackRecovery: 0.24,
    projectile: { kind: "spore", speed: 430 },
    color: "#d07b73",
  },
  {
    id: "boar",
    name: "멧돼지",
    role: "heavy",
    hp: 420,
    attack: 52,
    range: 48,
    speed: 43,
    attackInterval: 1.65,
    attackWindup: 0.38,
    attackRecovery: 0.3,
    color: "#906f62",
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
        enemies: [{ id: "beetle", count: 2, interval: 1.3, x: 360 }],
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
      { time: 1, enemies: [{ id: "beetle", count: 3, interval: 1.2, x: 400 }] },
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
      { time: 1, enemies: [{ id: "beetle", count: 3, interval: 1, x: 410 }] },
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
    description: "달빛 아래 여러 방향에서 적이 밀려와요.",
    baseReward: 170,
    enemyHp: 2700,
    enemyAttack: 1.15,
    waves: [
      { time: 1, enemies: [{ id: "beetle", count: 4, interval: 1, x: 420 }] },
      {
        time: 17,
        enemies: [
          { id: "mushroom", count: 4, interval: 1.2, x: 920 },
          { id: "boar", count: 1, x: 1010 },
        ],
      },
      {
        time: 39,
        enemies: [
          { id: "boar", count: 3, interval: 1.6, x: 970 },
          { id: "beetle", count: 3, interval: 1, x: 1030 },
        ],
      },
      {
        time: 65,
        enemies: [{ id: "mushroom", count: 6, interval: 1.1, x: 940 }],
      },
      {
        time: 88,
        enemies: [
          { id: "boar", count: 3, interval: 1.5, x: 990 },
          { id: "mushroom", count: 4, interval: 1.2, x: 1040 },
        ],
      },
      {
        time: 108,
        enemies: [{ id: "beetle", count: 7, interval: 0.85, x: 1000 }],
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
      { time: 1, enemies: [{ id: "beetle", count: 4, interval: 0.9, x: 420 }] },
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
        enemies: [{ id: "beetle", count: 5, interval: 0.85, x: 430 }],
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
      { time: 1, enemies: [{ id: "beetle", count: 5, interval: 0.8, x: 430 }] },
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
        enemies: [{ id: "beetle", count: 6, interval: 0.75, x: 440 }],
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
      { time: 1, enemies: [{ id: "beetle", count: 6, interval: 0.7, x: 440 }] },
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
        enemies: [{ id: "beetle", count: 7, interval: 0.65, x: 450 }],
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
