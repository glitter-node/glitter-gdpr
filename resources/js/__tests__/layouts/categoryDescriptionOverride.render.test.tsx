import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createLayoutTest, createMockComponentRegistryWithBasics, screen } from '../../../../../../../resources/js/core/template-engine/__tests__/utils/layoutTestUtils';
import { findAllByName, serializeForSearch } from './helpers';
import adminLayout from '../../../layouts/admin/plugin_settings.json';
import publicExtension from '../../../extensions/cookie_banner.json';
import ko from '../../../lang/ko.json';

let harness: ReturnType<typeof createLayoutTest> | undefined;
afterEach(() => harness?.cleanup());

describe('Category User Description Override layout contract', () => {
    it('admin declares only dynamic KO/EN description override textareas and read-only default references', () => {
        const textareas = findAllByName(adminLayout as any, 'Textarea');
        const names = textareas.map(node => String(node.props?.name ?? ''));
        const serialized = serializeForSearch(adminLayout);

        expect(names).toContain('{{category.key}}_description_ko');
        expect(names).toContain('{{category.key}}_description_en');
        expect(names.some(name => name.includes('scope'))).toBe(false);
        expect(names.some(name => name.includes('tools'))).toBe(false);
        expect(serialized).toContain('category_description_defaults');
        expect(serialized).toContain('description_override.fallback_hint');
    });

    it('public category description uses ordinary text binding and renders hostile operator text safely', async () => {
        const serialized = JSON.stringify(publicExtension);
        expect(serialized).toContain("category?.description?.ko");
        expect(serialized).toContain("category?.description?.en");
        expect(serialized).not.toContain('dangerouslySetInnerHTML');
        expect(serialized).not.toContain('HtmlRenderer');
        expect(serialized).not.toContain('Markdown');

        const hostile = '<script>globalThis.__gdprCategoryXss=true</script><img src=x onerror=alert(1)><b>hello</b>';
        const registry = createMockComponentRegistryWithBasics();
        registry.register('basic', 'Checkbox', ({ checked, disabled, onChange }: any) => React.createElement('input', { type: 'checkbox', checked, disabled, onChange }));
        harness = createLayoutTest({ components: publicExtension.components as any }, {
            componentRegistry: registry as any,
            translations: { 'glitter-gdpr': ko },
            locale: 'ko',
            initialState: { _global: { gdprPreferencesOpen: true } },
            initialData: {
                gdprPublicSettings: {
                    data: {
                        banner_enabled: true,
                        enforcement_enabled: true,
                        has_optional_categories: true,
                        cookie_categories: [{ key: 'necessary', required: true, label: { ko: '필수 쿠키' }, description: { ko: hostile, en: 'English' } }],
                    },
                },
                gdprMyConsent: { data: { has_consented: false, needs_renewal: false } },
            },
        });
        await harness.render();
        expect(screen.getByText(hostile)).toBeTruthy();
        expect(document.querySelector('script')).toBeNull();
        expect(document.querySelector('img')).toBeNull();
        expect((globalThis as any).__gdprCategoryXss).not.toBe(true);
    });
});
