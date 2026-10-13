# 개발과 검증

## 실행 환경

Node.js 22 이상과 Python 3을 사용합니다. 서버 배포 준비에는 `npm ci`, `npm run db:generate`(스키마 변경 시), `npm run build`를 사용합니다. 정적 로컬 개발은 설치 없이 가능합니다. 저장소 루트에서 실행합니다.

```sh
npm run dev
```

`http://127.0.0.1:4173`에서 확인합니다. `package.json`의 개발 명령은 Python 정적 서버로 `dist/`를 제공합니다. 종료는 실행 터미널에서 Ctrl+C입니다.

서버 게스트 흐름은 `npm ci` 후 `npm run dev:server`로 `http://localhost:4174`에서 확인합니다. SQLite 개발 DB는 무시 경로 `.sites-local/game.sqlite`에 보관합니다. 서버 빌드를 갱신하려면 재실행합니다. 로컬 개발 서버는 외부에서 전달한 Sites 인증 헤더를 제거하므로 실제 계정 연결은 Sites 배포에서 확인합니다. 이 대역을 공개 서버로 사용하지 않습니다.

로컬 테스트 로그인은 개발 서버 프로세스에 `TEST_LOGIN_ENABLED=true`와 `TEST_LOGIN_ACCOUNTS`를 전달하면 활성화됩니다. 목록의 아이디별 값은 `{salt, hash, iterations: 100000, role: admin/player}`이며 salt는 16바이트 hex, hash는 PBKDF2-SHA256 32바이트 hex입니다. `server/test-access.js`의 `passwordHash`로 해시를 계산할 수 있습니다. 비밀 설정은 셸 인자·추적 파일에 넣지 않습니다. 설정 없는 로컬 서버는 테스트 로그인을 제공하지 않습니다.

## 소스 구조

| 위치 | 역할 |
|---|---|
| `dist/index.html`, `dist/style.css` | 화면과 반응형 스타일 |
| `dist/src/characters.js` | 아군·적 원본 정의·속성·고유 효과·강화 배정 |
| `dist/src/character-stats.js` | 공통 능력치 스냅샷·배율 |
| `dist/src/effects.js`, `dist/src/combat-effects.js` | 효과 용어·수치 검증·강화/설명·공통 적용/만료·주기 처리 |
| `dist/src/data.js` | 스테이지·웨이브·모집/성장 데이터; 캐릭터 정의 재수출 |
| `dist/src/speedrun.js` | 속공 전용 스테이지·웨이브·배경·목표 시간·보상 |
| `dist/src/engine.js` | 화면과 독립된 결정적 전투 계산 |
| `dist/src/economy.js` | 제한 시간에 비례하는 회차 방치 보상·다섯 동료 기준 일반 레벨 비용 |
| `dist/src/battlefield.js` | 엔진·화면이 공유하는 전장·기지 문·생성 좌표 |
| `dist/src/onboarding.js` | 신규 0스테이지·1-1·1-2 성 공략과 방치 편성 전투 구성 |
| `dist/src/account.js` | 성장·재화·진행·기록·저장 |
| `dist/src/save-compat.js` | 이전 테스트 저장의 임시 변환; 아래 제거 지침 참조 |
| `dist/src/character-art.js`, `dist/src/art.js`, `dist/src/renderer.js` | 계열별 캐릭터 SVG·아이콘과 Canvas 렌더링 |
| `dist/src/sequence-ui.js` | 순서 끼워넣기·마우스/터치 포인터 입력 |
| `dist/src/modal-ui.js` | 종류별 모달 크기 선택과 공통 안내·확인 본문 |
| `dist/src/gems.js`, `dist/src/gem-ui.js` | 보석 개체·보유 기본 효과·추가옵션 3개 장착·강화·재설정·페이지 |
| `dist/src/abilities.js`, `dist/src/companion-ui.js` | 동료 특수능력·상세 성장 |
| `dist/src/recruitment-ui.js` | 동료 모집·확률·카드 공개 연출 |
| `dist/src/cloud-session-ui.js`, `dist/src/idle-result-ui.js` | 온라인 연결/인증 안내·일시 정지와 생산 기록 비교 표시 |
| `dist/src/main.js` | UI·입력·전투/계정 연결 |
| `dist/src/audio.js`, `dist/assets/music/` | 채널별 소리 설정·입력 후 재생·스테이지 곡과 CC0 라이선스 |
| `tests/` | Node 기본 테스트 러너로 검증하는 동작 |

캐릭터를 추가·변경할 때는 [캐릭터 관리 계약](../SPEC/characters.md)을 따릅니다. 도감이나 엔진에 별도 속성/스탯 정의를 넣지 않습니다.

`dist/`는 실제 게임 소스입니다. 서버 빌드는 게임 소스를 읽어 `dist/server/`·`dist/.openai/`만 생성하며 이 두 경로는 Git에서 제외합니다. `server/`는 API·명령·전투 재생, `db/schema.ts`·`drizzle/`는 서버 스키마, `dist/src/account-client.js`는 서버 요청을 담당합니다. 정적 개발의 로컬 저장을 서버로 업로드하지 않습니다.

## 로컬 Git 관리

- 기존 Git 이력을 이어서 사용하며 기본 브랜치는 `main`입니다. `origin`은 GitHub `twkim96/Tiny-Legion`이며 Sites source helper는 별도의 사이트 원격과 동기화합니다. Git 원격·브랜치 상태는 작업 시 확인합니다. Git 커밋과 Sites 배포는 별도 작업입니다.
- `dist/`, 테스트, 프로젝트 문서, `.openai/hosting.json`은 추적합니다. 의존성·로컬 Sites 상태·배포 아카이브·로그·환경 변수 파일·내보낸 진행도 파일은 `.gitignore`에서 제외합니다.
- 작업 전 `git status --short`와 `git log -5 --oneline`으로 진행 중 변경과 기준 커밋을 확인합니다. 마친 뒤 관련 파일만 지정해 스테이징하고 `git diff --cached`를 확인한 다음 기능 단위로 커밋합니다.

```sh
git status --short
git diff
git add -- 수정한/파일
git diff --cached
git commit -m "변경 내용"
```

- 여러 세션이 동시에 개발할 때는 브랜치와 worktree를 각각 사용합니다. 브랜치만 나누고 같은 폴더를 사용하면 작업 파일이 공유되므로 별도 체크아웃에서 편집합니다. 통합 후에는 영향을 받은 검증을 실행합니다.
- 속성 변경 전 기준점은 로컬 태그 `baseline-before-attributes-1`입니다. `git show baseline-before-attributes-1:dist/src/data.js`로 이전 데이터를 비교할 수 있습니다. 커밋된 변경을 되돌릴 때는 `git revert <커밋>`으로 복구 이력을 남깁니다.

## 테스트 저장 호환 코드

- 테스트 중 기능·밸런스 변경에는 데이터 이주나 소급 보상 코드를 기본으로 추가하지 않습니다. 폐기해도 되는 이전 테스트 값은 현재 사양에 맞게 정규화합니다.
- 이미 유지하던 초기 보유/편성, 조각→징표, 미션 완료 추론, 1-2 안내 생략/토끼 복구, 단일 보석→개체 변환은 `dist/src/save-compat.js`에 모았습니다. 현재 호출은 `account.js`의 `legacyStarterSave`·`restoreLegacyProgress`, `gems.js`의 `restoreLegacyGems`입니다. 현재 형식의 저장은 이 변환 조건에 해당하지 않습니다. 짧은 회차 보상이 과도했던 `idle-economy-15`의 90초 미만 방치 기록만 버리는 블록도 이 모듈에 한정합니다. 해당 테스트 저장 지원 종료 시 이 블록을 제거합니다.
- 이전 저장 지원을 종료할 때 위 세 호출/수입과 모듈, 해당 호환 테스트·사양만 함께 제거합니다. 이 모듈은 다른 게임 로직에서 호출하지 않습니다. 이전 필드로도 현재 작동하는 특별강화·보석 효과·편성 미러는 런타임 기능이므로 사용처를 확인한 뒤 별도로 정리합니다.
- 저장값 검증, 미보유 동료 차단, 프리셋 독립성, 일반 레벨 초기화의 실지출 기록과 환급 상한 계산은 현재 기능입니다. `cumulativeLevelCost`는 이 상한 계산에도 사용하며 이주 코드를 없앤다는 이유로 삭제하지 않습니다.

## 기존 자동 검증

```sh
npm test
npm run check
```

`test`는 전투와 계정 동작을 검증합니다. `check`는 `dist/src/`, `server/`, `scripts/`, `tests/`의 모든 JS·MJS·CJS 파일을 검사하며 생성물인 `dist/server/`는 대상에 넣지 않습니다. 서버 API 회귀는 실제 SQLite 트랜잭션 대역과 결정적 전투 재생을 포함합니다. Cloudflare D1·Sites 로그인·실제 UI/기기 수용 검증은 포함하지 않습니다. `.github/workflows/check.yml`은 push·pull request 때 Node 22에서 의존성 설치 → 전체 문법 검사 → 테스트 → Worker 빌드를 실행합니다. 로컬 통과와 실제 GitHub CI 실행 결과는 구분합니다.

전투 계산·밸런스 규칙 변경 시 `dist/src/data.js`의 `BALANCE_VERSION`도 갱신합니다. 이전 버전 전투 완료를 거절하는 계약은 [서버 사양](../SPEC/server-account.md#검증과-저장)을 따릅니다.

문서 변경만으로 전체 제품 테스트나 새 문서 검사 도구를 추가하지 않습니다. 관련 링크·완료된 diff를 확인하고, 동작 변경에는 해당 기존 테스트부터 실행합니다.

## 수동 확인

[화면 사양](../SPEC/interface.md)의 가로 화면 크기와 PC에서 전투·메뉴·모달·키보드·긴 누르기를 확인합니다. 저장·복구를 확인할 때는 먼저 파일을 내보내 진행도를 보존합니다. Android WebView와 iOS WKWebView의 실제 기기 확인 및 플레이 밸런스의 완료 조건은 [TODO](../TODO.md)에 있습니다.
