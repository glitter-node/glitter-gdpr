import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createLayoutTest, createMockComponentRegistryWithBasics, screen } from '../../../../../../../resources/js/core/template-engine/__tests__/utils/layoutTestUtils';
import overlay from '../../../extensions/cookie_banner.json';
import ko from '../../../lang/ko.json';

let harness: ReturnType<typeof createLayoutTest> | undefined;
afterEach(() => harness?.cleanup());

async function renderBanner(content?: { title?: string | null; message?: string | null }) {
    const registry = createMockComponentRegistryWithBasics();
    harness = createLayoutTest({ components: overlay.components as any }, {
        componentRegistry: registry as any,
        translations: { 'glitter-gdpr': ko },
        locale: 'ko',
        initialData: {
            gdprPublicSettings: {
                data: {
                    banner_enabled: true,
                    enforcement_enabled: true,
                    has_optional_categories: true,
                    cookie_categories: [],
                    banner_content: content,
                },
            },
            gdprMyConsent: { data: { has_consented: false, needs_renewal: false } },
        },
    });
    await harness.render();
}

describe('public banner content override rendering', () => {
    it('uses default translations when custom content is absent', async () => {
        await renderBanner();
        expect(screen.getByText(ko.banner.title)).toBeTruthy();
        expect(screen.getByText(ko.banner.description)).toBeTruthy();
    });

    it('supports partial overrides and keeps the other default translation', async () => {
        await renderBanner({ title: '호스트 전용 제목', message: null });
        expect(screen.getByText('호스트 전용 제목')).toBeTruthy();
        expect(screen.getByText(ko.banner.description)).toBeTruthy();
    });

    it('renders operator HTML as plain text without creating executable elements', async () => {
        const payload = '<script>globalThis.__gdprXss = true</script>';
        await renderBanner({ title: payload, message: '<img src=x onerror=alert(1)>' });
        expect(screen.getByText(payload)).toBeTruthy();
        expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
        expect(document.querySelector('script')).toBeNull();
        expect(document.querySelector('img')).toBeNull();
        expect((globalThis as any).__gdprXss).not.toBe(true);
    });
});
