import { afterEach, describe, expect, it, vi } from 'vitest';
import { StableLayoutCommitObserver } from '../layoutCommitObserver';
import {
    CONSENT_BANNER_ID,
    FALLBACK_ROOT_SELECTOR,
    ConsentBannerFallback,
    type ConsentBannerContext,
} from '../bannerFallback';

function visibleContext(): ConsentBannerContext {
    return {
        settings: {
            cookie_policy_version: 'test-v1',
            enforcement_enabled: true,
            banner_enabled: true,
            has_optional_categories: true,
        },
        consent: { has_consented: false },
        globalState: { currentUser: null },
    };
}

describe('StableLayoutCommitObserver', () => {
    let frameCallbacks: FrameRequestCallback[];

    afterEach(() => {
        document.body.innerHTML = '';
    });

    function setup() {
        frameCallbacks = [];
        const requestFrame = vi.fn((callback: FrameRequestCallback) => {
            frameCallbacks.push(callback);
            return frameCallbacks.length;
        });
        const flushFrame = () => {
            const callback = frameCallbacks.shift();
            callback?.(0);
        };
        const app = document.createElement('div');
        app.id = 'app';
        document.body.append(app);

        return { app, requestFrame, flushFrame };
    }

    it('waits for the final layout insertion after a transient banner removal', async () => {
        const { app, requestFrame, flushFrame } = setup();
        const onStable = vi.fn();
        const observer = new StableLayoutCommitObserver(requestFrame, onStable);
        const oldBanner = document.createElement('div');
        oldBanner.id = 'gdpr_cookie_banner';
        app.append(oldBanner);

        observer.observe(app);
        app.replaceChildren();
        await Promise.resolve();

        expect(requestFrame).toHaveBeenCalledTimes(1);
        flushFrame();
        expect(requestFrame).toHaveBeenCalledTimes(2);

        const newBanner = document.createElement('div');
        newBanner.id = 'gdpr_cookie_banner';
        app.append(newBanner);
        await Promise.resolve();

        flushFrame();
        expect(onStable).not.toHaveBeenCalled();
        expect(requestFrame).toHaveBeenCalledTimes(3);

        flushFrame();
        flushFrame();

        expect(onStable).toHaveBeenCalledTimes(1);
        expect(app.querySelector('#gdpr_cookie_banner')).toBe(newBanner);
    });

    it('does not invoke the commit callback for every intermediate mutation', async () => {
        const { app, requestFrame, flushFrame } = setup();
        const onStable = vi.fn();
        const observer = new StableLayoutCommitObserver(requestFrame, onStable);

        observer.observe(app);
        app.append(document.createElement('div'));
        app.append(document.createElement('div'));
        await Promise.resolve();

        flushFrame();
        flushFrame();

        expect(onStable).toHaveBeenCalledTimes(1);
    });

    it('waits for a route mutation when the previous layout is still mounted', async () => {
        const { app, requestFrame, flushFrame } = setup();
        const onStable = vi.fn();
        const observer = new StableLayoutCommitObserver(requestFrame, onStable);

        observer.observe(app, true);
        await Promise.resolve();
        expect(requestFrame).not.toHaveBeenCalled();

        app.append(document.createElement('div'));
        await Promise.resolve();
        expect(requestFrame).toHaveBeenCalledTimes(1);
        flushFrame();
        flushFrame();

        expect(onStable).toHaveBeenCalledTimes(1);
    });

    it('does not leave a fallback after a route removes and recreates the layout banner', async () => {
        const { app, requestFrame, flushFrame } = setup();
        const root = { render: vi.fn(), unmount: vi.fn() };
        const subject = new ConsentBannerFallback({
            document,
            createRoot: vi.fn(() => root),
            renderBanner: vi.fn(() => ({ type: 'canonical-banner' })),
        });
        const initialBanner = document.createElement('div');
        initialBanner.id = CONSENT_BANNER_ID;
        app.append(initialBanner);
        subject.reconcile(visibleContext());

        const observer = new StableLayoutCommitObserver(requestFrame, () => {
            subject.reconcile(visibleContext());
        });
        observer.observe(app, true);
        app.replaceChildren();
        await Promise.resolve();
        flushFrame();

        const nextBanner = document.createElement('div');
        nextBanner.id = CONSENT_BANNER_ID;
        app.append(nextBanner);
        await Promise.resolve();
        flushFrame();
        flushFrame();
        flushFrame();

        expect(document.querySelectorAll(`#${CONSENT_BANNER_ID}`)).toHaveLength(1);
        expect(document.querySelectorAll(FALLBACK_ROOT_SELECTOR)).toHaveLength(0);
    });
});
