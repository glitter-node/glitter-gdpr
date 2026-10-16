import { afterEach, describe, expect, it } from 'vitest';
import { createLayoutTest, createMockComponentRegistryWithBasics, fireEvent, screen, waitFor } from '../../../../../../../resources/js/core/template-engine/__tests__/utils/layoutTestUtils';
import overlay from '../../../extensions/cookie_banner.json';
import ko from '../../../lang/ko.json';
import en from '../../../lang/en.json';

let harness: ReturnType<typeof createLayoutTest> | undefined;
afterEach(() => harness?.cleanup());
const categories = [
    {
        key: 'necessary',
        required: true,
        label: { ko: '필수 쿠키', en: 'Strictly Necessary' },
        description: { ko: '필수 쿠키 설명', en: 'Strictly necessary cookie description' },
    },
    {
        key: 'functional',
        required: false,
        label: { ko: '기능 쿠키', en: 'Functional' },
        description: { ko: '기능 쿠키 설명', en: 'Functional cookie description' },
    },
];
async function renderBanner(optional: boolean, locale = 'ko', translations = ko) {
    const registry = createMockComponentRegistryWithBasics();
    harness = createLayoutTest({ components: overlay.components as any }, {
        componentRegistry: registry as any,
        translations: { 'glitter-gdpr': translations }, locale,
        initialState: { _global: { gdprPreferencesOpen: true } },
        initialData: {
            $locale: locale,
            gdprPublicSettings: { data: { banner_enabled: true, enforcement_enabled: true, has_optional_categories: optional, cookie_categories: optional ? categories : categories.slice(0, 1) } },
            gdprMyConsent: { data: { has_consented: false, needs_renewal: false } },
        },
    });
    await harness.render();
}
describe('public category availability rendering', () => {
    it('renders only necessary and functional choices from the public catalog', async () => {
        await renderBanner(true);
        expect(screen.getByText('필수 쿠키')).toBeTruthy();
        expect(screen.getByText('기능 쿠키')).toBeTruthy();
        expect(screen.queryByText('분석 쿠키')).toBeNull();
        expect(screen.queryByText('마케팅 쿠키')).toBeNull();
        const switches = screen.getAllByRole('switch');
        expect(switches).toHaveLength(2);
        expect(switches[0].getAttribute('aria-disabled')).toBe('true');
        expect(switches[1].getAttribute('aria-disabled')).toBe('false');
    });
    it('renders no misleading choice controls with zero optional categories', async () => {
        await renderBanner(false);
        expect(screen.queryAllByRole('switch')).toHaveLength(0);
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it.each([
        ['ko', ko, '선택됨', '선택 안 함'],
        ['en', en, 'Selected', 'Not selected'],
    ] as const)('%s preferences panel resolves selected-state labels and toggles them', async (locale, translations, selectedLabel, notSelectedLabel) => {
        await renderBanner(true, locale, translations);

        expect(screen.queryByText('glitter-gdpr.banner.category_selected')).toBeNull();
        expect(screen.queryByText('glitter-gdpr.banner.category_not_selected')).toBeNull();
        expect(screen.queryByText('glitter-gdpr.banner.category_required_badge')).toBeNull();
        expect(screen.queryByText('glitter-gdpr.banner.save')).toBeNull();
        expect(screen.getByText(locale === 'ko' ? '필수' : 'Required')).toBeTruthy();
        expect(screen.getAllByText(selectedLabel).length).toBe(1);
        expect(screen.getByText(notSelectedLabel)).toBeTruthy();

        const categoryLabels = locale === 'ko'
            ? ['필수 쿠키', '기능 쿠키']
            : ['Strictly Necessary', 'Functional'];
        const leakedCategoryLabels = locale === 'ko'
            ? ['Strictly Necessary', 'Functional']
            : ['필수 쿠키', '기능 쿠키'];
        for (const label of categoryLabels) expect(screen.getByText(label)).toBeTruthy();
        for (const label of leakedCategoryLabels) expect(screen.queryByText(label)).toBeNull();

        expect(screen.getByText(locale === 'ko' ? '필수 쿠키 설명' : 'Strictly necessary cookie description')).toBeTruthy();
        expect(screen.getByText(locale === 'ko' ? '기능 쿠키 설명' : 'Functional cookie description')).toBeTruthy();

        const selectedSwitch = screen.getAllByRole('switch')[0];
        expect(selectedSwitch.className).toContain('gdpr-consent-state');
        expect(selectedSwitch.className).toContain('gdpr-consent-state-selected');
        expect(selectedSwitch.className).not.toContain('bg-blue-');
        expect(selectedSwitch.className).not.toContain('bg-gray-800');

        const notSelectedSwitch = screen.getAllByRole('switch')[1];
        expect(notSelectedSwitch.className).toContain('gdpr-consent-state');
        expect(notSelectedSwitch.className).toContain('gdpr-consent-state-not-selected');
        expect(notSelectedSwitch.className).not.toContain('bg-blue-');

        const saveButton = screen.getByRole('button', { name: locale === 'ko' ? '선택 저장' : 'Save Selection' });
        expect(saveButton.className).toContain('gdpr-consent-neutral-action');
        expect(saveButton.className).not.toContain('bg-blue-');
        expect(saveButton.className).not.toContain('bg-gray-800');

        const optionalSwitch = notSelectedSwitch;
        fireEvent.click(optionalSwitch);
        await harness?.rerender();

        await waitFor(() => {
            expect(screen.getAllByText(selectedLabel).length).toBe(2);
            expect(screen.queryByText(notSelectedLabel)).toBeNull();
        });
    });
});
