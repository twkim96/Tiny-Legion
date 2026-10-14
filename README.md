# Tiny Legion

모바일 가로 화면을 기준으로 한 오리지널 2D 방치·도전·속공 게임의 초기 플레이 버전입니다. PC도 같은 가로 전장과 조작 구성을 사용합니다. 현재 두 지역 20스테이지와 동료 15종을 제공합니다. 모집으로 새 동료를 얻고, 희귀도·보유 상태를 도감에서 확인할 수 있습니다.

주력 개발은 웹+Android이며 외부 테스트는 기존 [Sites 웹](https://tiny-legion.space-9004.chatgpt.site)을 기준으로 진행합니다. 플랫폼별 저장과 Unity 보존 범위는 [플랫폼 방향](docs/SPEC/platforms.md)을 따릅니다.

## 실행

Node.js 22 LTS와 Python 3을 사용합니다. 정적 로컬 개발은 설치 없이 실행합니다. 서버 배포는 `npm ci`와 `npm run build`를 사용합니다.

```sh
npm run dev
# http://127.0.0.1:4173
```

실제 게임 소스는 `dist/`이며 서버 API는 `server/`입니다. 테스트·서버 빌드·문법 검사와 구조는 [개발 안내](docs/development/local.md)를 참고합니다.

## 문서

- [사양 안내](docs/SPEC.md): 전투·생산, 성장·저장, 화면·아트, 확장 방향.
- [남은 개발과 수용 검증](docs/TODO.md).
- [Android QA 앱 빌드·설치·검증 범위](docs/development/android.md).
- [저장·복구와 호스팅](docs/operations/storage-and-hosting.md).
- [기획 v0.3 기록](docs/history/design-v0.3.md): 원본의 확정 방향·추천안·미정·예시 구분을 보존한 자료.

**Sites 배포는 서버 계정과 보상 검증을 사용합니다.** 게스트도 같은 검증을 받고, 설정에서 계정을 연결하면 다른 기기에서 이어갈 수 있습니다. 기존 로컬 테스트 저장은 서버에 가져오지 않습니다. 단일 활성 세션·저장·검증 범위는 [서버 계정 사양](docs/SPEC/server-account.md)에 있습니다. 정적 로컬 모드의 파일 저장·복구는 별도로 유지합니다.

전투 개념 참고는 냥코대전쟁, 방치 육성 개념 참고는 메이플키우기입니다. 캐릭터·아트·문구·리소스는 자체 제작합니다.
