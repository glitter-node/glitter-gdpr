<?php

namespace App\Upgrades\Data\Ext\Plugins\GlitterGdpr\V0_4_0\Migrations;

use App\Extension\Helpers\SettingsMigrator;
use App\Extension\Upgrade\DataMigration;
use App\Extension\UpgradeContext;

/** Add optional locale fields while preserving every existing default description. */
class AddCategoryDescriptionOverrides implements DataMigration
{
    public function name(): string
    {
        return 'AddCategoryDescriptionOverrides';
    }

    public function run(UpgradeContext $context): void
    {
        $migrator = SettingsMigrator::forPlugin('glitter-gdpr');
        foreach (['necessary', 'functional', 'analytics', 'marketing'] as $category) {
            foreach (['ko', 'en'] as $locale) {
                $migrator->addField($category.'_description_'.$locale, '');
            }
        }
        $result = $migrator->apply();
        $context->logger->info('Category user description override defaults', $result);
        if (! empty($result['errors'])) {
            throw new \RuntimeException(__('glitter-gdpr::messages.settings.save_failed'));
        }
    }
}
