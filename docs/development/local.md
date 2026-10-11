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
| `dist/src/account.js` | 성장·재화·진행·기록·저장 |
| `dist/src/art.js`, `dist/src/renderer.js` | SVG 리소스와 Canvas 렌더링 |
| `dist/src/main.js` | UI·입력·전투/계정 연결 |
| `tests/` | Node 기본 테스트 러너로 검증하는 동작 |

`dist/`는 생성 폴더가 아닌 실제 소스입니다. 다른 소스에서 재생성하는 빌드 작업은 없습니다.

## 기존 자동 검증

```sh
npm test
npm run check
```

`test`는 전투와 계정 동작을 검증합니다. `check`는 `main.js`, `renderer.js`, `account.js`의 문법 검사입니다. 전체 UI·실기기·서버 수용 검증은 포함하지 않습니다. 저장소에는 CI 워크플로가 없으므로 CI 통과 상태를 주장하지 않습니다.

문서 변경만으로 전체 제품 테스트나 새 문서 검사 도구를 추가하지 않습니다. 관련 링크·완료된 diff를 확인하고, 동작 변경에는 해당 기존 테스트부터 실행합니다.

## 수동 확인

[화면 사양](../SPEC/interface.md)의 가로 화면 크기와 PC에서 전투·메뉴·모달·키보드·긴 누르기를 확인합니다. 저장·복구를 확인할 때는 먼저 파일을 내보내 진행도를 보존합니다. Android WebView와 iOS WKWebView의 실제 기기 확인 및 플레이 밸런스의 완료 조건은 [TODO](../TODO.md)에 있습니다.
