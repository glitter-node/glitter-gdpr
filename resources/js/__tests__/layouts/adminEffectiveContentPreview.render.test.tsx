import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createLayoutTest, createMockComponentRegistryWithBasics, screen } from '../../../../../../../resources/js/core/template-engine/__tests__/utils/layoutTestUtils';
import adminLayout from '../../../layouts/admin/plugin_settings.json';
import ko from '../../../lang/ko.json';
import { findById, serializeForSearch } from './helpers';

let harness: ReturnType<typeof createLayoutTest> | undefined;
afterEach(() => harness?.cleanup());

describe('admin effective content preview', () => {
    it('keeps override fields separate from read-only effective banner text', async () => {
        const preview = findById(adminLayout as any, 'effective_banner_title_ko');
        const input = findById(adminLayout as any, 'field_banner_title_ko');
        expect(preview).not.toBeNull();
        expect(input?.props?.value).toBeUndefined();
        expect(serializeForSearch(preview)).toContain('_local.form?.effective_content?.banner?.ko?.title?.effective');

        const hostile = '<script>globalThis.__gdprAdminXss=true</script>';
        harness = createLayoutTest({ components: [preview] as any }, {
            componentRegistry: createMockComponentRegistryWithBasics() as any,
            translations: { 'glitter-gdpr': ko },
            locale: 'ko',
            initialState: {
                _local: {
                    form: {
                        effective_content: {
                            banner: {
                                ko: { title: { effective: hostile, source: 'override' } },
                            },
                        },
                    },
                },
            },
        });
        await harness.render();

        expect(screen.getByText(hostile)).toBeTruthy();
        expect(document.querySelector('script')).toBeNull();
        expect((globalThis as any).__gdprAdminXss).not.toBe(true);
    });

    it('declares category effective previews as plain text bindings for both locales', () => {
        const serialized = serializeForSearch(adminLayout);
        const categoryInput = findById(adminLayout as any, 'category_description_ko_{{category.key}}');
        expect(categoryInput?.props?.value).toBeUndefined();
        expect(serialized).toContain('_local.form?.effective_content?.categories?.[category.key]?.ko?.effective');
        expect(serialized).toContain('_local.form?.effective_content?.categories?.[category.key]?.en?.effective');
        expect(serialized).not.toContain('dangerouslySetInnerHTML');
        expect(serialized).not.toContain('HtmlRenderer');
        expect(serialized).not.toContain('Markdown');
    });
});
