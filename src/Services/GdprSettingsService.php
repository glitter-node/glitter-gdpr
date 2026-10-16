<?php

namespace Plugins\Glitter\Gdpr\Services;

use App\Extension\HookManager;
use App\Services\PluginSettingsService;
use Plugins\Glitter\Gdpr\Enums\GdprPolicyChangeType;

/**
 * GDPR 관리자 설정 저장 서비스
 *
 * Controller 가 검증된 입력을 본 Service 에 위임하여 settings 를 저장합니다.
 *
 * Category availability and active effective-description changes publish a material policy before
 * saving settings. Other settings retain the existing manual publication workflow.
 */
class GdprSettingsService
{
    /**
     * 플러그인 식별자
     */
    private const PLUGIN_ID = 'glitter-gdpr';

    /**
     * snapshot 비교/저장 대상 키 화이트리스트.
     *
     * 운영자가 「+ 새 버전 발행」 클릭 시 현재 settings 상태를
     * 새 정책 버전 row 의 snapshot 으로 보존하기 위한 키 화이트리스트.
     *
     * @var array<int, string>
     */
    private const SNAPSHOT_KEYS = [
        'functional_enabled',
        'analytics_enabled',
        'marketing_enabled',
        'cookie_categories',
        'blocked_domains',
        'privacy_policy_slug',
        'legal_entity_name',
        'data_storage_location',
        'banner_title_ko',
        'banner_message_ko',
        'banner_title_en',
        'banner_message_en',
        'necessary_description_ko',
        'necessary_description_en',
        'functional_description_ko',
        'functional_description_en',
        'analytics_description_ko',
        'analytics_description_en',
        'marketing_description_ko',
        'marketing_description_en',
    ];

    private const OPERATOR_TEXT_KEYS = [
        'banner_title_ko',
        'banner_title_en',
        'banner_message_ko',
        'banner_message_en',
        'necessary_description_ko',
        'necessary_description_en',
        'functional_description_ko',
        'functional_description_en',
        'analytics_description_ko',
        'analytics_description_en',
        'marketing_description_ko',
        'marketing_description_en',
    ];

    /**
     * GdprSettingsService 생성자
     *
     * @param PluginSettingsService $pluginSettings 코어 플러그인 설정 서비스
     */
    public function __construct(
        private readonly PluginSettingsService $pluginSettings,
        private ?GdprPolicyVersionService $policyVersionService = null,
    ) {}

    /**
     * 관리자 설정을 저장합니다.
     *
     * 흐름:
     * 1. 입력값 정규화 (cookie_categories JSON 직렬화 등)
     * 2. settings 저장 (PluginSettingsService)
     *
     * Category ON/OFF and active effective-description changes publish a new policy.
     *
     * 훅:
     * - before_save: 저장 직전
     * - filter_save_payload: 저장 페이로드 필터 가능
     * - after_save: 저장 후
     *
     * @param array<string, mixed> $input 검증된 FormRequest 입력
     * @return array{settings: array<string, mixed>}
     */
    public function saveAdminSettings(array $input): array
    {
        // Settings are file-backed. Serialize read/compare/publish/save against
        // concurrent admin saves, then discard this process's cached settings.
        $lock = fopen(storage_path('framework/glitter-gdpr-category-settings.lock'), 'c');
        if ($lock === false) {
            throw new \RuntimeException(__('glitter-gdpr::messages.settings.save_failed'));
        }
        try {
            if (! flock($lock, LOCK_EX)) {
                throw new \RuntimeException(__('glitter-gdpr::messages.settings.save_failed'));
            }
            $this->pluginSettings->clearCache(self::PLUGIN_ID);

            return $this->saveLocked($input);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function saveLocked(array $input): array
    {
        $payload = $this->preparePayload($input);

        HookManager::doAction(self::PLUGIN_ID.'.settings.before_save', $payload);
        $payload = HookManager::applyFilters(self::PLUGIN_ID.'.settings.filter_save_payload', $payload);

        $payload = $this->preparePayload($payload);
        $before = $this->loadCurrentSettings();
        $after = array_merge($before, $payload);
        $beforeSnapshot = $this->buildSnapshot($before);
        $afterSnapshot = $this->buildSnapshot($after);
        if ($this->categoryConsentSurface($beforeSnapshot) !== $this->categoryConsentSurface($afterSnapshot)) {
            // Publish FIRST: a failed settings write can only cause renewal, never
            // resurrect a grant made before a disable/re-enable cycle.
            $this->policyVersionService ??= app(GdprPolicyVersionService::class);
            $this->policyVersionService->publish(
                GdprPolicyChangeType::Material,
                $afterSnapshot,
                __('glitter-gdpr::messages.settings.category_consent_surface_changed'),
                request()->user()?->id,
            );
        }
        if (! $this->pluginSettings->save(self::PLUGIN_ID, $payload)) {
            throw new \RuntimeException(__('glitter-gdpr::messages.settings.save_failed'));
        }

        $savedSettings = $this->loadCurrentSettings();

        HookManager::doAction(self::PLUGIN_ID.'.settings.after_save', $savedSettings);

        return [
            'settings' => $savedSettings,
        ];
    }

    /**
     * 현재 settings 의 snapshot 을 반환합니다 (정책 의미 키 화이트리스트 한정).
     *
     * 운영자 수동 정책 버전 발행 시 *현재 settings 상태 그대로* 스냅샷으로 보존하기 위해 사용.
     *
     * @return array<string, mixed>
     */
    public function getCurrentSnapshot(): array
    {
        return $this->buildSnapshot($this->loadCurrentSettings());
    }

    /**
     * 현재 settings 를 array 로 로드합니다.
     *
     * cookie_categories 는 JSON 문자열로 저장되어 있으므로 디코드합니다.
     *
     * @return array<string, mixed>
     */
    private function loadCurrentSettings(): array
    {
        $settings = $this->pluginSettings->get(self::PLUGIN_ID);
        $settings = is_array($settings) ? $settings : [];

        if (isset($settings['cookie_categories']) && is_string($settings['cookie_categories'])) {
            $decoded = json_decode($settings['cookie_categories'], true);
            $settings['cookie_categories'] = is_array($decoded) ? $decoded : [];
        }

        $settings['necessary_enabled'] = true;
        foreach (['functional', 'analytics', 'marketing'] as $category) {
            $key = $category.'_enabled';
            $settings[$key] = filter_var($settings[$key] ?? true, FILTER_VALIDATE_BOOLEAN);
        }
        foreach (self::OPERATOR_TEXT_KEYS as $key) {
            $value = $settings[$key] ?? null;
            $value = is_string($value) ? trim($value) : '';
            $settings[$key] = $value === '' ? null : $value;
        }

        return $settings;
    }

    /**
     * 저장 페이로드를 준비합니다 (cookie_categories JSON 직렬화 포함).
     *
     * @param array<string, mixed> $input 검증된 입력
     * @return array<string, mixed>
     */
    private function preparePayload(array $input): array
    {
        $payload = $input;
        foreach (['functional', 'analytics', 'marketing'] as $category) {
            $key = $category.'_enabled';
            if (array_key_exists($key, $payload)) {
                $payload[$key] = filter_var($payload[$key], FILTER_VALIDATE_BOOLEAN);
            }
        }
        $payload['necessary_enabled'] = true;

        foreach (self::OPERATOR_TEXT_KEYS as $key) {
            if (! array_key_exists($key, $payload) || ! is_string($payload[$key])) {
                continue;
            }
            $value = trim($payload[$key]);
            $payload[$key] = $value === '' ? null : $value;
        }

        if (isset($payload['cookie_categories']) && is_array($payload['cookie_categories'])) {
            $payload['cookie_categories'] = json_encode(
                array_values($payload['cookie_categories']),
                JSON_UNESCAPED_UNICODE,
            );
        }

        return $payload;
    }

    /**
     * settings 에서 snapshot 비교 대상 키만 추출합니다.
     *
     * @param array<string, mixed> $settings
     * @return array<string, mixed>
     */
    private function buildSnapshot(array $settings): array
    {
        if (is_string($settings['cookie_categories'] ?? null)) {
            $settings['cookie_categories'] = json_decode($settings['cookie_categories'], true) ?? [];
        }
        $snapshot = ['necessary_enabled' => true];
        foreach (self::SNAPSHOT_KEYS as $key) {
            $snapshot[$key] = $settings[$key] ?? null;
        }
        $snapshot['cookie_categories'] = (new CookieCategoryService($this->pluginSettings))
            ->getCategoryDefinitionsForSettings($settings);

        return $snapshot;
    }

    /**
     * Compare only category identities and effective descriptions visible on the consent surface.
     * Disabled categories are intentionally omitted until they are enabled.
     *
     * @return array<string, array{ko: string, en: string}>
     */
    private function categoryConsentSurface(array $snapshot): array
    {
        $surface = [];
        foreach ($snapshot['cookie_categories'] ?? [] as $category) {
            if (! is_array($category) || ! is_string($category['key'] ?? null)) {
                continue;
            }
            $key = $category['key'];
            if ($key !== 'necessary' && ! filter_var($snapshot[$key.'_enabled'] ?? true, FILTER_VALIDATE_BOOLEAN)) {
                continue;
            }
            $surface[$key] = is_array($category['description'] ?? null) ? $category['description'] : [];
        }
        ksort($surface);

        return $surface;
    }
}
