# Unity 이식 개발

## 범위와 구조

`codex/unity-migration` worktree에서 현재 웹 플레이 버전의 구현 전체를 Unity 2D + URP로 이식합니다. 미구현 연구소·진화 등 확장 TODO를 이식 완료 범위에 넣지 않습니다. 기존 전투·성장·보석·모집·도감·편성·안내·계정·설정·음악을 보존합니다. 첫 안내의 렌더링과 버튼 콜백 연결, 첫 전투의 소환·시간 진행, Play Mode의 프레임 진행을 확인했습니다. 실제 IL2CPP Web 빌드와 로컬 브라우저의 서버 게스트 접속·출정/소환 클릭·종료 후 안내 복귀를 확인했습니다. Sites에서도 실제 wasm/data 로딩·서버 게스트 접속·첫 전투 시작/소환·종료 후 안내 복귀를 확인했습니다. 분리된 로컬 검증 계정에서 성장·모집 결과 공개·보석 모집/장착/재설정 취소 및 확정·편성 교체/끼워넣기/적용·적 도감의 효과 설명을 화면과 클릭으로 확인했습니다. 전체 신규 안내 진행과 기기 수용은 아직 검증 전입니다. Unity Editor/Web 모듈 설치와 라이선스 활성화, 실제 Editor의 패키지 임포트·컴파일·`Prepare` 실행을 확인했습니다.

- `unity/Assets/TinyLegion/Domain`: Unity API에 의존하지 않는 데이터·전투·효과·계정·통신 계약. 계산은 `double`, 30Hz 입력, JavaScript와 같은 반올림을 사용합니다. 계정 규칙은 조회·성장·보석·모집·편성·생산·진행·저장 책임별 partial 파일로 나눕니다. 특수능력 정규화/비용과 생산 경제는 전투·계정이 같은 서비스를 사용합니다. Unity Physics2D는 보상 판정에 사용하지 않습니다.
- `unity/Assets/TinyLegion/Presentation`: 공통 화면/입력과 전장 표시. 정의·조건·성장식을 화면에 복제하지 않습니다.
- `unity/Assets/TinyLegion/Runtime`: 저장·Unity 생명주기·웹 통신·음악과 앱 연결.
- `scripts/unity/export-catalog.mjs`: 유지 중인 웹 정의에서 캐릭터·스테이지·강화·효과·경제 데이터를 내보냅니다. JSON은 임의 수정하지 않습니다. 데이터 원본을 독립적으로 두 벌 유지하지 않습니다.
- `scripts/unity/export-art.mjs`: 기존 SVG를 Unity 텍스처로 렌더링하고 CC0 음악을 복사합니다. `export-audio.mjs`로 웹의 공통 `AUDIO_CUES` 정의를 짧은 PCM 효과음으로 변환합니다. 초기 실행 시 파형을 다시 계산하지 않으며, 효과음 임포트는 정규화 없이 정의된 음량을 보존합니다. `export-icons.mjs`로 유지 중인 웹 아이콘도 내보냅니다. 원화를 새로 설계하지 않습니다.
- `scripts/unity/export-platform.mjs`: `dist/src/fullscreen.js`의 공통 전체화면 진입 함수를 Unity Web 브리지로 내보냅니다. 미지원/거절·수동 회전 안내와 진입 중 종료 처리를 공유하며, 브라우저에서 전체화면을 종료하면 방향 고정을 해제합니다. 생성된 `.jslib`를 직접 수정하지 않습니다. Unity 내장 JavaScript 최적화기의 문법 제한에 맞춰 exporter가 ES2017로 변환합니다. 최적화 없는 브리지 단독 링크 성공만으로 실제 Web 빌드의 최종 링크를 보장할 수 없습니다.
- `unity/Tests`: .NET에서 순수 계산·통신을 검사하고 기존 JS 입력 재생과 비교할 경계. Unity 컴파일·실제 화면·기기 검증은 별도입니다.

## 웹 디자인 비교 기준

Unity 화면은 유지 중인 `dist/style.css`와 `dist/src/renderer.js`의 기존 디자인을 기준으로 이식합니다. 원본 SVG·전장·아이콘이 이미 있으므로 에셋 부재를 이유로 다른 디자인을 기본값으로 삼지 않습니다. 공통 `UiKit`이 먹색·아이보리·세이지 헤더·둥근 모달/버튼·파스텔 메뉴를 관리하고, 웹 아이콘의 흰색 마스크를 함께 내보내 Unity에서 화면별 색을 적용합니다. PC의 16:9 프레임은 Web 템플릿에서 한 번만 적용하고 전장 카메라는 실제 캔버스 전체를 사용합니다. 작은 가로 화면은 전체 화면을 유지합니다. Web은 렌더 버퍼와 캔버스 CSS 폭의 비율로 HUD와 전장 크기를 보정해 고해상도 화면에서 UI가 절반 크기가 되지 않도록 합니다. 전장 텍스처는 `npotScale=None`으로 원본 비율을 보존합니다.

현재 고해상도 PC(1280×720)와 667×375 가로의 브라우저 비교에서 전장·소환 카드·공통 모달·동료 성장/도감의 큰 배치 차이를 확인하고 수정했습니다. `SceneryResourceTests`의 원본 PNG/임포트 크기 비교를 포함한 Editor 검사 15개와 Web 배율/전체화면 브리지 검사 8개가 통과했습니다.

같은 화면 크기에서 전장 지면·성/동료 크기·성 체력 위치, 재화/전투력/미션/생산 HUD, 중앙 5×2 카드와 좌우 골드·대포, 일반/안내/오른쪽 메뉴 모달을 비교합니다. 원본 웹과 Unity의 기능 수용 검증에 디자인 비교를 포함하며, 브라우저 비교와 모바일 실기기 수용은 구분합니다.

Unity HUD의 전투력은 왼쪽 위 프로필 바로 아래에 놓습니다. 도토리 보유량은 원래의 프로필 오른쪽 상단에 아이콘과 숫자로 표시하고 다이아를 그 아래에 놓습니다. 시간당 생산량은 HUD에 상시 표시하지 않습니다. 왼쪽 아래의 작은 도토리 아이콘을 눌러 보유량, 현재 스테이지의 분당/시간당 생산, 기록의 측정 기간과 8시간 예상량, 스테이지별 생산 기록을 일반 패널 모달에서 확인합니다. 아이콘의 클릭 영역은 40px이며 표시 아이콘은 20px입니다.

웹의 공통 모달은 `dist/src/modal-ui.js`의 종류→레이아웃 표를 `openModal(제목, 종류, 렌더)`가 사용하고 `dist/style.css`가 크기를 제한합니다. 정확한 규격은 [화면 사양의 공통 모달](../SPEC/interface.md#공통-모달)을 따릅니다. Unity의 `UiKit.cs` 안 `ModalNavigation.Show`/`Resize`도 공통 프레임과 크기를 사용하지만 일부 호출은 제목으로 분류하며, 웹의 작은 `notice` 규격과 종류별 전체 매핑은 아직 이식하지 않았습니다.

## 환경

Unity Editor LTS `6000.3.26f1`과 Web Build Support를 사용합니다. 두 기기의 Editor와 패키지 버전을 고정합니다. Unity CLI 설치와 계정 로그인은 Editor 라이선스 활성화를 대신하지 않습니다. 브라우저의 로그인 확인과 사용할 라이선스의 선택·약관 동의는 사용자가 진행하며, 비밀번호·토큰을 저장소에 넣지 않습니다.

이번 Mac에서 별도 설치한 실행 파일은 `/Users/twkim/.local/share/tiny-legion-unity-cli/bin/unity`, 순수 C# 검사용 .NET 8 SDK는 `/Users/twkim/.local/share/tiny-legion-dotnet/dotnet`입니다. 일반 환경에서는 PATH의 `unity`, `dotnet`을 사용합니다.

`unity auth login`으로 로그인 요청을 열고 브라우저에서 확인합니다. 이어 `unity license status --json`의 `active`가 `true`인지 확인합니다. `signedIn: true`만으로 Editor를 실행할 수 있는 것은 아닙니다. Personal을 사용하는 경우 CLI는 `unity license activate --personal --accept-eula`를 요구합니다. 사용자가 해당 라이선스와 약관을 확인한 뒤 직접 실행하며, 자동 빌드에서는 약관 동의를 대신 실행하지 않습니다. 다른 라이선스의 활성화 옵션은 `unity license activate --help`를 확인합니다.

Editor 첫 창 실행에서는 라이선스 활성화와 별도의 Unity Editor Software Terms 동의를 요구할 수 있습니다. 사용자가 해당 창을 확인합니다. Play Mode 자동 검증에는 버전이 고정된 `com.unity.pipeline`을 사용하고, CLI 명령은 이 worktree의 `unity/` 절대 경로를 지정합니다. 한 프로젝트의 Editor 실행과 배치 빌드를 동시에 진행하지 않습니다.

```sh
npm ci
node scripts/unity/export-catalog.mjs
node scripts/unity/export-art.mjs
node scripts/unity/export-scenery.mjs
node scripts/unity/export-icons.mjs
node scripts/unity/export-platform.mjs
node scripts/unity/generate-meta.mjs
mkdir -p .sites-local
node unity/Tests/Combat/generate-parity.mjs .sites-local/combat-parity.json
node unity/Tests/Account/generate-parity.mjs .sites-local/account-parity.json
dotnet run --project unity/Tests/TinyLegion.Domain.Checks.csproj -- unity/Assets/TinyLegion/Resources/Data/catalog.json .sites-local/combat-parity.json .sites-local/account-parity.json
```

`.meta`, `Packages`, `ProjectSettings`와 소스를 Git에 포함합니다. `Library`, `Temp`, 빌드·검사 출력·로컬 계정 저장은 제외합니다. 큰 재사용 원본 자산의 증가 시 LFS 적용 여부를 검토하며 Sites 원격의 LFS 지원을 먼저 확인합니다.

## 데이터와 검증 경계

로컬 저장 읽기 실패는 새 계정으로 원본을 덮어쓰지 않습니다. `JsonFileStore`가 실패 후 일반 쓰기를 거부하고, 컨트롤러가 전투·정산·복귀·종료 저장을 중지합니다. 복구 화면에서는 원본 내보내기·정상 저장 가져오기·초기화를 선택합니다. 확인 후 가져오기/초기화는 읽지 못한 원본을 고유한 복구 사본으로 먼저 보관합니다. Web PlayerPrefs 경로도 같은 복구 경계를 적용합니다. Native 파일 저장은 같은 디렉터리의 임시 파일과 원자적 교체를 사용하며, 복구 사본은 이후 저장에서 유지합니다.

Editor 검증에서는 실행 전 `TINY_LEGION_TEST_SAVE_DIRECTORY`에 검증용 폴더의 절대 경로를 지정해 실제 기기 저장과 분리합니다. 이 변수는 Editor 조건에서만 적용되고 Player에는 포함되지 않습니다. 정상 검증과 손상 저장 복구 검증은 각각 별도 폴더를 사용합니다.

분리된 Editor 저장에서 OS 내보내기/가져오기 대화상자의 취소와 JSON 내보내기·파일 선택 후 확인 창 연결을 확인했습니다. 손상된 UTF-8 원본에서 전투가 차단되고, 파일 선택/교체 확인 취소와 필수 복구 화면 닫기 후에도 원본이 유지되었습니다. 원본 내보내기와 복원 확정 시 생성된 고유한 `.recovery` 사본은 원본 바이트와 일치했습니다. 복원 후 Play Mode를 다시 시작해 정상 저장 읽기·방치 재개·복구 사본 유지도 확인했습니다. 확인/취소 버튼은 CLI로 키보드 포커스를 지정한 뒤 실제 Return 입력으로 검사했으며, GameView의 마우스 클릭 수용과 구분합니다.

모집·성장·보석 행동 버튼은 공통 `ButtonAvailability` 조건을 사용합니다. 방치 정산이 끝나거나 잔액이 바뀌면 기존 화면과 입력 초안을 유지하며 버튼 사용 가능 상태만 갱신합니다. 정산 중 열린 모집 화면의 버튼이 계속 잠겼던 오류를 실제 Web에서 재현해 수정했습니다.

필수 안내/복구 화면 위에 열린 선택적 상세·확인 창에서 전체 닫기를 눌러도 필수 화면은 유지합니다. `ModalNavigationTests`는 Unity Test Framework의 EditMode에서 이 닫기/뒤로가기 계약을 검사합니다. 현재 Editor에서 해당 닫기/뒤로가기 검사와 전장 리소스 로딩 검사가 통과했습니다. 전체 화면/입력 수용과 구분합니다.

사이트 접속의 `connecting`/`retrying` 상태에서는 실패 안내를 띄우지 않습니다. 실제 게스트 접속에서 응답 전 실패 안내가 잠깐 나타났던 문제를 수정했고, `ConnectionPresentationTests`는 접속 대기 중 계정 화면 유지와 실제 `offline` 상태의 재연결 버튼을 검사합니다. 현재 Editor 검사 12개가 통과했습니다. Sites 신규 게스트에서 첫 출정·첫 숲길 결과 반영·무료 씨앗 다람쥐 모집·두 동료 재출정 승리·도토리 200/다이아 10 보상·마지막 방치 안내를 확인했습니다. 방치 성 체력 100%/40초 기록과 결과창을 연 채 자동 재시작·생산이 반영됐고, 최신 배포본을 다시 로드해 진행도 보존과 방치 재개를 확인했습니다. 초기 안내 이후 1-2 교체/첫 성장 등 초반 안내 전체 흐름은 남습니다.

저장 파일 선택/내보내기는 `IGameController`를 통해 Runtime으로 전달합니다. Web은 브라우저의 다운로드·파일 선택을 사용하고 Editor는 OS 파일 대화상자를 사용합니다. Editor에서 선택 취소는 진행도를 바꾸지 않으며, 선택한 UTF-8 JSON은 제한된 스트림 읽기로 1MB를 넘기지 않고 기존 확인 창·정규화·저장 경로로 넘깁니다. 잘못된 인코딩·크기·형식과 내보내기 실패는 안내합니다. 독립 네이티브 Player의 OS 파일 선택기 연결은 별도로 확인해야 하며, 현재는 JSON 붙여넣기 가져오기와 기기 저장 폴더의 `exports/`로 내보내기를 사용합니다. 손상된 Native 원본은 텍스트로 재해석하지 않고 파일 바이트를 복사해 보관합니다.

캐릭터 ID·효과 ID·종족·속성·공격 유형은 기존 정의와 같습니다. 효과 대상은 축 사이 AND·축 안 OR이며 `all`은 열린 조건입니다. 같은 출처·종류는 교체하고 독립 강화 출처는 공존합니다. UI와 엔진은 동일 정의/능력치/설명 서비스를 소비합니다. 상태 표식·공격 출처 스냅샷은 같은 대상 조건을 사용하며, 캐시된 태그 조회와 발사 시점의 독립 사본을 구분합니다. 전장 캐릭터/발사체 표시 객체는 풀에서 재사용합니다.

Sites 온라인 계정은 서버 API가 재화·전투 결과를 결정합니다. C# 결과와 현재 JS 서버 입력 재생이 일치하는지 검증한 뒤 서비스에 연결합니다. 기존 D1 계정은 로컬 저장으로 변환하지 않습니다. 로컬 모드와 온라인 계정의 경계를 유지하며 버전 불일치·응답 유실·인증 만료·세션 교체를 기존 계약대로 처리합니다.

모든 구현과 검증의 미완료 조건은 [TODO](../TODO.md#unity-이식)에 유지합니다. 자동 테스트는 기기/Unity/Sites 수용 검증을 대신하지 않습니다.

## Editor와 웹 빌드

`unity/`를 Unity에서 열고 `Assets/TinyLegion/Scenes/Main.unity`를 실행합니다. URP 2D 기본 자산과 실제 패키지 버전은 설치한 Editor의 2D 템플릿/내장 패키지에서 가져왔습니다. `Tiny Legion/Prepare project`는 프로젝트 설정·스프라이트 임포트·기본 실행 씬을 재현합니다. `Tiny Legion/Build Web`는 `unity/Builds/Web`를 만듭니다. 전장 PNG는 `ArtImporter`가 2D 텍스처로 임포트하며 `SceneryResourceTests`가 실제 `Texture2D` 로딩을 검사합니다. `DefaultImporter`의 불완전한 PNG 메타데이터에서 큐브맵으로 임포트되어 성·배경이 사라졌던 오류를 수정했습니다.

```sh
unity run unity -- -executeMethod TinyLegion.Editor.ProjectSetup.Prepare
unity run unity -- -executeMethod TinyLegion.Editor.ProjectSetup.BuildWeb
TINY_LEGION_UNITY_WEB=1 npm run build
```

현재 빌드의 wasm 약 53MB와 data 약 23MB는 gzip 후 합계 약 27MB이며, 포함한 Worker는 약 39MB입니다. 상하단 막대를 제거하고 중앙 5×2 정사각 소환 카드와 안전 영역 안의 HUD, 파스텔 아이콘·오른쪽 메뉴, 짧은 안내/확인 창을 사용합니다. 1280×720·667×375 브라우저에서 카드 중심/정사각 비율·메뉴·모달 닫기·편성 적용 버튼 접근을 확인했습니다. 편성 모드 전환의 초안 보존과 다른 모드 적용 시 현재 방치 유지도 확인했습니다. 손가락 수용 검증은 별도로 남습니다. 현재 Sites 준비는 기존 Worker에 `/unity/` 파일을 추가하는 명시적 옵션입니다. wasm/data를 바이너리로 제공하고 gzip·MIME·HEAD/Range를 유지합니다. Sites의 Cloudflare Worker에는 이미 gzip한 응답을 `encodeBody: manual`로 전달해 이중 압축을 막습니다. Node 로컬 서버의 압축 검사는 이 Worker 확장을 검증하지 못합니다. 바이너리는 중간 문자 배열 없이 변환하고 HEAD/ETag 일치 응답은 디코딩을 생략합니다. HTML에서 loader/framework/wasm/data URL에 각 파일의 콘텐츠 해시를 붙여 Unity·브라우저 캐시가 이전 실행 코드를 재사용하거나 서로 다른 빌드의 파일을 섞지 않도록 합니다. 바이너리의 콘텐츠 ETag와 재검증도 유지합니다. 큰 데이터를 문자열로 내장하는 초기 경로이므로 빌드 크기·메모리·Sites 용량 검증 후 R2 등 별도 저장으로 분리할 필요가 있을 수 있습니다. 64MiB Worker 상한을 넘으면 빌드를 중단합니다. 기존 `/` 화면은 이식 수용 전 유지합니다.

`node scripts/unity/check-unity-source.mjs`와 `--web`는 `.asmdef`의 프로젝트 참조·외부 참조·`noEngineReferences`를 따르는 별도 어셈블리로 설치된 Unity API에 정적으로 컴파일합니다. 화면은 `IGameController`를 통해 저장 내보내기/가져오기를 요청하며 Runtime의 플랫폼 브리지를 직접 참조하지 않습니다. `--web`는 Editor 전용 코드를 제외하고 Web 조건부 코드를 검사합니다. 이 검사는 패키지 임포트·Editor/IL2CPP 실행을 대신하지 않습니다. 다른 기기는 `TINY_LEGION_UNITY_EDITOR`, `TINY_LEGION_DOTNET`로 실행 경로를 지정합니다.

`node --test tests/unity-platform.test.js`는 생성된 Web 전체화면 브리지를 브라우저 API 대역에서 실행해 미지원·거절·방향 고정·종료 경합을 검사합니다. 설치된 Unity Web 컴파일러에서 브리지 단독 링크를 확인했습니다. 실제 Unity Web 빌드의 최종 링크도 통과했습니다. 기기의 전체화면·회전 확인은 별도로 수행합니다.

음악 선택은 카탈로그의 `musicByStage`를 소비합니다. 공통 `MusicPlaybackState`가 음소거/포커스 복귀와 새 곡 시작을 구분해 같은 곡의 재생 위치를 보존합니다. 소환·대포·승리·성공한 성장/모집/보석/보상 명령은 해당 효과음을 사용하며, 방치 자동 소환과 비활성 화면에는 효과음을 재생하지 않습니다. 순수 C# 음악 상태 검사와 `tests/audio.test.js`, `tests/unity-audio.test.js`의 파형/음량/톤 검사는 실제 기기 청취 검증을 대신하지 않습니다.

## 구현과 수용 상태

C# 전투·공통 효과·능력치·계정 규칙, 전장/HUD·안내·모집·성장·보석·도감·편성·기록·일일 수령·설정·로그인/관리자 화면의 소스와 연결을 작성했습니다. 현재 JS 전투/능력치 비교와 계정 명령/정규화/기록 비교, 응답 유실·인증 만료·저장 가져오기 검사는 통과합니다. 기존 서버 테스트·웹 전체 테스트·기본 Worker 빌드와 Unity 파일 대역의 MIME/바이너리 제공도 확인했습니다. 이 자동 증거와 별도로 위 범위의 Editor/Web/Sites 실행을 확인했습니다. 전체 시나리오와 모바일 기기 수용은 별도입니다.

남은 검증은 신규 안내 전체 진행·Editor GameView의 마우스 입력·사이트 계정 연결/세션 교체/전투 보상과 실제 모바일 기기 수용입니다. Editor의 파일 선택·내보내기·손상 저장 복구 검증 범위는 위 데이터와 검증 경계를 따릅니다. 이식 완료 여부는 [TODO](../TODO.md#unity-이식)의 남은 조건으로 판단합니다.
