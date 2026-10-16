import type { PublicConsentSnapshot } from './consentRuntime';

interface AuthManagerContract {
    on(event: 'authStateChange', handler: () => void): void;
}

interface ConsentRuntimeContract {
    invalidate(): void;
    refresh(): Promise<PublicConsentSnapshot>;
}

/**
 * Core AuthManager의 공식 identity-change signal을 consent cache에 연결한다.
 * Identity 자체는 server status endpoint가 판정하며 frontend는 식별자를 저장하지 않는다.
 */
export function registerConsentIdentityRefresh(
    authManager: AuthManagerContract,
    runtime: ConsentRuntimeContract,
): void {
    authManager.on('authStateChange', () => {
        runtime.invalidate();
        void runtime.refresh();
    });
}
