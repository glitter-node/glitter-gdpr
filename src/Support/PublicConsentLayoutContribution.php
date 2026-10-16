<?php

declare(strict_types=1);

namespace Plugins\Glitter\Gdpr\Support;

final class PublicConsentLayoutContribution
{
    public const GLOBAL_OVERLAY_EXTENSION_POINT = 'user_global_overlay';

    /**
     * Resolve the static consent blueprint against a template's real user base.
     *
     * @param  array<string, mixed>  $definition
     * @param  array<string, mixed>  $baseLayout
     * @return array<string, mixed>|null
     */
    public static function forBaseLayout(array $definition, array $baseLayout): ?array
    {
        $components = $definition['components'] ?? ($definition['injections'][0]['components'] ?? null);
        if (! is_array($components) || $components === []) {
            return null;
        }

        if (self::hasGlobalOverlayExtensionPoint($baseLayout)) {
            unset($definition['target_layout'], $definition['injections']);
            $definition['extension_point'] = self::GLOBAL_OVERLAY_EXTENSION_POINT;
            $definition['mode'] = 'append';
            $definition['components'] = $components;

            return $definition;
        }

        $rootId = self::rootComponentId($baseLayout);
        if ($rootId === null) {
            return null;
        }

        unset($definition['extension_point'], $definition['mode'], $definition['components']);
        $definition['target_layout'] = '_user_base';
        $definition['injections'] = [[
            'target_id' => $rootId,
            'position' => 'append_child',
            'components' => $components,
        ]];

        return $definition;
    }

    /** @param array<string, mixed> $node */
    private static function hasGlobalOverlayExtensionPoint(array $node): bool
    {
        if (($node['type'] ?? null) === 'extension_point'
            && ($node['name'] ?? null) === self::GLOBAL_OVERLAY_EXTENSION_POINT) {
            return true;
        }

        foreach ($node as $value) {
            if (is_array($value) && self::hasGlobalOverlayExtensionPoint($value)) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string, mixed> $baseLayout */
    private static function rootComponentId(array $baseLayout): ?string
    {
        $components = $baseLayout['components'] ?? null;
        if (! is_array($components)) {
            return null;
        }

        $structuralHosts = [];
        foreach ($components as $component) {
            if (! is_array($component)) {
                continue;
            }

            $id = $component['id'] ?? ($component['props']['id'] ?? null);
            if (is_string($id)
                && $id !== ''
                && array_key_exists('children', $component)
                && is_array($component['children'])) {
                $structuralHosts[] = $id;
            }
        }

        return count($structuralHosts) === 1 ? $structuralHosts[0] : null;
    }
}
