import { describe, expect, it } from 'vitest';
import { isConsentEnforcementEnabled } from '../enforcement';

describe('consent enforcement setting', () => {
    it('preserves upstream enforcement by default', () => {
        expect(isConsentEnforcementEnabled(undefined)).toBe(true);
        expect(isConsentEnforcementEnabled({})).toBe(true);
    });

    it('disables enforcement only for an explicit false value', () => {
        expect(isConsentEnforcementEnabled({ enforcement_enabled: false })).toBe(false);
        expect(isConsentEnforcementEnabled({ enforcement_enabled: true })).toBe(true);
        expect(isConsentEnforcementEnabled({ enforcement_enabled: 'false' })).toBe(true);
    });
});
