import { describe, expect, it, vi } from 'vitest';
import { createConsentRuntime } from '../consentRuntime';

const granted = {
    categories: { necessary: true, functional: false, analytics: false, marketing: true },
    needs_renewal: false,
    current_policy_version: '1',
};

describe('public consent runtime contract', () => {
    it('starts unknown and shares one in-flight refresh', async () => {
        let resolve!: (value: typeof granted) => void;
        const fetcher = vi.fn(() => new Promise<typeof granted>((done) => { resolve = done; }));
        const runtime = createConsentRuntime(fetcher);

        expect(runtime.getSnapshot().status).toBe('unknown');
        const first = runtime.refresh();
        const second = runtime.refresh();
        expect(first).toBe(second);
        expect(fetcher).toHaveBeenCalledTimes(1);
        resolve(granted);
        await first;
    });

    it('publishes validated snapshots to every subscriber and supports cleanup', async () => {
        const runtime = createConsentRuntime(async () => granted);
        const first = vi.fn();
        const second = vi.fn();
        const unsubscribe = runtime.subscribe(first);
        runtime.subscribe(second);

        await runtime.refresh();
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        expect(runtime.getSnapshot()).toMatchObject({ status: 'ready', contractVersion: 1 });

        unsubscribe();
        await runtime.refresh();
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
    });

    it.each([null, { categories: { marketing: 'yes' } }, { categories: [] }])(
        'fails closed on malformed response %#',
        async (response) => {
            const runtime = createConsentRuntime(async () => response as never);
            expect((await runtime.refresh()).status).toBe('unknown');
        },
    );

    it('returns unknown and notifies on API failure', async () => {
        const runtime = createConsentRuntime(async () => { throw new Error('network'); });
        const listener = vi.fn();
        runtime.subscribe(listener);
        expect((await runtime.refresh()).status).toBe('unknown');
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('invalidates the cached snapshot and notifies subscribers', async () => {
        const runtime = createConsentRuntime(async () => granted);
        const listener = vi.fn();
        runtime.subscribe(listener);

        await runtime.refresh();
        listener.mockClear();
        runtime.invalidate();

        expect(runtime.getSnapshot().status).toBe('unknown');
        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: 'unknown' }));
    });

    it('ignores a stale response after identity invalidation and lets the new refresh win', async () => {
        let resolveGuest!: (value: typeof granted) => void;
        const member = {
            ...granted,
            categories: { ...granted.categories, marketing: false },
            current_policy_version: '2',
        };
        const fetcher = vi
            .fn()
            .mockImplementationOnce(() => new Promise<typeof granted>((resolve) => { resolveGuest = resolve; }))
            .mockResolvedValueOnce(member);
        const runtime = createConsentRuntime(fetcher);

        const guestRequest = runtime.refresh();
        runtime.invalidate();
        const memberRequest = runtime.refresh();

        expect(memberRequest).not.toBe(guestRequest);
        await expect(memberRequest).resolves.toMatchObject({
            status: 'ready',
            categories: { marketing: false },
            currentPolicyVersion: '2',
        });

        resolveGuest(granted);
        await guestRequest;
        expect(runtime.getSnapshot()).toMatchObject({
            status: 'ready',
            categories: { marketing: false },
            currentPolicyVersion: '2',
        });
    });
});
