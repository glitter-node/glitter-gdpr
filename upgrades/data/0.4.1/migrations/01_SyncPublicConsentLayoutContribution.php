<?php

namespace App\Upgrades\Data\Ext\Plugins\GlitterGdpr\V0_4_1\Migrations;

use App\Extension\Upgrade\DataMigration;
use App\Extension\UpgradeContext;
use Plugins\Glitter\Gdpr\Listeners\SyncPublicConsentLayoutContribution as ContributionSynchronizer;

/** Repair the active template contribution during the first update that introduces the synchronizer. */
class SyncPublicConsentLayoutContribution implements DataMigration
{
    public function name(): string
    {
        return 'SyncPublicConsentLayoutContribution';
    }

    public function run(UpgradeContext $context): void
    {
        (new ContributionSynchronizer)->syncActiveUserTemplates();
        $context->logger->info('Public consent layout contribution synchronized for active User templates.');
    }
}
