<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Copy, never move, the current customized plugin's records into tables
     * independently owned by glitter-gdpr. This migration runs once and leaves
     * every legacy row intact.
     */
    public function up(): void
    {
        $pairs = [
            'gdpr_user_consents' => 'glitter_gdpr_user_consents',
            'gdpr_user_consent_histories' => 'glitter_gdpr_user_consent_histories',
            'gdpr_policy_versions' => 'glitter_gdpr_policy_versions',
        ];

        foreach ($pairs as $legacy => $target) {
            if (! Schema::hasTable($legacy) || ! Schema::hasTable($target)) {
                continue;
            }

            // The policy migration creates a default initial row. Replace only
            // the new target's install-time data when legacy history exists.
            if ($legacy === 'gdpr_policy_versions' && DB::table($legacy)->exists()) {
                DB::table($target)->delete();
            }

            DB::table($legacy)
                ->orderBy('id')
                ->chunkById(500, function ($rows) use ($target): void {
                    $payload = $rows->map(static fn ($row): array => (array) $row)->all();
                    if ($payload !== []) {
                        DB::table($target)->insertOrIgnore($payload);
                    }
                });
        }
    }

    public function down(): void
    {
        // Imported records belong to glitter-gdpr after installation. Rollback
        // must not selectively erase consent/history data.
    }
};
