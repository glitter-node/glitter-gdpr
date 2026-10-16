import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pluginRoot = resolve(__dirname, '../../..');

describe('public consent banner stylesheet contract', () => {
    it('ships the layout utilities in the plugin CSS bundle', () => {
        const layout = readFileSync(
            resolve(pluginRoot, 'resources/extensions/cookie_banner.json'),
            'utf8',
        );
        const sourceCss = readFileSync(resolve(pluginRoot, 'resources/css/banner.css'), 'utf8');
        const builtCss = readFileSync(resolve(pluginRoot, 'dist/css/plugin.css'), 'utf8');

        for (const className of [
            'fixed',
            'z-50',
            'bottom-4',
            'bg-white',
            'shadow-lg',
            'border-gray-200',
            'rounded-lg',
            'justify-end',
            'text-sm',
            'font-semibold',
            'text-gray-900',
            'w-4',
            'h-4',
            'rounded-full',
            'bg-red-100',
            'dark:bg-red-900/40',
            'text-red-600',
            'dark:text-red-300',
            'leading-none',
            'gdpr-consent-action',
        ]) {
            expect(layout).toContain(className);
            const cssSelector = className.replaceAll(':', '\\:').replaceAll('/', '\\/');
            expect(builtCss).toContain(`.${cssSelector}`);
        }

        expect(sourceCss).toContain('.gdpr-consent-action');
        expect(sourceCss).toContain('no-underline');
        expect(sourceCss).toContain('hover:no-underline');
        expect(sourceCss).toContain('focus:no-underline');
        expect(builtCss).toContain('.gdpr-consent-action{');
        expect(builtCss).toContain('text-decoration-line:none');

        for (const selector of [
            '.gdpr-consent-state-selected',
            '.gdpr-consent-state-not-selected',
            '.gdpr-consent-neutral-action',
        ]) {
            expect(sourceCss).toContain(selector);
        }
        expect(sourceCss).toContain('focus-visible:no-underline');
        expect(builtCss).toContain('.gdpr-consent-state-selected');
        expect(builtCss).toContain('.gdpr-consent-state-not-selected');
        expect(builtCss).toContain('.gdpr-consent-neutral-action');

        // The policy link keeps its own link affordance and is not a consent action.
        expect(layout).toContain('$t:glitter-gdpr.banner.policy_link');
        expect(layout).toContain('hover:underline');
    });
});
