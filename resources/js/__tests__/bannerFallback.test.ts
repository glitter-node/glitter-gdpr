import { afterEach, describe, expect, it, vi } from 'vitest';
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

function createSubject() {
    const root = { render: vi.fn(), unmount: vi.fn() };
    const createRoot = vi.fn(() => root);
    const renderBanner = vi.fn(() => ({ type: 'canonical-banner' }));
    const subject = new ConsentBannerFallback({ document, createRoot, renderBanner });

    return { subject, root, createRoot, renderBanner };
}

describe('ConsentBannerFallback', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('does not mount a fallback when the layout banner exists', () => {
        const layoutBanner = document.createElement('div');
        layoutBanner.id = CONSENT_BANNER_ID;
        document.body.append(layoutBanner);
        const { subject, createRoot } = createSubject();

        expect(subject.reconcile(visibleContext())).toBe('layout');
        expect(createRoot).not.toHaveBeenCalled();
        expect(document.querySelector(FALLBACK_ROOT_SELECTOR)).toBeNull();
    });

    it('mounts the canonical renderer when no layout banner exists and consent is required', () => {
        const { subject, root, createRoot, renderBanner } = createSubject();
        const context = visibleContext();

        expect(subject.reconcile(context)).toBe('fallback');
        expect(document.querySelectorAll(FALLBACK_ROOT_SELECTOR)).toHaveLength(1);
        expect(createRoot).toHaveBeenCalledTimes(1);
        expect(renderBanner).toHaveBeenCalledWith(context);
        expect(root.render).toHaveBeenCalledWith({ type: 'canonical-banner' });
    });

    it('reuses an existing fallback instead of creating a duplicate', () => {
        const { subject, createRoot } = createSubject();

        subject.reconcile(visibleContext());
        subject.reconcile(visibleContext());

        expect(document.querySelectorAll(FALLBACK_ROOT_SELECTOR)).toHaveLength(1);
        expect(createRoot).toHaveBeenCalledTimes(1);
    });

    it('remains duplicate-safe across route layout rerenders', () => {
        const { subject } = createSubject();

        subject.reconcile(visibleContext());
        document.querySelector('#app')?.replaceChildren();
        subject.reconcile(visibleContext());
        subject.reconcile(visibleContext());

        expect(document.querySelectorAll(FALLBACK_ROOT_SELECTOR)).toHaveLength(1);
    });

    it('self-heals a pre-existing duplicate when layout and fallback are both present', () => {
        const mount = document.createElement('div');
        mount.setAttribute('data-glitter-gdpr-root', '');
        const fallbackBanner = document.createElement('div');
        fallbackBanner.id = CONSENT_BANNER_ID;
        mount.append(fallbackBanner);
        const layoutBanner = document.createElement('div');
        layoutBanner.id = CONSENT_BANNER_ID;
        document.body.append(layoutBanner, mount);
        const { subject } = createSubject();

        expect(subject.reconcile(visibleContext())).toBe('layout');
        expect(document.querySelectorAll(`#${CONSENT_BANNER_ID}`)).toHaveLength(1);
        expect(document.querySelectorAll(FALLBACK_ROOT_SELECTOR)).toHaveLength(0);
    });

    it('removes fallback when the layout banner appears later', () => {
        const { subject } = createSubject();
        subject.reconcile(visibleContext());
        const layoutBanner = document.createElement('div');
        layoutBanner.id = CONSENT_BANNER_ID;
        document.body.append(layoutBanner);

        expect(subject.reconcile(visibleContext())).toBe('layout');
        expect(document.querySelectorAll(FALLBACK_ROOT_SELECTOR)).toHaveLength(0);
        expect(document.querySelectorAll(`#${CONSENT_BANNER_ID}`)).toHaveLength(1);
    });

    it('keeps one rendering path through repeated route reconciliations', () => {
        const { subject } = createSubject();
        const layoutBanner = document.createElement('div');
        layoutBanner.id = CONSENT_BANNER_ID;
        document.body.append(layoutBanner);

        for (let route = 0; route < 3; route++) {
            expect(subject.reconcile(visibleContext())).toBe('layout');
            expect(document.querySelectorAll(`#${CONSENT_BANNER_ID}`)).toHaveLength(1);
            expect(document.querySelectorAll(FALLBACK_ROOT_SELECTOR)).toHaveLength(0);
        }
    });

    it('unmounts the fallback after consent is completed', () => {
        const { subject, root } = createSubject();
        subject.reconcile(visibleContext());

        const context = visibleContext();
        context.consent.has_consented = true;

        expect(subject.reconcile(context)).toBe('hidden');
        expect(root.unmount).toHaveBeenCalledTimes(1);
        expect(document.querySelector(FALLBACK_ROOT_SELECTOR)).toBeNull();
    });

    it('does not mount when the banner is disabled', () => {
        const { subject, createRoot } = createSubject();
        const context = visibleContext();
        context.settings.banner_enabled = false;

        expect(subject.reconcile(context)).toBe('hidden');
        expect(createRoot).not.toHaveBeenCalled();
        expect(document.querySelector(FALLBACK_ROOT_SELECTOR)).toBeNull();
    });
});
