export interface ConsentEnforcementSettings {
    enforcement_enabled?: unknown;
}

/**
 * Backward-compatible enforcement switch. Only an explicit boolean false opts
 * a site into provider/API-only mode; missing or malformed legacy values keep
 * the upstream enforcement behavior enabled.
 */
export function isConsentEnforcementEnabled(settings: ConsentEnforcementSettings | undefined): boolean {
    return settings?.enforcement_enabled !== false;
}
