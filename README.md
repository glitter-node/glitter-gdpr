# Glitter GDPR (일반 데이터 보호 규정)

- Plugin: `glitter-gdpr`
- Vendor: Glitter.kr
- Version: `0.5.2`

Glitter.kr가 독립적으로 유지보수하는 Gnuboard7 플러그인입니다. 현재 프로젝트에 있던 맞춤 `sirsoft-gdpr` 구현에서 출발했으며, 해당 구현의 consent runtime/enforcement/템플릿 호환 작업을 계승했습니다. 공식 SIRSOFT 또는 공식 Gnuboard7 플러그인 릴리스가 아닙니다.

주요 기능은 필수·기능·분석·마케팅 동의 관리, 회원/게스트 동의 이력, 정책 버전 발행, 마이페이지 철회, 동의 전 추적 차단입니다. 공개 runtime은 `getSnapshot()`, `refresh()`, `subscribe()`, `invalidate()`를 제공하며 Core AuthManager의 `authStateChange` 시 visitor identity를 다시 동기화합니다. `enforcement_enabled=false`에서도 provider/status runtime은 유지되고 배너와 enforcement만 중지됩니다. public banner CSS는 플러그인 자체 bundle에서 공급되어 사용자 템플릿 Tailwind scan에 의존하지 않습니다.

## 설치 및 활성화

```bash
/usr/local/bin/php83 artisan plugin:install glitter-gdpr
/usr/local/bin/php83 artisan plugin:activate glitter-gdpr
```

기존 `sirsoft-gdpr`가 활성이라면 `glitter-gdpr` 검증 후 중복 enforcement 방지를 위해 정상 lifecycle로 비활성화합니다.

```bash
/usr/local/bin/php83 artisan plugin:deactivate sirsoft-gdpr
```

## 호환성과 데이터 소유권

새 플러그인은 `glitter_gdpr_*` 테이블, `glitter_gdpr_session` 쿠키, `glitter-gdpr` 설정·권한·라우트·번역·frontend identity를 소유합니다. 최초 설치 시 존재하는 기존 `gdpr_*` 레코드는 삭제나 이동 없이 새 테이블로 멱등 복제됩니다. 유효한 기존 `gdpr_session` 쿠키는 전환 요청에서 읽고 새 Glitter 쿠키를 발급해 방문자의 기존 동의를 유지합니다.

## 빌드 및 테스트

```bash
cd plugins/_bundled/glitter-gdpr
npm run build:watch
npm run test:run
```

개발 서버는 사용하지 않습니다. 배포 자산은 `dist/js/plugin.iife.js`와 `dist/css/plugin.css`입니다.

## 사이트별 쿠키 카테고리 (0.2.0)

GDPR 설정의 쿠키 카테고리에서 기능·분석·마케팅을 각각 켜거나 끌 수 있습니다.
필수는 항상 활성입니다. flat 설정 키는 `functional_enabled`, `analytics_enabled`,
`marketing_enabled`이며 기존 설치의 미설정 값은 모두 `true`입니다.
`necessary_enabled`는 입력과 관계없이 항상 `true`로 정규화합니다.

비활성은 사이트에서 사용하지 않음을 의미하며, 동의 없이 실행해도 된다는 뜻이 아닙니다.
공개 카테고리 목록에서는 숨기고 저장 요청·기존 동의의 effective 값은 `false`로 제한합니다.
차단 도메인 목록은 유지하므로 해당 리소스는 계속 차단됩니다.
선택 카테고리가 하나도 없으면 선택 배너를 표시하지 않습니다. 필수 쿠키는 기존처럼
동의 기록 대상이 아니므로 불필요한 acknowledgement 기록을 만들지 않습니다.

ON/OFF 변경을 저장하면 **먼저 새 material 정책 버전을 발행**합니다. 재활성화 시 과거
동의를 자동 복원하지 않으며 활성 선택 항목은 새 정책에 대한 결정을 받습니다.
동일 값 저장은 발행하지 않습니다. 다른 설정 변경은 기존 수동 발행 방식을 유지합니다.
설정 저장 실패 전에 정책 발행만 성공할 경우 추가 재동의가 필요할 수 있으나 과거 grant가
복원되지는 않습니다. 저장은 동시 관리자 요청을 직렬화하고 기존 consent 행을 삭제하지 않습니다.
category 변경은 `PUT /api/plugins/glitter-gdpr/admin/settings` 또는
`GdprSettingsService::saveAdminSettings()`를 사용합니다.

## 호스트별 배너 문구 (0.3.0)

운영자는 GDPR 설정의 쿠키 배너 영역에서 한국어·영어 제목과 안내 문구를 각각
재정의할 수 있습니다. 설정 키는 `banner_title_ko`, `banner_title_en`,
`banner_message_ko`, `banner_message_en`입니다. 값은 plain text이며 앞뒤 공백을
제거한 뒤 빈 값이면 해당 locale의 기존 `banner.title`/`banner.description` 번역으로
fallback합니다. 다른 locale에 입력한 값을 교차 fallback하지 않습니다.

공개 settings API는 내부 flat key를 노출하지 않고 현재 요청 locale에 해석된
`banner_content.title`과 `banner_content.message`만 additive field로 반환합니다.
관리자 settings 응답은 기존 flat override 키를 유지하면서 `effective_content`에 locale별
`raw`/`effective`/`source` preview metadata를 함께 반환합니다. 이 metadata는 저장 대상이 아니며,
public banner 및 policy snapshot의 기존 effective-description resolver를 재사용합니다.
버튼 문구와 카테고리 이름·설명은 기존 번역 및 category contract를 유지합니다.

공개 `getSnapshot()/refresh()/subscribe()/invalidate()` 및 contractVersion **1**은 유지합니다.
`categories`는 항상 `necessary/functional/analytics/marketing` 네 boolean key를 제공합니다.
availability는 공개 settings의 `enabled_categories`, `has_optional_categories`와 필터링된
`cookie_categories`로 전달하므로 consumer가 운영자 설정을 읽을 필요가 없습니다.

독립 PHP 단위 테스트(운영 DB·.env를 로드하지 않음):

```bash
/usr/local/bin/php83 vendor/bin/phpunit --no-configuration \
  --bootstrap plugins/_bundled/glitter-gdpr/tests/Isolated/bootstrap.php \
  plugins/_bundled/glitter-gdpr/tests/Isolated
```

배포 빌드는 플러그인 디렉토리에서 `G7_BUILD_SOURCEMAP=0 npm run build`로 수행합니다.

## 0.5.2 검증 상태

`glitter-gdpr 0.5.2`는 실제 Chrome 시크릿 창에서 사용자 템플릿과 SPA 전환을 포함한
수동 E2E 검증을 완료했습니다.

### Runtime contract

안정된 layout 경로에서는 다음 invariant를 유지합니다.

```text
#gdpr_cookie_banner = 1
[data-glitter-gdpr-root] = 0
```

호환 가능한 layout host가 없는 genuine fallback 경로에서는 다음을 기대합니다.

```text
#gdpr_cookie_banner = 0
[data-glitter-gdpr-root] = 1
```

두 경로의 banner가 동시에 존재하는 것은 regression입니다.

### Manual Chrome E2E

환경: Chrome 시크릿 모드, `https://hub.glitter.kr/`, 활성 템플릿 `glitter-project_hub`

- fresh guest 초기 진입: PASS
- 내부 SPA navigation: PASS
- Browser Back: PASS
- Browser Forward: PASS
- `동의 없이 진행`: PASS
- 거부 후 새로고침 시 배너 미재등장: PASS
- `모두 동의`: PASS
- 동의 후 새로고침 시 배너 미재등장: PASS
- 사이트 데이터 삭제 후 fresh guest 및 배너 재등장: PASS

자동화된 Vitest/TypeScript/PHP 테스트와 위 수동 Chrome E2E는 별도의 검증 단계입니다.
서버 환경의 headless Chromium은 `libatk-1.0.so.0` 제약으로 실행할 수 없지만, 실제 Chrome
시크릿 창 검증은 완료되었습니다.

## 카테고리 사용자 안내 문구 재정의 (0.4.0)

운영자는 necessary, functional, analytics, marketing 각 카테고리의 사용자 안내 문구를
한국어와 영어별로 선택적으로 재정의할 수 있습니다. 8개 flat setting은
`{category}_description_{ko|en}` 형식이며, 앞뒤 공백 제거 후 빈 값은 해당 locale의 기존
플러그인 기본 문구로 fallback합니다. 입력은 plain text로만 렌더링됩니다.

이 설정은 카테고리 이름, 사용 여부, 자동 차단 대상 및 대표 도구 예시와 독립적입니다.
비활성 카테고리는 override가 있어도 공개 선택 화면에서 숨겨지고 effective consent는 false로
유지됩니다. 활성 카테고리의 실제 effective KO/EN 문구가 바뀌면 material policy version을
발행해 returning visitor의 재동의를 요구합니다. 비활성 카테고리의 문구만 바꾸면 발행하지
않고, 이후 카테고리를 ON으로 바꾸는 시점에 현재 문구를 포함한 새 policy를 발행합니다.
