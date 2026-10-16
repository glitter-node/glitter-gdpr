<?php

namespace App\Upgrades\Data\Ext\Plugins\GlitterGdpr\V0_3_0\Migrations;

use App\Extension\Helpers\SettingsMigrator;
use App\Extension\Upgrade\DataMigration;
use App\Extension\UpgradeContext;

/** Add optional locale fields without changing the existing translated banner. */
class AddBannerContentOverrides implements DataMigration
{
    public function name(): string
    {
        return 'AddBannerContentOverrides';
    }

    public function run(UpgradeContext $context): void
    {
        $result = SettingsMigrator::forPlugin('glitter-gdpr')
            ->addField('banner_title_ko', '')
            ->addField('banner_title_en', '')
            ->addField('banner_message_ko', '')
            ->addField('banner_message_en', '')
            ->apply();
        $context->logger->info('Banner content override defaults', $result);
        if (! empty($result['errors'])) {
            throw new \RuntimeException(__('glitter-gdpr::messages.settings.save_failed'));
        }
    }
}
