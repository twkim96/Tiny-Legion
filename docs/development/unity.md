# Unity 이식 개발

## 범위와 구조

`codex/unity-migration` worktree에서 현재 웹 플레이 버전의 구현 전체를 Unity 2D + URP로 이식합니다. 미구현 연구소·진화 등 확장 TODO를 이식 완료 범위에 넣지 않습니다. 기존 전투·성장·보석·모집·도감·편성·안내·계정·설정·음악을 보존합니다. Unity 플레이 및 Sites 배포는 아직 검증 전입니다. Unity Editor와 웹 모듈 설치는 완료했고, 실제 실행은 라이선스 활성화가 없어 시작 전 종료됩니다.

- `unity/Assets/TinyLegion/Domain`: Unity API에 의존하지 않는 데이터·전투·효과·계정·통신 계약. 계산은 `double`, 30Hz 입력, JavaScript와 같은 반올림을 사용합니다. 계정 규칙은 조회·성장·보석·모집·편성·생산·진행·저장 책임별 partial 파일로 나눕니다. 특수능력 정규화/비용과 생산 경제는 전투·계정이 같은 서비스를 사용합니다. Unity Physics2D는 보상 판정에 사용하지 않습니다.
- `unity/Assets/TinyLegion/Presentation`: 공통 화면/입력과 전장 표시. 정의·조건·성장식을 화면에 복제하지 않습니다.
- `unity/Assets/TinyLegion/Runtime`: 저장·Unity 생명주기·웹 통신·음악과 앱 연결.
- `scripts/unity/export-catalog.mjs`: 유지 중인 웹 정의에서 캐릭터·스테이지·강화·효과·경제 데이터를 내보냅니다. JSON은 임의 수정하지 않습니다. 데이터 원본을 독립적으로 두 벌 유지하지 않습니다.
- `scripts/unity/export-art.mjs`: 기존 SVG를 Unity 텍스처로 렌더링하고 CC0 음악을 복사합니다. 원화를 새로 설계하지 않습니다.
- `unity/Tests`: .NET에서 순수 계산·통신을 검사하고 기존 JS 입력 재생과 비교할 경계. Unity 컴파일·실제 화면·기기 검증은 별도입니다.

## 환경

Unity Editor LTS `6000.3.26f1`과 Web Build Support를 사용합니다. 두 기기의 Editor와 패키지 버전을 고정합니다. Unity CLI 설치는 Editor 라이선스 활성화를 대신하지 않습니다. Unity 로그인/라이선스는 사용자가 완료해야 하며 비밀번호·토큰을 저장소에 넣지 않습니다.

이번 Mac에서 별도 설치한 실행 파일은 `/Users/twkim/.local/share/tiny-legion-unity-cli/bin/unity`, 순수 C# 검사용 .NET 8 SDK는 `/Users/twkim/.local/share/tiny-legion-dotnet/dotnet`입니다. 일반 환경에서는 PATH의 `unity`, `dotnet`을 사용합니다.

```sh
npm ci
node scripts/unity/export-catalog.mjs
node scripts/unity/export-art.mjs
node scripts/unity/export-scenery.mjs
node scripts/unity/generate-meta.mjs
mkdir -p .sites-local
node unity/Tests/Combat/generate-parity.mjs .sites-local/combat-parity.json
node unity/Tests/Account/generate-parity.mjs .sites-local/account-parity.json
dotnet run --project unity/Tests/TinyLegion.Domain.Checks.csproj -- unity/Assets/TinyLegion/Resources/Data/catalog.json .sites-local/combat-parity.json .sites-local/account-parity.json
```

`.meta`, `Packages`, `ProjectSettings`와 소스를 Git에 포함합니다. `Library`, `Temp`, 빌드·검사 출력·로컬 계정 저장은 제외합니다. 큰 재사용 원본 자산의 증가 시 LFS 적용 여부를 검토하며 Sites 원격의 LFS 지원을 먼저 확인합니다.

## 데이터와 검증 경계

캐릭터 ID·효과 ID·종족·속성·공격 유형은 기존 정의와 같습니다. 효과 대상은 축 사이 AND·축 안 OR이며 `all`은 열린 조건입니다. 같은 출처·종류는 교체하고 독립 강화 출처는 공존합니다. UI와 엔진은 동일 정의/능력치/설명 서비스를 소비합니다. 상태 표식·공격 출처 스냅샷은 같은 대상 조건을 사용하며, 캐시된 태그 조회와 발사 시점의 독립 사본을 구분합니다. 전장 캐릭터/발사체 표시 객체는 풀에서 재사용합니다.

Sites 온라인 계정은 서버 API가 재화·전투 결과를 결정합니다. C# 결과와 현재 JS 서버 입력 재생이 일치하는지 검증한 뒤 서비스에 연결합니다. 기존 D1 계정은 로컬 저장으로 변환하지 않습니다. 로컬 모드와 온라인 계정의 경계를 유지하며 버전 불일치·응답 유실·인증 만료·세션 교체를 기존 계약대로 처리합니다.

모든 구현과 검증의 미완료 조건은 [TODO](../TODO.md#unity-이식)에 유지합니다. 자동 테스트는 기기/Unity/Sites 수용 검증을 대신하지 않습니다.

## Editor와 웹 빌드

`unity/`를 Unity에서 열고 `Assets/TinyLegion/Scenes/Main.unity`를 실행합니다. URP 2D 기본 자산과 실제 패키지 버전은 설치한 Editor의 2D 템플릿/내장 패키지에서 가져왔습니다. `Tiny Legion/Prepare project`는 프로젝트 설정·스프라이트 임포트·기본 실행 씬을 재현합니다. `Tiny Legion/Build Web`는 `unity/Builds/Web`를 만듭니다.

```sh
unity run unity -- -executeMethod TinyLegion.Editor.ProjectSetup.Prepare
unity run unity -- -executeMethod TinyLegion.Editor.ProjectSetup.BuildWeb
TINY_LEGION_UNITY_WEB=1 npm run build
```

현재 Sites 준비는 기존 Worker에 `/unity/` 파일을 추가하는 명시적 옵션입니다. wasm/data를 바이너리로 제공하고 gzip·MIME·HEAD/Range를 유지합니다. 큰 데이터를 문자열로 내장하는 초기 경로이므로 빌드 크기·메모리·Sites 용량 검증 후 R2 등 별도 저장으로 분리할 필요가 있을 수 있습니다. 64MiB Worker 상한을 넘으면 빌드를 중단합니다. 기존 `/` 화면은 이식 수용 전 유지합니다.

`node scripts/unity/check-unity-source.mjs`와 `--web`는 설치한 Unity의 실제 API 어셈블리에 C# 소스를 정적으로 컴파일합니다. 라이선스가 없는 동안 사용할 수 있지만 패키지 임포트·Editor/IL2CPP 실행을 대신하지 않습니다. 다른 기기는 `TINY_LEGION_UNITY_EDITOR`, `TINY_LEGION_DOTNET`로 실행 경로를 지정합니다.

## 구현과 수용 상태

C# 전투·공통 효과·능력치·계정 규칙, 전장/HUD·안내·모집·성장·보석·도감·편성·기록·일일 수령·설정·로그인/관리자 화면의 소스와 연결을 작성했습니다. 현재 JS 전투/능력치 비교와 계정 명령/정규화/기록 비교, 응답 유실·인증 만료·저장 가져오기 검사는 통과합니다. 기존 서버 테스트·웹 전체 테스트·기본 Worker 빌드와 Unity 파일 대역의 MIME/바이너리 제공도 확인했습니다. 이 증거는 실제 Editor 플레이·모바일 화면·실제 Unity 웹 빌드 또는 Sites 수용을 증명하지 않습니다.

라이선스 활성화 뒤 실제 Editor에서 안내부터 모든 화면·전투를 확인하고 `BuildWeb`를 실행합니다. URP 설정/패키지 임포트/폰트·스프라이트·음악의 실제 임포트와 IL2CPP 컴파일을 먼저 확인합니다. 이어 Sites `/unity/`에서 인증·계정·전투 완료와 파일 로딩을 확인하고, 마지막에 실제 기기 수용 검증을 진행합니다. 이식 완료 여부는 [TODO](../TODO.md#unity-이식)의 남은 조건으로 판단합니다.
