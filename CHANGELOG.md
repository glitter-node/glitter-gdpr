# Changelog

모든 주요 변경사항은 Keep a Changelog와 Semantic Versioning을 따릅니다.

## [0.5.13]

### Fixed

- Added the markup source counterparts for the policy version snapshot and publish modal partials so current G7 layout validation can resolve its source-first include candidates without weakening path-boundary checks.
- Preserved the paired JSON contracts, modal bindings, actions, API calls, and translated user-facing strings.

## [0.5.2]

### Fixed

- SPA route transition 중 layout banner가 일시적으로 사라지는 순간을 최종 부재로 오인해 fallback을 중복 mount하던 race를 수정했습니다.
- layout banner가 다시 나타나면 기존 plugin fallback root를 자동 정리하고, 반복 route 전환에서도 하나의 rendering path만 유지합니다.

### Verification

- 실제 Chrome 시크릿 창에서 fresh guest 초기 진입, SPA navigation, Back/Forward 및 layout/fallback 상호 배제를 검증했습니다.
- `동의 없이 진행`과 `모두 동의`의 새로고침 지속성, 사이트 데이터 삭제 후 fresh guest 배너 재등장을 검증했습니다.


## [0.5.1]

### Fixed

- ID가 있는 첫 top-level component를 무조건 선택하던 unsafe custom-template layout root fallback을 제거하고, 명시적으로 child collection을 가진 유일한 structural host만 선택합니다.
- 호환 가능한 layout host가 없는 템플릿에서는 플러그인 소유 단일 DOM mount가 기존 canonical consent renderer를 사용하도록 하여 GDPR banner 렌더링 fallback을 보장합니다.

## [0.5.0]

### Added

- 관리자 GDPR 설정 응답과 화면에 배너 제목·안내 문구 및 4개 카테고리 설명의 locale별 `raw` override, 실제 `effective` 문구, `default`/`override` source를 함께 제공합니다.
- override 입력값과 분리된 read-only effective preview를 추가하여 저장 후 public consent UI에 적용되는 한국어·영어 문구를 관리자 화면에서 확인할 수 있습니다.

### Changed

- public banner, Admin preview가 `BannerContentService`의 동일 resolver와 기존 frontend plugin translation을 사용하며, category Admin preview는 public/policy snapshot이 사용하던 `CookieCategoryService` effective-description resolver를 재사용합니다.
- 빈 값과 공백은 계속 null override로 보존하고 기본 번역으로 fallback하며, preview 조회만으로 정책 버전을 발행하지 않습니다.

### Security

- Admin effective preview도 일반 text binding만 사용하여 운영자 입력의 HTML·script 문자열을 markup으로 해석하지 않습니다.

## [0.4.1]

### Fixed

- 활성 User template가 `user_global_overlay` 확장점을 제공하면 해당 공식 확장점에, 제공하지 않으면 실제 `_user_base` root에 public consent contribution을 동기화하여 template 종류와 무관하게 activation 직후 적용되도록 보장합니다.
- plugin activation/update와 User template 전환 lifecycle에서 contribution 및 layout/browser cache version을 함께 갱신합니다.
- 전용 overlay extension point와 `_user_base` fallback 중 현재 template에 맞는 경로 하나만 유지하여 재활성화·업데이트·cache refresh 후에도 consent banner가 중복 주입되지 않도록 했습니다.

## [0.4.0]

### Added

- necessary, functional, analytics, marketing의 사용자 안내 문구를 한국어·영어별로 재정의하는 optional flat settings와 관리자 textarea를 추가했습니다.
- 정책 snapshot에 locale별 raw override와 4개 카테고리의 effective description을 함께 보존합니다.

### Changed

- 활성 카테고리의 effective description 변경은 material policy를 자동 발행하고, 비활성 카테고리의 문구만 바꾸는 경우에는 ON 전환 시점까지 발행을 미룹니다.
- 공개 consent UI가 현재 locale의 effective description을 선택하며, 빈 값·공백은 기존 플러그인 기본 문구로 fallback합니다.

### Security

- 운영자 category description은 일반 text binding으로만 렌더링하여 HTML·script를 실행하지 않습니다.

## [0.3.0]

### Added

- 사이트 운영자가 쿠키 배너 제목과 안내 문구를 한국어·영어별로 재정의할 수 있는 optional flat settings와 관리자 입력 UI를 추가했습니다.
- 공개 settings 응답에 현재 요청 locale의 최소 `banner_content.title/message` 필드를 추가했습니다.

### Security

- 운영자 문구는 trim된 plain text로만 렌더링하며, HTML·script 문자열도 DOM element나 실행 코드로 해석하지 않습니다.

### Changed

- locale별 custom 값이 비어 있으면 기존 plugin translation을 그대로 사용하고 다른 locale의 custom 값은 대신 사용하지 않습니다.
- 수동 정책 버전 발행 시 당시 locale별 배너 문구를 settings snapshot에 보존합니다.

## [0.2.0]

### Added

- 사이트별 기능·분석·마케팅 쿠키 카테고리 ON/OFF 설정과 관리자 토글을 추가했습니다. 필수 쿠키는 항상 활성이고 기존 설치의 기본값은 네 카테고리 모두 활성입니다.
- 비활성 카테고리를 공개 선택 목록에서 숨기고, 직접 요청·과거 동의·모두 동의 결과에서도 effective consent를 false로 강제합니다. 차단 도메인은 유지합니다.
- 카테고리 사용 여부 변경을 저장할 때 새 material 정책 버전을 발행하여 OFF→ON 전환이 과거 grant를 복원하지 않도록 했습니다. 다른 설정은 수동 정책 발행을 유지합니다.
- 선택 카테고리가 0개이면 불필요한 선택 배너를 생략합니다. 공개 snapshot은 네 boolean key와 contractVersion 1을 유지합니다.

### Changed

- 한국어·영어 배너 설명을 특정 분석/마케팅 사용을 전제하지 않는 문구로 변경했습니다.
- 동시 설정 저장 직렬화, boolean 문자열 정규화, 필수 category 정규화 및 fail-closed 회귀 테스트를 추가했습니다.

## [0.1.5]

### Fixed

- 공개 템플릿의 공통 `_user_base` 레이아웃에 consent banner를 overlay로 주입하여, 별도 `user_global_overlay` 확장점을 제공하지 않는 템플릿에서도 신규 방문자 배너가 표시되도록 수정했습니다.

## [0.1.4]

### Fixed

- `Icon`을 등록하지 않는 사용자 템플릿에서도 public consent overlay의 모든 노드가 렌더링되도록 정책 링크와 제출 상태의 비필수 장식 아이콘 의존을 제거했습니다.

## [0.1.3]

### Fixed

- `Icon` 컴포넌트를 등록하지 않는 커스텀 템플릿에서도 제목 표시가 렌더링되도록 public consent banner의 `cookie-bite` 의존을 작은 `Span` notice mark로 교체했습니다.

## [0.1.2]

### Changed

- public consent banner 제목 왼쪽의 작은 `cookie-bite` 아이콘에 붉은색 계열 accent를 적용했습니다.

## [0.1.1]

### Fixed

- 기존 배너의 정보 계층과 동일하게 public consent banner 제목을 동의 설명 위로 복원했습니다.

## [0.1.0]

### Added

- `glitter-gdpr` 독립 플러그인 계보를 시작했습니다.
- 현재 프로젝트의 맞춤 `sirsoft-gdpr` 구현에서 consent runtime (`getSnapshot`, `refresh`, `subscribe`, `invalidate`), AuthManager `authStateChange` 무효화, stale generation 보호를 계승했습니다.
- `enforcement_enabled`로 공개 provider/runtime과 방문자 배너·차단 enforcement를 분리하는 동작을 계승했습니다.
- 활성 템플릿의 Tailwind 스캔과 무관한 플러그인 자체 public banner CSS를 계승했습니다.
- 독립 namespace, route, permission, settings, layout contribution, frontend runtime, asset, cookie 및 데이터베이스 identity를 적용했습니다.
- 기존 `sirsoft-gdpr` 데이터와 서명된 게스트 세션을 삭제하지 않고 독립 저장소로 안전하게 승계하는 초기 설치 호환 경로를 추가했습니다.

### Provenance

- 이 플러그인은 이 프로젝트에 존재하던 맞춤 `sirsoft-gdpr` 구현에서 출발했으며 Glitter.kr가 독립적으로 유지보수합니다.
- `glitter-gdpr`는 공식 SIRSOFT 또는 공식 Gnuboard7 플러그인 릴리스가 아닙니다.
