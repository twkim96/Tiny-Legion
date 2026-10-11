# 캐릭터 데이터와 능력치

## 원본 정보

- `dist/src/characters.js`가 아군 `UNITS`와 적 `ENEMIES`의 유일한 원본입니다. 이름·역할·속성/특화·기본 스탯·소환 비용/주기·기본 기믹·투사체·외형 ID와 공통/선택/고유 강화 배정을 모읍니다. 배열과 중첩 정의는 변경할 수 없도록 고정합니다. 모집 등급/배너·스테이지/웨이브는 `data.js`, SVG 원화는 `character-art.js`에서 관리합니다.
- `getUnit(id)`, `getEnemy(id)`, `getCharacter(id, team)`으로 정의를 조회합니다. `team`은 `player`/`enemy`이며 생략하면 두 목록을 조회합니다. 없는 ID는 `null`입니다. `data.js`의 정의 재수출은 동일 객체이며 별도 복사본을 만들지 않습니다.
- 햇살 토끼(`mushroom`)는 기본 야생·재생 없음입니다. 정령·2초마다 최대 체력 2.5% 재생은 별도 빛샘 토끼(`spirit-rabbit`)가 소유합니다. 후반 기존 재생 전투는 이 ID를 배치하고 도감에도 별도 표시합니다. 토끼 실루엣을 공유하되 빛샘 토끼는 수정 귀 장식과 정령 색으로 구별합니다.
- 정상 스테이지와 첫 안내는 이름/속성/재생을 임시 덮어쓰기보다 해당 정의의 ID를 배치합니다. 다른 속성이 실제로 필요한 적은 별도 정의를 추가합니다. 기존 웨이브 기믹 끄기와 명시적인 `attribute`/`effects` 옵션은 전투 구성용으로 지원하며, 스테이지 정보도 같은 옵션 계산을 사용합니다.

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
| `stat` | 능력치 변화 | `id`, `stat`, `multiplier`, `flat`, `duration` |
| `hitStun` / `knockback` | 경직 / 밀어내기 | `duration` / `distance` |

### 호출과 확장

```js
import { effect } from './effects.js';
import { applyEffect, healUnit } from './combat-effects.js';

applyEffect(target, effect('slow', { factor: .7, duration: 2 }));
applyEffect(target, effect('healingSuppression', {
  factor: .5, duration: 3, scope: 'all',
}));
healUnit(ally, effect('healing', { amount: 30, range: 200 }));
applyEffect(ally, effect('stat', {
  id: 'battle-boost', stat: 'attack', multiplier: 1.1, duration: 5,
}));
```

- `effect(type, values)`는 종류·수치를 검증합니다. 주기 효과는 최소 전투 한 단계(1/30초)로 제한합니다. `effectText`/`effectLines`가 공통 설명을 생성합니다. 새 효과는 카탈로그의 수치/설명/적용 시점과 실제 처리 함수를 함께 추가하고 캐릭터에는 수치만 배정합니다.
- `characterStats`는 `effects`를 검증하고 분리된 스냅샷을 만듭니다. 웨이브 `effects`는 종류별 병합, `false`는 해당 효과만 끄기, 생략은 원본 상속입니다. 엔진과 스테이지 설명은 같은 계산을 사용합니다.
- `initializeEffects`가 소환별 `effects`·`statusEffects`·`periodicTimers`와 초기 방어막을 만듭니다. 체력·흡수량·행동·남은 시간은 개체가 소유하며 원본/다른 개체를 변경하지 않습니다.
- `applyEffect`는 양 팀 공통입니다. 둔화·회복 억제는 가장 강한 배율과 긴 남은 시간을 갱신하며 곱해서 무한 중첩하지 않습니다. 회복 억제의 적용 범위가 다르면 강도·남은 시간을 별도로 보관해 일반 회복으로 확대하거나 서로 덮어쓰지 않습니다. 구름은 `scope: 'regeneration'`으로 기존 재생만 억제합니다. `scope: 'all'` 또는 생략은 회복과 재생에 적용하며, 회복 배율은 한 번만 적용합니다.
- `stat`은 같은 ID를 갱신하고 서로 다른 ID는 공존합니다. `combatStat`는 고정 증가 후 배율을 곱하고 둔화를 적용합니다. `advanceEffects`는 전투 시간으로 만료시키며 원래 스탯을 덮어쓰지 않습니다. 시간제 최대 체력 변경은 지원하지 않습니다. `applyStatEffect`는 같은 API의 편의 호출입니다.
- `applyEffect`로 재생·면역·범위 공격·성/방어막 추가 피해·주변 지원을 설치할 수도 있습니다. 재생 설치 시 주기 타이머를 시작하며 캐릭터별 처리 분기는 추가하지 않습니다.
- `healUnit`은 즉시 회복, 엔진의 `queueHealing`은 동시 타격·회복 합산용입니다. `tickPeriodicEffects`는 재생과 중독의 주기를 진행하고 마지막 중독 틱까지 처리합니다. 사망 개체는 회복/효과 적용에서 제외합니다.
- `applyHitEffects`는 카탈로그의 타격 효과를 호출합니다. 중독은 체력 피해가 있을 때만 적용하고 면역은 지정한 효과만 차단하며 일반 타격 피해는 유지합니다. 재적용은 강한 피해·긴 지속시간을 유지하며 기존 다음 틱 시간을 보존합니다.
- `attackSource`가 발사 시점의 효과·특화·주변 방어막 공격 지원을 분리해 보관합니다. 주변 지원은 같은 팀·범위 내 가장 강한 하나만 적용합니다. 발사자 사망·효과 만료·외부 변경은 이미 발사한 탄에 영향을 주지 않습니다.
- `supportTarget`는 같은 팀의 범위 내 부상자 중 체력 비율이 낮은 동료를 고릅니다. `statusMarks`가 렌더러의 재생·둔화·회복 억제·중독 표시를 제공합니다. 경직 시간과 대포 피해/밀어내기도 공통 전투 설정에서 읽습니다.
- 고유 강화와 반복 강화는 `changes`의 수치/연산(`multiply`, `add`, `effect`, `counter`, `specialty`)에서 적용과 설명을 함께 계산합니다. 단계별 증가는 원본에 한 번 적용하며 복리로 쌓지 않습니다. 기존 능력 ID·저장 단계·생산 기록은 유지하고 저장 데이터 이주나 소급 보상은 추가하지 않습니다.
- 보석은 계정 소유의 장착·재화 수익·강화/전승 기능을 유지하며 분리된 전투 배율을 전달합니다. 전투 효과의 상태 수명에 계정 수익·저장 기능을 섞지 않습니다.

## 검증

- `tests/character-stats.test.js`: 정의 불변·야생/정령 토끼 구별·초반 웨이브 일치·적 배율 합성·아군 상세/소환 일치·양 팀 버프/디버프 갱신/만료와 실제 타격.
- `tests/combat-effects.test.js`: 양 팀 공통 적용·갱신/만료·회복 억제 범위·동시 회복 합산·최종 중독 틱·면역·발사 스냅샷·수치 변경과 설명·웨이브 효과 상속/끄기·지원 대상·경직/밀어내기.
- 기존 전투·초반 안내·지역 난이도·성장·보석·특수능력·외형 검사를 함께 실행합니다. 자동 검사는 실제 플레이 난이도·모바일/WebView 수용 승인과 구분합니다.
