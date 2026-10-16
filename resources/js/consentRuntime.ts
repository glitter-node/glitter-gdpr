import { fetchConsentSnapshot, type FetchedConsentSnapshot } from './layouts';

export const CONSENT_RUNTIME_CONTRACT_VERSION = 1;

export interface PublicConsentSnapshot {
    status: 'ready' | 'unknown';
    contractVersion: 1;
    categories: Record<string, boolean>;
    needsRenewal: boolean;
    currentPolicyVersion: string;
}

type Listener = (snapshot: PublicConsentSnapshot) => void;
type Fetcher = () => Promise<FetchedConsentSnapshot | null>;

const unknownSnapshot = (): PublicConsentSnapshot => ({
    status: 'unknown',
    contractVersion: CONSENT_RUNTIME_CONTRACT_VERSION,
    categories: { necessary: true, functional: false, analytics: false, marketing: false },
    needsRenewal: false,
    currentPolicyVersion: '',
});

function normalize(value: FetchedConsentSnapshot | null): PublicConsentSnapshot | null {
    if (!value || !value.categories || Array.isArray(value.categories) || typeof value.categories !== 'object') {
        return null;
    }
    if (Object.values(value.categories).some((allowed) => typeof allowed !== 'boolean')) return null;
    if (typeof value.needs_renewal !== 'boolean' || typeof value.current_policy_version !== 'string') return null;

    return {
        status: 'ready',
        contractVersion: CONSENT_RUNTIME_CONTRACT_VERSION,
        categories: {
            ...value.categories,
            necessary: true,
            functional: !value.needs_renewal && value.categories.functional === true,
            analytics: !value.needs_renewal && value.categories.analytics === true,
            marketing: !value.needs_renewal && value.categories.marketing === true,
        },
        needsRenewal: value.needs_renewal,
        currentPolicyVersion: value.current_policy_version,
    };
}

export function createConsentRuntime(fetcher: Fetcher = fetchConsentSnapshot) {
    let snapshot = unknownSnapshot();
    let inFlight: Promise<PublicConsentSnapshot> | null = null;
    let generation = 0;
    const listeners = new Set<Listener>();

    const publish = (next: PublicConsentSnapshot): PublicConsentSnapshot => {
        snapshot = next;
        listeners.forEach((listener) => listener(snapshot));
        return snapshot;
    };

    return {
        contractVersion: CONSENT_RUNTIME_CONTRACT_VERSION,
        getSnapshot: (): PublicConsentSnapshot => snapshot,
        refresh: (): Promise<PublicConsentSnapshot> => {
            if (inFlight) return inFlight;
            const requestGeneration = generation;
            const request = fetcher()
                .then((value) => requestGeneration === generation
                    ? publish(normalize(value) ?? unknownSnapshot())
                    : snapshot)
                .catch(() => requestGeneration === generation
                    ? publish(unknownSnapshot())
                    : snapshot)
                .finally(() => {
                    if (inFlight === request) inFlight = null;
                });
            inFlight = request;
            return request;
        },
        invalidate: (): void => {
            generation += 1;
            inFlight = null;
            publish(unknownSnapshot());
        },
        subscribe: (listener: Listener): (() => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

export const consentRuntime = createConsentRuntime();
