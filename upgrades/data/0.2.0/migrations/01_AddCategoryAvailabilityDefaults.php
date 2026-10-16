<?php

namespace App\Upgrades\Data\Ext\Plugins\GlitterGdpr\V0_2_0\Migrations;

use App\Extension\Helpers\SettingsMigrator;
use App\Extension\Upgrade\DataMigration;
use App\Extension\UpgradeContext;

/** Additive only: existing operator choices and consent history are untouched. */
class AddCategoryAvailabilityDefaults implements DataMigration
{
    public function name(): string
    {
        return 'AddCategoryAvailabilityDefaults';
    }

    public function run(UpgradeContext $context): void
    {
        $result = SettingsMigrator::forPlugin('glitter-gdpr')
            ->addField('necessary_enabled', true)
            ->addField('functional_enabled', true)
            ->addField('analytics_enabled', true)
            ->addField('marketing_enabled', true)
            ->apply();
        $context->logger->info('Category availability defaults', $result);
        if (! empty($result['errors'])) {
            throw new \RuntimeException(__('glitter-gdpr::messages.settings.save_failed'));
        }
    }
}
