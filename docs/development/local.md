# 개발과 검증

## 실행 환경

Node.js 22 이상과 Python 3을 사용합니다. 런타임 의존성 설치와 빌드 단계는 없습니다. 저장소 루트에서 실행합니다.

```sh
npm run dev
```

`http://127.0.0.1:4173`에서 확인합니다. `package.json`의 개발 명령은 Python 정적 서버로 `dist/`를 제공합니다. 종료는 실행 터미널에서 Ctrl+C입니다.

## 소스 구조

| 위치 | 역할 |
|---|---|
| `dist/index.html`, `dist/style.css` | 화면과 반응형 스타일 |
| `dist/src/data.js` | 동료·적·스테이지·웨이브 데이터 |
| `dist/src/engine.js` | 화면과 독립된 결정적 전투 계산 |
| `dist/src/onboarding.js` | 신규 0스테이지·첫 1-1·재도전 전투 구성 |
| `dist/src/account.js` | 성장·재화·진행·기록·저장 |
| `dist/src/character-art.js`, `dist/src/art.js`, `dist/src/renderer.js` | 계열별 캐릭터 SVG·아이콘과 Canvas 렌더링 |
| `dist/src/recruitment-ui.js` | 동료 모집·확률·카드 공개 연출 |
| `dist/src/main.js` | UI·입력·전투/계정 연결 |
| `tests/` | Node 기본 테스트 러너로 검증하는 동작 |

`dist/`는 생성 폴더가 아닌 실제 소스입니다. 다른 소스에서 재생성하는 빌드 작업은 없습니다.

## 로컬 Git 관리

- 기존 Git 이력을 이어서 사용하며 기본 브랜치는 `main`입니다. 현재 원격 저장소는 연결하지 않고 로컬 변경·커밋으로 관리합니다. Git 커밋과 Sites 배포는 별도 작업입니다.
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

## 기존 자동 검증

```sh
npm test
npm run check
```

`test`는 전투와 계정 동작을 검증합니다. `check`는 `main.js`, `renderer.js`, `account.js`의 문법 검사입니다. 전체 UI·실기기·서버 수용 검증은 포함하지 않습니다. 저장소에는 CI 워크플로가 없으므로 CI 통과 상태를 주장하지 않습니다.

문서 변경만으로 전체 제품 테스트나 새 문서 검사 도구를 추가하지 않습니다. 관련 링크·완료된 diff를 확인하고, 동작 변경에는 해당 기존 테스트부터 실행합니다.

## 수동 확인

[화면 사양](../SPEC/interface.md)의 가로 화면 크기와 PC에서 전투·메뉴·모달·키보드·긴 누르기를 확인합니다. 저장·복구를 확인할 때는 먼저 파일을 내보내 진행도를 보존합니다. Android WebView와 iOS WKWebView의 실제 기기 확인 및 플레이 밸런스의 완료 조건은 [TODO](../TODO.md)에 있습니다.
