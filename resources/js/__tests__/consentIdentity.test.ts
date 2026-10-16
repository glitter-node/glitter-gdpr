import { describe, expect, it, vi } from 'vitest';
import { registerConsentIdentityRefresh } from '../consentIdentity';

describe('consent identity refresh bridge', () => {
    it('invalidates before refreshing on the core auth identity signal', () => {
        let authChanged: (() => void) | undefined;
        const authManager = {
            on: vi.fn((_event: 'authStateChange', handler: () => void) => { authChanged = handler; }),
        };
        const calls: string[] = [];
        const runtime = {
            invalidate: vi.fn(() => { calls.push('invalidate'); }),
            refresh: vi.fn(async () => {
                calls.push('refresh');
                return {
                    status: 'unknown' as const,
                    contractVersion: 1 as const,
                    categories: {},
                    needsRenewal: false,
                    currentPolicyVersion: '',
                };
            }),
        };

        registerConsentIdentityRefresh(authManager, runtime);
        expect(authManager.on).toHaveBeenCalledWith('authStateChange', expect.any(Function));

        authChanged?.();
        expect(calls).toEqual(['invalidate', 'refresh']);
    });
});
