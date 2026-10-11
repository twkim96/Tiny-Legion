# 캐릭터 데이터와 능력치

## 원본 정보

- `dist/src/characters.js`가 아군 `UNITS`와 적 `ENEMIES`의 유일한 원본입니다. 이름·역할·속성/특화·기본 스탯·소환 비용/주기·기본 기믹·투사체·외형 ID와 공통/선택/고유 강화 배정을 모읍니다. 배열과 중첩 정의는 변경할 수 없도록 고정합니다. 모집 등급/배너·스테이지/웨이브는 `data.js`, SVG 원화는 `character-art.js`에서 관리합니다.
- `getUnit(id)`, `getEnemy(id)`, `getCharacter(id, team)`으로 정의를 조회합니다. `team`은 `player`/`enemy`이며 생략하면 두 목록을 조회합니다. 없는 ID는 `null`입니다. `data.js`의 정의 재수출은 동일 객체이며 별도 복사본을 만들지 않습니다.
- 햇살 토끼(`mushroom`)는 기본 야생·재생 없음입니다. 정령·2초마다 최대 체력 2.5% 재생은 별도 빛샘 토끼(`spirit-rabbit`)가 소유합니다. 후반 기존 재생 전투는 이 ID를 배치하고 도감에도 별도 표시합니다. 토끼 실루엣을 공유하되 빛샘 토끼는 수정 귀 장식과 정령 색으로 구별합니다.
- 정상 스테이지와 첫 안내는 이름/속성/재생을 임시 덮어쓰기보다 해당 정의의 ID를 배치합니다. 다른 속성이 실제로 필요한 적은 별도 정의를 추가합니다. 기존 웨이브 기믹 끄기와 명시적인 `attribute`/`shield`/`regeneration` 옵션은 전투 구성용으로 지원하며, 스테이지 정보도 같은 옵션 계산을 사용합니다.

## 생성 시 능력치

`dist/src/character-stats.js`의 결과는 원본과 분리된 스냅샷입니다.

| 함수 | 사용 |
|---|---|
| `characterStats(id 또는 정의, options)` | 팀·레벨·강화·장착 효과·배율·웨이브 기믹 계산 |
| `unitCombatStats(unit, level, modifiers, ranks)` | 아군 상세·전투력·소환의 공통 계산 |
| `enemyCombatStats(id, multipliers, overrides, modifiers)` | 적 원본·웨이브 특성·스테이지 배율 계산 |
| `combineStatMultipliers(...sources)` | 스테이지·전투·웨이브의 스탯별 배율 합성 |

- `options`는 `team`, `level`, `abilities`, `modifiers`, `multipliers`, `overrides`를 받습니다. 체력/공격력의 일반 레벨 증가와 특수능력을 적용한 뒤 팀/보석 `modifiers`와 배율 `multipliers`를 곱합니다. 배율 스탯은 `hp`, `attack`, `speed`, `range`, `attackInterval`이며 1 미만 디버프도 지원합니다. 체력/공격력은 마지막에 반올림하고 최소 1, 공격 간격은 최소 0.2초입니다. 특화 보석은 `modifiers.attributeBonuses`에 전달합니다. 회복 고정량·고유 기믹은 기존 계약을 유지합니다.
- 엔진은 기존 `stage.enemyAttack`, 선택적인 `stage.enemyModifiers`, `createBattle({enemyModifiers})`, 웨이브 그룹 `statMultipliers`를 곱해 적을 생성합니다. `enemyCombatStats`도 전달받은 `overrides.statMultipliers`를 같은 방식으로 합성합니다. 성 체력 `stage.enemyHp`와 적 유닛 체력 배율 `hp`는 별개입니다. 명시하지 않은 배율은 1이며 기존 스테이지 난이도는 유지합니다.
- 엔진과 동료 상세는 같은 아군 계산을 사용합니다. 생성 후 장착/강화 변경은 진행 중 전투에 소급하지 않습니다. 적군 도감은 원본 기본 수치를 표시하며 전투 배율이나 대응 아군 목록은 표시하지 않습니다.

## 전투 중 효과

- 유닛의 체력·방어막·현재 행동·중독/둔화/재생 억제·`statEffects`는 전투 개체가 소유합니다. 원본이나 다른 소환 개체를 변경하지 않습니다.
- `applyStatEffect(unit, {id, stat, multiplier, flat, duration})`는 공격력·이동속도·사거리·공격 간격의 시간제 효과를 등록합니다. 같은 ID는 갱신하고 다른 ID는 함께 적용합니다. 덧셈 후 배율을 곱하며, `combatStat(unit, stat)`로 읽습니다. 엔진의 공격·이동·사거리/주기 판정이 이 값을 사용합니다. `advanceStatEffects`는 전투 시간으로 만료시키며 원래 스탯을 덮어쓰지 않습니다. 시간제 최대 체력 변경은 아직 지원하지 않습니다.
- 기존 둔화는 `combatStat`의 이동속도, 재생 억제는 `regenerationFactor`로 계산합니다. 속성/방어막 피해·중독은 `combat-rules.js`와 엔진의 기존 공통 규칙을 사용합니다. 발사한 탄은 발사 시 피해/기믹을 보관하므로 이후 버프 만료·발사자 사망에 영향받지 않습니다.
- 이 구조 변경은 저장 데이터 이주나 소급 보상을 추가하지 않습니다. 기존 생산 기록은 당시 결과로 보존합니다.

## 검증

- `tests/character-stats.test.js`: 정의 불변·야생/정령 토끼 구별·초반 웨이브 일치·적 배율 합성·아군 상세/소환 일치·양 팀 버프/디버프 갱신/만료와 실제 타격.
- 기존 전투·초반 안내·지역 난이도·성장·보석·특수능력·외형 검사를 함께 실행합니다. 자동 검사는 실제 플레이 난이도·모바일/WebView 수용 승인과 구분합니다.
