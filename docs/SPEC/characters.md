# 캐릭터 데이터와 능력치

## 원본 정보

- `dist/src/characters.js`가 아군 `UNITS`와 적 `ENEMIES`의 유일한 원본입니다. 이름·역할·공격 유형·종족·자신의 속성/특화·기본 스탯·소환 비용/주기·기본 기믹·투사체·외형 ID와 공통/선택/고유 강화 배정을 모읍니다. 배열과 중첩 정의는 변경할 수 없도록 고정합니다. 모집 등급/배너·스테이지/웨이브는 `data.js`, SVG 원화는 `character-art.js`에서 관리합니다.
- `getUnit(id)`, `getEnemy(id)`, `getCharacter(id, team)`으로 정의를 조회합니다. `team`은 `player`/`enemy`이며 생략하면 두 목록을 조회합니다. 없는 ID는 `null`입니다. `data.js`의 정의 재수출은 동일 객체이며 별도 복사본을 만들지 않습니다.
- 햇살 토끼(`mushroom`)는 기본 야생·재생 없음입니다. 정령·2초마다 최대 체력 2.5% 재생은 별도 빛샘 토끼(`spirit-rabbit`)가 소유합니다. 후반 기존 재생 전투는 이 ID를 배치하고 도감에도 별도 표시합니다. 토끼 실루엣을 공유하되 빛샘 토끼는 수정 귀 장식과 정령 색으로 구별합니다.
- 정상 스테이지와 첫 안내는 이름/속성/재생을 임시 덮어쓰기보다 해당 정의의 ID를 배치합니다. 다른 속성이 실제로 필요한 적은 별도 정의를 추가합니다. 기존 웨이브 기믹 끄기와 명시적인 `attribute`/`effects` 옵션은 전투 구성용으로 지원하며, 스테이지 정보도 같은 옵션 계산을 사용합니다.

## 공격 유형

- 종족 ID와 속성 정의는 `dist/src/character-tags.js`에 모으고 `characters.js`가 속성 정의를 재수출합니다. 아군·적은 원본에 `family`와 자신의 `attribute`를 명시합니다. 숲/공방/별빛/겨울은 종족이고 야생/기계/정령/그림자/무속성은 전투 속성입니다. `specialties`는 강하게 대응하는 적 속성으로, 자신의 속성·종족을 대신하지 않습니다.
- 모든 아군·적은 원본에 `attackType: melee`(근거리) 또는 `ranged`(원거리)를 명시합니다. 역할·사거리·투사체 유무로 재분류하지 않으며 범위 공격도 해당 유닛의 공격 유형을 따릅니다. 유형 ID와 표시명은 `dist/src/attack-types.js`가 관리하고 동료 상세·적 도감에 표시합니다.
- 생성 시 `modifiers.attackTypes.melee/ranged`와 `multipliers.attackTypes.melee/ranged`에 스탯별 배율을 전달합니다. 전체 배율과 해당 유형 배율을 곱하며 양 팀·스테이지·웨이브에서 같은 계산을 사용합니다. 예: `{ attackTypes: { melee: { attack: 1.1 }, ranged: { hp: 1.05 } } }`.
- 시간제 `stat` 효과도 선택적 `attackType`을 받습니다. 일치하는 개체에만 적용하고 생략하면 모두에게 적용합니다. 같은 출처의 같은 스탯·방향·대상 유형 효과는 교체하며, 전체/근거리/원거리 강화는 서로 다른 효과 종류입니다. 발사된 공격은 발사 시점의 유형을 보존합니다. 대포는 원거리입니다.

## 생성 시 능력치

`dist/src/character-stats.js`의 결과는 원본과 분리된 스냅샷입니다.

| 함수 | 사용 |
|---|---|
| `characterStats(id 또는 정의, options)` | 팀·레벨·강화·장착 효과·배율·웨이브 기믹 계산 |
| `unitCombatStats(unit, level, modifiers, ranks)` | 아군 상세·전투력·소환의 공통 계산 |
| `enemyCombatStats(id, multipliers, overrides, modifiers)` | 적 원본·웨이브 특성·스테이지 배율 계산 |
| `combineStatMultipliers(...sources)` | 스테이지·전투·웨이브의 스탯별 배율 합성 |
| `combineAttackTypeMultipliers(...sources)` | 근거리·원거리별 스탯 배율 합성 |

- `options`는 `team`, `level`, `abilities`, `modifiers`, `multipliers`, `overrides`를 받습니다. 체력/공격력의 일반 레벨 증가와 특수능력을 적용한 뒤 팀/보석 `modifiers`와 배율 `multipliers`를 곱합니다. 배율 스탯은 `hp`, `attack`, `speed`, `range`, `attackInterval`이며 1 미만 디버프도 지원합니다. 체력/공격력은 마지막에 반올림하고 최소 1, 공격 간격은 최소 0.2초입니다. 특화 보석은 `modifiers.attributeBonuses`에 전달합니다. 회복 고정량·고유 기믹은 기존 계약을 유지합니다.
- 엔진은 기존 `stage.enemyAttack`, 선택적인 `stage.enemyModifiers`, `createBattle({enemyModifiers})`, 웨이브 그룹 `statMultipliers`를 곱해 적을 생성합니다. `enemyCombatStats`도 전달받은 `overrides.statMultipliers`를 같은 방식으로 합성합니다. 성 체력 `stage.enemyHp`와 적 유닛 체력 배율 `hp`는 별개입니다. 명시하지 않은 배율은 1이며 기존 스테이지 난이도는 유지합니다.
- 엔진과 동료 상세는 같은 아군 계산을 사용합니다. 생성 후 장착/강화 변경은 진행 중 전투에 소급하지 않습니다. 적군 도감은 원본 기본 수치를 표시하며 전투 배율이나 대응 아군 목록은 표시하지 않습니다.

## 피해 특성

- `effects.js`의 `COMBAT_TRAITS`와 공통 `effect()`가 특성 기본값·검증·설명을 관리합니다. 캐릭터에는 `effects`로 명시하며 역할을 바꿔도 특성은 바뀌지 않습니다. 아군·적군 모두 같은 판정을 사용합니다.

| ID | 특성 | 기본 효과 |
|---|---|---|
| `sturdy` | 단단함 | 최종 유효 체력 +50% |
| `strong` | 강함 | 최종 유효 체력 +30% · 최종 추가 피해 20% |
| `devastating` | 매서움 | 최종 추가 피해 50% |

- `attribute`, `family`, `attackType`은 공통 대상 조건입니다. 유효 체력 효과는 공격 출처, 공격 효과는 피해 대상에 맞춰 판정합니다. 생략/`all`은 미래에 추가되는 속성까지 포함합니다. 예: `effect('sturdy', { attribute: 'wild' })`, `effect('devastating', { family: 'forest', attackType: 'ranged', bonus: .5 })`.
- 공격력·버프/디버프·보석 속성 계산 이후 최종 피해에 `1 + bonus`를 곱하고 `1 + effectiveHp`로 나눈 뒤 방어막/체력으로 나눕니다. 예: 강함 공격 100이 단단함에 맞으면 `100 × 1.2 ÷ 1.5 = 80`입니다. 체력·회복량을 늘리지 않습니다. 유효 체력 증가와 추가 피해 값은 0 이상의 유한 수치입니다. 유효 체력 +200%는 받는 피해를 3으로 나눕니다. 서로 다른 특성이 동시에 같은 대상을 커버하면 유효 체력/추가 피해 각각 가장 큰 값 하나를 사용합니다.
- 기존 역할별 공격·유효 체력·방해 지속시간 보너스와 그 별도 계산 값은 제거했습니다. `specialties`는 배너·징표·표시용 대응 목록이며 피해를 직접 만들지 않습니다. 기존 보석 속성 옵션은 독립 효과로 유지합니다.
- 속성 숙련은 피해 특성이 배정된 동료의 각 수치에 단계마다 +1%p, 최대 10단계를 적용합니다. 특화 추가는 해당 특성의 대상 속성 목록도 함께 확장합니다. 계속 배정된 강화 단계·계정·기록은 보존하며 저장 이주는 추가하지 않습니다. 양 방패·씨앗 다람쥐의 미배정 속성 숙련·추가 특화는 기존 단계 정규화에서 제외하며 보상 이주는 추가하지 않습니다.
- 양 방패와 씨앗 다람쥐는 범용 기준 동료입니다. 속성 대응 피해 특성과 `specialties`를 비우고 기본 체력 540/공격력 24, 기본 체력 145/공격력 51을 사용합니다. 속성 숙련·추가 특화는 제공하지 않으며 체력·공격력·고유 능력 강화는 유지합니다.
- 전투 발사 스냅샷은 특성 수치와 대상 조건도 복사합니다. 발사 이후 캐릭터 사망·강화·정의 변경이 날아가는 투사체에 소급되지 않습니다. `applyEffect`로 적/아군에 같은 특성을 설치할 수 있으며 소유자가 대상 조건에 맞을 필요는 없습니다.

## 전투 효과

`characters.js`의 `effects`는 효과 종류를 키로 갖는 원본 정의입니다. 현재 용어·수치 계약·설명은 `effects.js`, 양 팀의 실제 적용·갱신·만료는 `combat-effects.js`가 담당합니다. 종별 수치는 원본 정의에만 두고 엔진·도감·상세·강화 설명에 복제하지 않습니다.

| ID | 용어 | 수치 |
|---|---|---|
| `healing` | 회복 | `amount` 고정량 또는 `hpRatio` 최대 체력 비율, `range` |
| `regeneration` | 재생 | 회복량과 `interval` 주기 |
| `slow` | 둔화 | `factor` 남는 이동속도 배율, `duration` |
| `healingSuppression` | 회복 억제 | `factor` 남는 회복량 배율, `duration`, `scope` |
| `shield` | 방어막 | `amount` 또는 `hpRatio` 흡수량 |
| `poison` | 중독 | `ratio` 발사 공격력 비율, `interval`, `duration` |
| `immunity` | 면역 | `effect` 차단할 효과 ID |
| `shieldDamageAura` | 방어막 공격 지원 | `bonus` 추가 피해, `range` |
| `areaAttack` | 범위 공격 | `radius` 타격 지점 기준 범위 |
| `castleDamage` / `shieldDamage` | 성 / 방어막 추가 피해 | `bonus` 추가 피해 |
| `stat` | 능력치 변화 | `stat`, `multiplier`, `flat`, `duration`, 선택적 `attackType` |
| `attackImmunity` | 공격 무효 | `attackType` 차단할 공격 유형 |
| `repelPulse` | 밀쳐내기 | `interval`, `range`, `distance`, `warning` 예고 시간, `attackType` 대상 유형 |
| `hitStun` / `knockback` | 경직 / 밀쳐내기 | `duration` / `distance` |

### 공통 키워드

- `EFFECT_KEYWORDS`가 버프·디버프·특수기믹의 표시명을 관리하고 `EFFECTS[type].keyword`로 연결합니다. `knockback` 타격과 `repelPulse` 주기 효과는 모두 **밀쳐내기**입니다. 실행 종류·타격/주기·출처·갱신 규칙은 각각 유지합니다. 속성(야생·기계 등)과 효과 키워드는 별개입니다.
- `effectInfo(spec)`는 실행 `type`, 공통 `keyword`, 표시 `label`, 수치 설명 `details`, 검증된 독립 수치 사본 `values`를 반환합니다. `effectKeywords(character)`로 원본/생성 스냅샷의 기본 효과를 조회하고 `hasEffectKeyword(character, keyword)`는 기본 효과와 아직 만료되지 않은 버프/디버프를 함께 조회합니다. 수치를 바꿀 때는 `effect(type, values)`를 공통으로 사용합니다.
- 공격 무효는 **공격 무효(원거리)**, 면역은 **면역(중독)**처럼 대상을 표시합니다. 능력치 버프/디버프는 **공격력 증가(근거리)** 등으로 표시합니다. 범위·주기·지속시간·강도는 개별 효과 값으로 생성합니다. 곰의 밀쳐내기는 대상 근거리·범위 165·주기 2.8초·거리 120입니다.
- `dist/src/effects-ui.js`의 `effectMarkup(character, { detail })`이 효과 표시를 공통으로 관리합니다. `summary`는 소환 툴팁·동료 상세에 키워드 태그만, `full`(기본값)은 도감에 키워드 태그와 수치 설명을 표시합니다. 태그는 `ui-components.js`의 `uiTag`를 사용하며 등급·속성 특화·역할과 표시 양식을 공유합니다. 상세 표시에서 캐릭터의 특화 목록과 정확히 같은 속성 대상은 중복 생략하고 다른 대상 조건은 유지합니다. 강화·적 구성 설명은 동일 descriptor의 `effectText`/`effectLines`를 사용합니다. 키워드 정리로 전투 수치·저장·출처별 중첩은 변경하지 않습니다.

### 효과 대상 조건

- 모든 효과는 독립적인 `attackType`, `family`, `attribute` 조건을 받습니다. 각 조건은 `'all'`(기본값), 단일 ID, 또는 ID 배열입니다. 같은 조건의 배열은 OR, 서로 다른 조건은 AND입니다. `effect-targets.js`의 `normalizeEffectTargets`가 검증·정렬·중복 제거하고 `matchesEffectTarget`이 공통 판정합니다.
- `'all'`은 현재 목록을 복사하지 않습니다. 새 종족·속성·공격 유형이 추가되어도 포함하며, 특정 ID만 골랐을 때는 그 조건만 일치합니다. 신규 정의는 공통 태그/공격 유형 목록에 한 번 추가합니다.
- 공격 무효·면역의 조건은 들어오는 공격/효과의 **출처 유닛**을 검사합니다. 곰은 원거리·모든 종족·모든 속성 공격 무효입니다. `{ attackType: 'ranged', family: 'forest', attribute: 'all' }`이면 숲 종족의 원거리만 차단합니다. 다른 종족이나 근거리는 차단하지 않습니다. 타격/투사체는 발사 시점의 종족·속성·공격 유형을 보존합니다. 대포는 원거리·무속성이며 유닛 종족에 속하지 않습니다.
- 둔화·중독·회복 억제·능력치 변화·회복·재생·방어막·경직·밀쳐내기 조건은 **효과를 받는 유닛**을 검사합니다. 조건 밖 대상에는 적용/재적용하지 않으며 기존 효과를 지우거나 갱신하지 않습니다. 공격 무효·주기 밀쳐내기 등 기본 기믹을 캐릭터에 설치할 때는 소유자가 효과 대상 조건에 일치할 필요가 없습니다.
- 종족·속성 조건은 출처를 새로 만들지 않습니다. 대상이 일치한 경우 같은 출처·종류의 새 버프/디버프는 조건과 수치·시간을 함께 교체하며, 재화로 얻은 서로 다른 강화 출처는 기존대로 공존합니다.
- 지원 회복은 조건에 맞는 부상자만 선택하고, 지원 오라는 조건에 맞는 동료에게만 제공합니다. 범위 공격은 기본 타격 외의 추가 피해 대상, 방어막 추가 피해는 피해 대상 조건을 검사합니다. 특수능력·보석·전투 지원의 기존 출처와 교체 규칙은 유지합니다.
- 공통 descriptor/도감/상세/강화 설명에 종족·속성 조건을 표시합니다. 공격 무효는 전체 대상인 경우에도 `모든 종족 · 모든 속성`을 명시합니다. 조건·수치 변경은 같은 `effect(type, values)` 호출에서 처리하며 저장 데이터 이주는 추가하지 않습니다.

### 호출과 확장

```js
import { effect, effectOrigin } from './effects.js';
import { applyEffect, healUnit } from './combat-effects.js';

applyEffect(target, effect('slow', { attribute: 'wild', factor: .7, duration: 2 }));
// 숲 종족에만 공격력 증가: 아군/적군 모두 같은 API 사용
applyEffect(ally, effect('stat', {
  family: 'forest', attribute: 'all', stat: 'attack', multiplier: 1.1, duration: 10,
}));
// 숲 종족 원거리의 공격만 차단하는 기믹 설치
applyEffect(bear, effect('attackImmunity', { attackType: 'ranged', family: 'forest', attribute: 'all' }));
applyEffect(target, effect('healingSuppression', {
  factor: .5, duration: 3, scope: 'all',
}));
healUnit(ally, effect('healing', { amount: 30, range: 200 }));
applyEffect(ally, effect('stat', {
  stat: 'attack', multiplier: 1.1, duration: 10,
}), { origin: effectOrigin('ability', 'deer:periodic-attack') });
applyEffect(ally, effect('stat', {
  stat: 'attack', multiplier: 1.03, duration: 10,
}), { origin: effectOrigin('gem', 'gem-42', 'option-0') });
```

- `effect(type, values)`는 종류·수치를 검증합니다. 주기 효과는 최소 전투 한 단계(1/30초)로 제한합니다. `effectText`/`effectLines`가 공통 설명을 생성합니다. 새 효과는 카탈로그의 수치/설명/적용 시점과 실제 처리 함수를 함께 추가하고 캐릭터에는 수치만 배정합니다.
- `characterStats`는 `effects`를 검증하고 분리된 스냅샷을 만듭니다. 웨이브 `effects`는 종류별 병합, `false`는 해당 효과만 끄기, 생략은 원본 상속입니다. 엔진과 스테이지 설명은 같은 계산을 사용합니다.
- `initializeEffects`가 소환별 `effects`·`statusEffects`·`periodicTimers`와 초기 방어막을 만듭니다. 체력·흡수량·행동·남은 시간은 개체가 소유하며 원본/다른 개체를 변경하지 않습니다.
- 시간제 버프/디버프는 `origin` + 효과 종류로 보관합니다. 같은 출처·같은 종류는 새 강도·지속시간·범위·피해 출처로 완전히 교체합니다. 2초·30% 둔화 중 1초·20% 둔화를 받으면 그 시점부터 1초·20%만 남습니다. 출처가 다르면 독립적으로 만료하며 둔화·회복 억제 배율은 곱합니다. 팀·발사자 ID·임의의 효과 `id`는 출처를 나누지 않습니다.
- 재화를 쓰는 강화 수단은 서로 다른 출처입니다. `effectOrigin('gem', 보석개체ID, 옵션줄ID)`, `effectOrigin('ability', 동료ID와능력ID)`, `effectOrigin('upgrade', 강화수단ID)`로 구분합니다. 같은 보석의 중복 옵션 줄도 서로 구분합니다. 계정의 영구 레벨·강화·보석 효과는 기존 스냅샷 계산에서 각각 합성합니다.
- 전투 중 캐릭터가 거는 버프/디버프는 공통 `BATTLE_ORIGIN`(`battle`)을 사용합니다. 서포터 1·2 또는 아군·적군으로 갈라 같은 효과를 쌓지 않습니다. `applyEffect`의 출처 우선순위는 `context.origin` → `spec.origin` → 발사 스냅샷의 `source.origin` → `battle`입니다. 명시하는 출처는 비어 있지 않은 문자열이어야 합니다.
- 회복 억제의 `scope`도 새 값으로 교체합니다. 같은 출처의 재생 전용 억제 뒤 전체 회복 억제를 받으면 재생 전용 상태가 별도로 남지 않습니다. 다른 출처의 상태는 각각 해당 범위에만 적용합니다. 구름은 `scope: 'regeneration'`, `scope: 'all'` 또는 생략은 회복과 재생에 적용합니다.
- `stat`은 변경하는 스탯과 증가/감소를 효과 종류에 포함합니다. 같은 출처의 공격력 증가는 서로 교체하고 공격력 감소·이동속도 증가와는 공존합니다. 고정값과 배율이 반대 방향인 혼합 변화는 별도 종류입니다. `combatStat`는 고정 증가 후 배율을 곱하고 둔화를 적용합니다. `advanceEffects`는 전투 시간으로 만료시키며 원래 스탯을 덮어쓰지 않습니다. 시간제 최대 체력 변경은 지원하지 않습니다. `applyStatEffect`는 같은 API의 편의 호출입니다.
- `applyEffect`로 재생·면역·범위 공격·성/방어막 추가 피해·주변 지원·공격 무효·밀쳐내기를 설치할 수도 있습니다. 재생 설치 시 주기 타이머를 시작하며 캐릭터별 처리 분기는 추가하지 않습니다.
- `attackImmunity`는 해당 유형의 체력/방어막 피해와 타격 디버프를 모두 막습니다. 대포도 무효 대상이면 피해와 밀어내기가 없습니다. 범위 공격은 각 피해 대상의 무효 여부를 따로 계산합니다.
- `tickRepulsion`은 일반 공격과 독립된 소환별 주기로 지정 유형의 적대 개체를 밀쳐냅니다. 사망·아군·범위 밖·밀어내기 면역 대상은 제외합니다. 실제로 이동한 대상의 공격 준비를 취소하며 추가 피해는 없습니다. 렌더러는 설정한 `warning` 시간만큼 발동 전 범위를 예고하고 발동 파동과 원거리 차단 효과를 표시합니다.
- `healUnit`은 즉시 회복, 엔진의 `queueHealing`은 동시 타격·회복 합산용입니다. `tickPeriodicEffects`는 재생과 중독의 주기를 진행하고 마지막 중독 틱까지 처리합니다. 사망 개체는 회복/효과 적용에서 제외합니다.
- `applyHitEffects`는 카탈로그의 타격 효과를 호출합니다. 중독은 체력 피해가 있을 때만 적용하고 면역은 지정한 효과만 차단하며 일반 타격 피해는 유지합니다. 중독도 같은 출처의 새 피해량·지속시간·간격·방향·발사 스냅샷으로 교체합니다. 다음 틱까지의 진행은 새 간격 이내에서 보존해 잦은 재적용이 피해 발생을 미루지 않게 합니다. 서로 다른 출처의 중독은 각각 피해와 만료를 처리합니다.
- `attackSource`가 발사 시점의 출처·효과·특화·주변 방어막 공격 지원을 분리해 보관합니다. 주변 지원은 같은 팀·범위 내 소환 순서대로 갱신하며 같은 출처의 마지막 지원 하나만 적용합니다. 약한 지원도 앞선 지원을 교체하며 범위 이탈·사망 시 남아 있는 지원으로 다시 계산합니다. 다른 출처의 지원 보너스는 가산합니다. 발사자 사망·효과 만료·외부 변경은 이미 발사한 탄에 영향을 주지 않습니다.
- `supportTarget`는 같은 팀의 범위 내 부상자 중 체력 비율이 낮은 동료를 고릅니다. `statusMarks`가 렌더러의 재생·둔화·회복 억제·중독 표시를 제공합니다. 경직도 출처별 교체·만료를 사용하고 행동 정지 시간은 남아 있는 경직 중 가장 긴 시간입니다. 대포 피해/즉시 밀어내기는 공통 전투 설정에서 읽습니다. 즉시 회복·밀어내기와 원본의 상시 기믹 설치는 시간제 상태의 중첩 대상이 아닙니다.
- 고유 강화와 반복 강화는 `changes`의 수치/연산(`multiply`, `add`, `effect`, `counter`, `specialty`)에서 적용과 설명을 함께 계산합니다. 단계별 증가는 원본에 한 번 적용하며 복리로 쌓지 않습니다. 기존 능력 ID·저장 단계·생산 기록은 유지하고 저장 데이터 이주나 소급 보상은 추가하지 않습니다.
- 보석은 계정 소유의 기본 효과·추가옵션 장착·재화 수익·강화/재설정 기능을 유지하며 분리된 전투 배율을 전달합니다. 전투 효과의 상태 수명에 계정 수익·저장 기능을 섞지 않습니다.

## 검증

- `tests/combat-traits.test.js`: 최종 피해 배율·양 팀·대상 조건·명시 특성·강화·투사체·설명.
- `tests/effect-targets.test.js`: 대상 조건 AND/OR·전체의 미래 태그 포함·출처/수신자 구별·조건부 면역·회복/지원·발사 스냅샷과 실제 투사체.
- `tests/attack-types.test.js`: 유형 고정·유형별 배율/상태·투사체/대포/범위/타격 효과 차단·밀쳐내기 주기/대상·빠른/느린 근거리의 실제 전투.
- `tests/character-stats.test.js`: 정의 불변·야생/정령 토끼 구별·초반 웨이브 일치·적 배율 합성·아군 상세/소환 일치·양 팀 버프/디버프 갱신/만료와 실제 타격.
- `tests/combat-effects.test.js`: 양 팀 공통 적용·약한/짧은 재적용·강화별 출처 분리·전투 지원 공통 출처·갱신/만료·회복 억제 범위·동시 회복 합산·최종 중독 틱·면역·발사 스냅샷·수치 변경과 설명·웨이브 효과 상속/끄기·지원 대상·경직/밀어내기.
- 기존 전투·초반 안내·지역 난이도·성장·보석·특수능력·외형 검사를 함께 실행합니다. 자동 검사는 실제 플레이 난이도·모바일/WebView 수용 승인과 구분합니다.
