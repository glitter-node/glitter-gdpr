<?php

namespace Plugins\Glitter\Gdpr\Http\Controllers\Admin;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use App\Services\PluginSettingsService;
use Illuminate\Http\JsonResponse;
use Plugins\Glitter\Gdpr\Http\Requests\UpdateAdminSettingsRequest;
use Plugins\Glitter\Gdpr\Services\BannerContentService;
use Plugins\Glitter\Gdpr\Services\CookieCategoryService;
use Plugins\Glitter\Gdpr\Services\GdprSettingsService;

/**
 * GDPR 관리자 설정 컨트롤러
 *
 * - GET  /api/plugins/glitter-gdpr/admin/settings : 전체 설정 조회 (3탭)
 * - PUT  /api/plugins/glitter-gdpr/admin/settings : 설정 저장 (consent surface 변경 시 material 정책 자동 발행)
 *
 * 권한: settings.manage (라우트 미들웨어에서 검증)
 *
 * 카테고리 활성 상태 또는 활성 카테고리의 effective description 변경은
 * GdprSettingsService가 저장 전에 새 material 정책을 발행합니다. 그 밖의 정책 변경은 운영자가 「+ 새 버전 발행」
 * (POST /admin/policy-versions) 으로 명시 트리거합니다 — GdprAdminPolicyVersionController.
 */
class GdprAdminSettingsController extends AdminBaseController
{
    /**
     * 플러그인 식별자
     */
    private const PLUGIN_ID = 'glitter-gdpr';

    /**
     * GdprAdminSettingsController 생성자
     *
     * @param  PluginSettingsService  $pluginSettings  플러그인 설정 서비스 (코어 — 조회용)
     * @param  GdprSettingsService  $settingsService  GDPR 설정 저장 서비스
     */
    public function __construct(
        private readonly PluginSettingsService $pluginSettings,
        private readonly GdprSettingsService $settingsService,
        private readonly BannerContentService $bannerContentService,
        private readonly CookieCategoryService $categoryService,
    ) {
        parent::__construct();
    }

    /**
     * 현재 GDPR 플러그인 설정 전체를 반환합니다 (관리자 화면 폼 바인딩용).
     *
     * @return JsonResponse
     */
    public function show(): JsonResponse
    {
        $settings = $this->pluginSettings->get(self::PLUGIN_ID);

        $settings = $this->normalizeJsonFields(is_array($settings) ? $settings : []);

        return ResponseHelper::success('common.success', [
            'settings' => $settings,
        ]);
    }

    /**
     * GDPR 플러그인 설정을 저장합니다.
     *
     * 카테고리 consent surface가 달라지면 새 material 정책이 자동 발행됩니다.
     * 그 밖의 정책 변경은 운영자가 「+ 새 버전 발행」을 클릭해야 발행됩니다.
     *
     * @param  UpdateAdminSettingsRequest  $request  검증된 요청
     * @return JsonResponse
     */
    public function update(UpdateAdminSettingsRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // 운영자 자유 입력 change_memo는 수동 발행 엔드포인트에서만 받는다.
        unset($validated['change_memo']);

        $result = $this->settingsService->saveAdminSettings($validated);

        return ResponseHelper::success('glitter-gdpr::messages.settings.saved', [
            'settings' => $this->normalizeJsonFields($result['settings']),
        ]);
    }

    /**
     * 응답에서 JSON 필드는 디코드하여 객체/배열로 노출합니다.
     *
     * @param  array<string, mixed>  $settings  설정 배열
     * @return array<string, mixed>
     */
    private function normalizeJsonFields(array $settings): array
    {
        foreach (['cookie_categories'] as $jsonKey) {
            if (! array_key_exists($jsonKey, $settings)) {
                continue;
            }

            $value = $settings[$jsonKey];
            if (is_string($value)) {
                $decoded = json_decode($value, true);
                $settings[$jsonKey] = is_array($decoded) ? $decoded : [];
            }
        }

        $settings['cookie_categories'] = $this->categoryService->getCategoryDefinitionsForSettings($settings);
        $settings['category_description_defaults'] = $this->categoryService->getDefaultCategoryDescriptions();
        $settings['effective_content'] = [
            'banner' => $this->bannerContentService->resolveAllLocales($settings),
            'categories' => $this->categoryService->getDescriptionContentForSettings($settings),
        ];
        foreach ($this->categoryService->getEnabledCategories() as $key => $enabled) {
            $settings[$key.'_enabled'] = $enabled;
        }

        return $settings;
    }
}
