<?php

declare(strict_types=1);

namespace Plugins\Glitter\Gdpr\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Contracts\Repositories\LayoutRepositoryInterface;
use App\Contracts\Repositories\PluginRepositoryInterface;
use App\Contracts\Repositories\TemplateRepositoryInterface;
use App\Enums\ExtensionStatus;
use App\Enums\LayoutExtensionType;
use App\Enums\LayoutSourceType;
use App\Models\LayoutExtension;
use App\Services\LayoutExtensionService;
use Illuminate\Support\Facades\Log;
use Plugins\Glitter\Gdpr\Support\PublicConsentLayoutContribution;

final class SyncPublicConsentLayoutContribution implements HookListenerInterface
{
    private const PLUGIN_IDENTIFIER = 'glitter-gdpr';

    /** @return array<string, array<string, mixed>> */
    public static function getSubscribedHooks(): array
    {
        return [
            'core.plugins.activated' => [
                'method' => 'afterPluginLifecycle',
                'type' => 'action',
                'priority' => 20,
                'sync' => true,
            ],
            'core.plugins.updated' => [
                'method' => 'afterPluginLifecycle',
                'type' => 'action',
                'priority' => 20,
                'sync' => true,
            ],
            'core.templates.activated' => [
                'method' => 'afterTemplateActivated',
                'type' => 'action',
                'priority' => 20,
                'sync' => true,
            ],
        ];
    }

    public function handle(...$args): void {}

    public function afterPluginLifecycle(string $identifier): void
    {
        if ($identifier !== self::PLUGIN_IDENTIFIER) {
            return;
        }

        $this->syncActiveUserTemplates();
    }

    public function afterTemplateActivated(string $identifier): void
    {
        $plugin = app(PluginRepositoryInterface::class)->findByIdentifier(self::PLUGIN_IDENTIFIER);
        if ($plugin === null || $plugin->status !== ExtensionStatus::Active->value) {
            return;
        }

        $template = app(TemplateRepositoryInterface::class)->findByIdentifier($identifier);
        if ($template === null || $template->type !== 'user' || $template->status !== ExtensionStatus::Active->value) {
            return;
        }

        $this->syncTemplate((int) $template->id, $identifier);
    }

    public function syncActiveUserTemplates(): void
    {
        $this->removeNonUserContributions();

        foreach (app(TemplateRepositoryInterface::class)->getActiveByType('user') as $template) {
            $this->syncTemplate((int) $template->id, (string) $template->identifier);
        }
    }

    /** Remove legacy 0.4.0 rows that the old all-template scanner created for Admin templates. */
    private function removeNonUserContributions(): void
    {
        $service = app(LayoutExtensionService::class);
        $rows = LayoutExtension::withTrashed()
            ->where('source_type', LayoutSourceType::Plugin)
            ->where('source_identifier', self::PLUGIN_IDENTIFIER)
            ->whereIn('target_name', [
                '_user_base',
                PublicConsentLayoutContribution::GLOBAL_OVERLAY_EXTENSION_POINT,
            ])
            ->whereHas('template', static fn ($query) => $query->where('type', '!=', 'user'))
            ->get();

        foreach ($rows as $row) {
            $templateId = (int) $row->template_id;
            $type = $row->extension_type;
            $target = $row->target_name;
            $row->forceDelete();
            $service->invalidateExtensionCache($templateId, $target, $type);
        }
    }

    private function syncTemplate(int $templateId, string $templateIdentifier): void
    {
        $layoutRepository = app(LayoutRepositoryInterface::class);
        $baseLayout = $layoutRepository->findByName($templateId, '_user_base');
        if ($baseLayout === null || ! is_array($baseLayout->content)) {
            Log::warning('Glitter GDPR public consent contribution skipped: user base layout is unavailable.', [
                'template' => $templateIdentifier,
            ]);

            return;
        }

        $definition = $this->readBlueprint();
        $contribution = PublicConsentLayoutContribution::forBaseLayout($definition, $baseLayout->content);
        if ($contribution === null) {
            Log::warning('Glitter GDPR public consent contribution skipped: no supported host was found.', [
                'template' => $templateIdentifier,
                'layout' => '_user_base',
            ]);

            return;
        }

        $selectedType = isset($contribution['extension_point'])
            ? LayoutExtensionType::ExtensionPoint
            : LayoutExtensionType::Overlay;
        $selectedTarget = (string) ($contribution['extension_point'] ?? $contribution['target_layout']);

        $this->removeAlternativeContribution($templateId, $selectedType, $selectedTarget);

        $service = app(LayoutExtensionService::class);
        $service->registerExtension(
            $contribution,
            LayoutSourceType::Plugin,
            self::PLUGIN_IDENTIFIER,
            $templateId,
        );
        $service->invalidateExtensionCache($templateId, $selectedTarget, $selectedType);
    }

    private function removeAlternativeContribution(
        int $templateId,
        LayoutExtensionType $selectedType,
        string $selectedTarget,
    ): void {
        $service = app(LayoutExtensionService::class);
        $rows = LayoutExtension::withTrashed()
            ->where('template_id', $templateId)
            ->where('source_type', LayoutSourceType::Plugin)
            ->where('source_identifier', self::PLUGIN_IDENTIFIER)
            ->where(function ($query) {
                $query->where(function ($overlay) {
                    $overlay->where('extension_type', LayoutExtensionType::Overlay)
                        ->where('target_name', '_user_base');
                })->orWhere(function ($extensionPoint) {
                    $extensionPoint->where('extension_type', LayoutExtensionType::ExtensionPoint)
                        ->where('target_name', PublicConsentLayoutContribution::GLOBAL_OVERLAY_EXTENSION_POINT);
                });
            })
            ->get();

        foreach ($rows as $row) {
            if ($row->extension_type === $selectedType && $row->target_name === $selectedTarget) {
                continue;
            }

            $type = $row->extension_type;
            $target = $row->target_name;
            // PluginManager::restoreLayoutExtensions()가 activation 뒤에 실행된다. 대체 경로를
            // soft delete만 하면 전용 EP와 fallback이 함께 복원되므로 영구 제거한다.
            $row->forceDelete();
            $service->invalidateExtensionCache($templateId, $target, $type);
        }
    }

    /** @return array<string, mixed> */
    private function readBlueprint(): array
    {
        $path = dirname(__DIR__, 2).'/resources/extensions/cookie_banner.json';
        $contents = file_get_contents($path);
        if ($contents === false) {
            throw new \RuntimeException("Unable to read public consent layout blueprint: {$path}");
        }

        $definition = json_decode($contents, true, flags: JSON_THROW_ON_ERROR);
        if (! is_array($definition)) {
            throw new \RuntimeException("Invalid public consent layout blueprint: {$path}");
        }

        return $definition;
    }
}
