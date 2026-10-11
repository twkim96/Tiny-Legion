export const SPEEDRUN_LIMIT_SECONDS = 90;
export const SPEEDRUN_TARGET_SECONDS = 60;
export const SPEEDRUN_MAX_REWARD = 10;

// Independent encounters: normal challenge maps and their multipliers are not
// inputs to this content. Character identities/stats still come from characters.js.
const group = (id, count = 1, interval = 1.2) => ({ id, count, interval, x: 1080 });
const wave = (time, ...enemies) => ({ time, enemies });
const stage = (id, name, scene, enemyHp, hp, attack, waves) => ({
  id, name, regionName: name, scene, enemyHp, enemyAttack: attack,
  enemyModifiers: { hp }, baseReward: 0, waves,
});

export const SPEEDRUN_SCENES = {
  creek: { sky: "#597e92", horizon: "#aec7c8", far: "#bfd5c7", near: "#9fbea9", field: "#96b6a0", road: "#d7cfb0", water: "#76aebe" },
  quarry: { sky: "#767991", horizon: "#bfc1cf", far: "#c4c6ce", near: "#b0b4bd", field: "#a5b1a7", road: "#cec7b8" },
  moon: { sky: "#555d83", horizon: "#a8adc8", far: "#b4bdd1", near: "#929fb9", field: "#8daba6", road: "#c3c7bd" },
  sunset: { sky: "#996e7f", horizon: "#d1b49b", far: "#d6c1b1", near: "#b6b3a1", field: "#9caf93", road: "#dfc6a7" },
};

export const SPEEDRUN_STAGES = [
  stage(1, "여울길", "creek", 1800, 1, .8, [
    wave(.6, group("badger", 2, 2)), wave(10, group("mushroom", 2)),
    wave(22, group("beetle", 3)), wave(36, group("boar")),
    wave(55, group("badger", 4)), wave(74, group("mushroom", 3)),
  ]),
  stage(2, "갈대 언덕", "creek", 2100, 1.1, .85, [
    wave(.6, group("mushroom", 3, 2)), wave(9, group("beetle", 2)),
    wave(24, group("porcupine")), wave(40, group("badger", 3)),
    wave(60, group("mushroom", 3), group("boar")), wave(78, group("beetle", 3)),
  ]),
  stage(3, "징검다리", "creek", 2300, 1.2, .9, [
    wave(.6, group("boar")), wave(8, group("badger", 3, .8)),
    wave(26, group("boar", 2, 3)), wave(42, group("mushroom", 2)),
    wave(58, group("badger", 5, .7)), wave(77, group("boar", 2)),
  ]),
  stage(4, "덩굴 둑", "creek", 2600, 1.3, .95, [
    wave(.6, group("bear")), wave(12, group("porcupine", 2, 2)),
    wave(30, group("beetle", 3)), wave(46, group("bear"), group("mushroom", 2)),
    wave(68, group("badger", 4)), wave(82, group("porcupine")),
  ]),
  stage(5, "여울의 파수꾼", "creek", 3000, 1.4, 1, [
    wave(.6, group("beetle", 2)), wave(12, group("grove-bear")),
    wave(26, group("badger", 3)), wave(44, group("porcupine", 2)),
    wave(64, group("boar", 2)), wave(82, group("mushroom", 3)),
  ]),
  stage(6, "자갈길", "quarry", 3200, 1.5, 1, [
    wave(.6, group("clock-beetle", 3, 2)), wave(15, group("badger", 2)),
    wave(31, group("clock-beetle", 3)), wave(48, group("mushroom", 3)),
    wave(67, group("boar", 2)), wave(82, group("clock-beetle", 3)),
  ]),
  stage(7, "철조각 고개", "quarry", 3600, 1.7, 1.05, [
    wave(.6, group("badger", 4, .7)), wave(10, group("clock-beetle", 2)),
    wave(26, group("badger", 4, .7)), wave(43, group("clock-beetle", 4)),
    wave(63, group("porcupine", 2)), wave(81, group("badger", 4)),
  ]),
  stage(8, "바위 회랑", "quarry", 4000, 1.9, 1.1, [
    wave(.6, group("bear"), group("clock-beetle", 2)),
    wave(18, group("porcupine", 2)), wave(34, group("boar", 2)),
    wave(52, group("clock-beetle", 4)), wave(74, group("bear", 2, 3)),
  ]),
  stage(9, "톱니 다리", "quarry", 4400, 2, 1.15, [
    wave(.6, group("clock-beetle", 4, 1)), wave(13, group("mushroom", 3)),
    wave(29, group("badger", 4)), wave(45, group("clock-beetle", 4), group("porcupine")),
    wave(68, group("boar", 3)), wave(82, group("mushroom", 3)),
  ]),
  stage(10, "채석장 문지기", "quarry", 5000, 2.1, 1.2, [
    wave(.6, group("clock-beetle", 2)), wave(9, group("workshop-bear")),
    wave(25, group("porcupine", 2)), wave(44, group("badger", 4)),
    wave(65, group("clock-beetle", 4)), wave(82, group("bear")),
  ]),
  stage(11, "달빛 오솔길", "moon", 5300, 2.2, 1.2, [
    wave(.6, group("spirit-rabbit", 3, 2)), wave(11, group("beetle", 3)),
    wave(27, group("shadow-mushroom", 3)), wave(45, group("bear")),
    wave(64, group("spirit-rabbit", 4)), wave(81, group("badger", 3)),
  ]),
  stage(12, "빛샘 연못", "moon", 5800, 2.4, 1.25, [
    wave(.6, group("spirit-rabbit", 4, 1)), wave(13, group("boar", 2)),
    wave(31, group("spirit-rabbit", 4)), wave(49, group("porcupine", 2)),
    wave(69, group("spirit-rabbit", 4), group("bear")),
  ]),
  stage(13, "그림자 갈림길", "moon", 6200, 2.6, 1.3, [
    wave(.6, group("shadow-mushroom", 4)), wave(10, group("badger", 3)),
    wave(28, group("shadow-mushroom", 4)), wave(46, group("boar", 3)),
    wave(65, group("shadow-mushroom", 4)), wave(82, group("porcupine", 2)),
  ]),
  stage(14, "반딧불 둔덕", "moon", 6700, 2.8, 1.35, [
    wave(.6, group("spirit-rabbit", 2), group("shadow-mushroom", 2)),
    wave(16, group("bear", 2, 3)), wave(34, group("spirit-rabbit", 3)),
    wave(51, group("shadow-mushroom", 4)), wave(73, group("badger", 5)),
  ]),
  stage(15, "달빛의 큰 엄니", "moon", 7300, 3, 1.4, [
    wave(.6, group("spirit-rabbit", 2)), wave(10, group("grove-boar")),
    wave(26, group("shadow-mushroom", 3)), wave(45, group("porcupine", 2)),
    wave(64, group("spirit-rabbit", 3)), wave(82, group("boar", 2)),
  ]),
  stage(16, "노을 고갯길", "sunset", 7800, 3.2, 1.45, [
    wave(.6, group("badger", 5, .6)), wave(12, group("clock-beetle", 3)),
    wave(29, group("spirit-rabbit", 3)), wave(47, group("boar", 3)),
    wave(67, group("shadow-mushroom", 4)), wave(82, group("badger", 4)),
  ]),
  stage(17, "붉은 바람길", "sunset", 8400, 3.4, 1.5, [
    wave(.6, group("porcupine", 3)), wave(11, group("bear", 2)),
    wave(28, group("shadow-mushroom", 4)), wave(46, group("clock-beetle", 4)),
    wave(67, group("porcupine", 3)), wave(82, group("badger", 4)),
  ]),
  stage(18, "오래된 수문", "sunset", 9000, 3.6, 1.55, [
    wave(.6, group("clock-beetle", 5, 1)), wave(15, group("spirit-rabbit", 3)),
    wave(32, group("bear", 2)), wave(50, group("clock-beetle", 5)),
    wave(70, group("shadow-mushroom", 4)), wave(83, group("boar", 2)),
  ]),
  stage(19, "황혼의 능선", "sunset", 9700, 3.8, 1.6, [
    wave(.6, group("bear", 2), group("shadow-mushroom", 2)),
    wave(17, group("badger", 5)), wave(34, group("porcupine", 3)),
    wave(52, group("spirit-rabbit", 4), group("clock-beetle", 3)),
    wave(75, group("boar", 3)),
  ]),
  stage(20, "노을의 거인", "sunset", 10500, 4, 1.65, [
    wave(.6, group("clock-beetle", 2)), wave(9, group("workshop-boar")),
    wave(25, group("spirit-rabbit", 3)), wave(43, group("porcupine", 3)),
    wave(62, group("shadow-mushroom", 4)), wave(80, group("bear", 2)),
  ]),
];
export const SPEEDRUN_STAGE_COUNT = SPEEDRUN_STAGES.length;

export function speedrunStageReward(time) {
  if (!Number.isFinite(time) || time <= 0 || time > SPEEDRUN_LIMIT_SECONDS) return 0;
  if (time <= SPEEDRUN_TARGET_SECONDS) return SPEEDRUN_MAX_REWARD;
  return Math.max(1, Math.min(SPEEDRUN_MAX_REWARD - 1,
    Math.ceil((SPEEDRUN_LIMIT_SECONDS - time) / 30 * (SPEEDRUN_MAX_REWARD - 1))));
}
