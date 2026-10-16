<?php

namespace Plugins\Glitter\Gdpr\Services;

use App\Services\PluginSettingsService;

/** Resolve locale-specific public banner copy from raw overrides and frontend translations. */
class BannerContentService
{
    private const PLUGIN_ID = 'glitter-gdpr';

    private const SUPPORTED_LOCALES = ['ko', 'en'];

    /** @var array<string, array<string, mixed>> */
    private array $frontendTranslationCache = [];

    public function __construct(
        private readonly PluginSettingsService $pluginSettings,
    ) {}

    /** @return array{title: string, message: string} */
    public function forLocale(?string $locale = null): array
    {
        $content = $this->resolveForLocale($locale);

        return [
            'title' => $content['title']['effective'],
            'message' => $content['message']['effective'],
        ];
    }

    /**
     * Return raw/effective/source metadata using the same resolver consumed by the public API.
     *
     * @param  array<string, mixed>|null  $settings
     * @return array{title: array{raw: ?string, effective: string, source: string}, message: array{raw: ?string, effective: string, source: string}}
     */
    public function resolveForLocale(?string $locale = null, ?array $settings = null): array
    {
        $locale = $this->normalizeLocale($locale ?? (string) app()->getLocale());
        $settings ??= $this->loadSettings();
        $translations = $this->frontendTranslations($locale);

        return [
            'title' => $this->resolveField(
                $settings['banner_title_'.$locale] ?? null,
                $this->translationValue($translations, 'title', $locale),
            ),
            'message' => $this->resolveField(
                $settings['banner_message_'.$locale] ?? null,
                $this->translationValue($translations, 'description', $locale),
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $settings
     * @return array<string, array<string, array{raw: ?string, effective: string, source: string}>>
     */
    public function resolveAllLocales(array $settings): array
    {
        $resolved = [];
        foreach (self::SUPPORTED_LOCALES as $locale) {
            $resolved[$locale] = $this->resolveForLocale($locale, $settings);
        }

        return $resolved;
    }

    private function normalizeLocale(string $locale): string
    {
        $locale = strtolower(str_replace('_', '-', trim($locale)));
        $locale = explode('-', $locale, 2)[0];
        if (in_array($locale, self::SUPPORTED_LOCALES, true)) {
            return $locale;
        }

        $fallback = strtolower((string) config('app.fallback_locale', 'en'));

        return in_array($fallback, self::SUPPORTED_LOCALES, true) ? $fallback : 'en';
    }

    private function normalizeText(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }

    /** @return array<string, mixed> */
    private function loadSettings(): array
    {
        $settings = $this->pluginSettings->get(self::PLUGIN_ID);

        return is_array($settings) ? $settings : [];
    }

    /** @return array<string, mixed> */
    private function frontendTranslations(string $locale): array
    {
        if (isset($this->frontendTranslationCache[$locale])) {
            return $this->frontendTranslationCache[$locale];
        }

        $path = dirname(__DIR__, 2).'/resources/lang/'.$locale.'.json';
        $contents = file_get_contents($path);
        if ($contents === false) {
            throw new \RuntimeException("Unable to read Glitter GDPR frontend translations: {$path}");
        }

        $translations = json_decode($contents, true, flags: JSON_THROW_ON_ERROR);

        return $this->frontendTranslationCache[$locale] = is_array($translations) ? $translations : [];
    }

    /** @param array<string, mixed> $translations */
    private function translationValue(array $translations, string $key, string $locale): string
    {
        $value = $translations['banner'][$key] ?? null;
        if (! is_string($value) || trim($value) === '') {
            throw new \RuntimeException("Missing Glitter GDPR banner.{$key} frontend translation for {$locale}");
        }

        return $value;
    }

    /** @return array{raw: ?string, effective: string, source: string} */
    private function resolveField(mixed $raw, string $default): array
    {
        $raw = $this->normalizeText($raw);

        return [
            'raw' => $raw,
            'effective' => $raw ?? $default,
            'source' => $raw === null ? 'default' : 'override',
        ];
    }
}
