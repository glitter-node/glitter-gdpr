import { afterEach, describe, expect, it } from 'vitest';
import { createConsentRuntime } from '../consentRuntime';
import { installPreblocker, uninstallPreblocker, restorePreblockedCategory } from '../preblocker';
import overlay from '../../extensions/cookie_banner.json';
import admin from '../../layouts/admin/plugin_settings.json';

const walk = (value: any): any[] => value && typeof value === 'object'
    ? [value, ...Object.values(value).flatMap(walk)] : [];
afterEach(() => uninstallPreblocker());
describe('category availability', () => {
    it('keeps four denied-by-default keys even before status arrives', () => {
        expect(createConsentRuntime().getSnapshot().categories).toEqual({ necessary: true, functional: false, analytics: false, marketing: false });
    });
    it('keeps disabled resources blocked after accept-all of enabled choices', async () => {
        const runtime = createConsentRuntime(async () => ({ categories: { necessary: true, functional: true, analytics: false, marketing: false }, needs_renewal: false, current_policy_version: '2' }));
        const snapshot = await runtime.refresh();
        installPreblocker({ blockedDomains: { analytics: ['analytics.example.com'], marketing: ['marketing.example.com'] }, consent: snapshot.categories });
        for (const category of ['analytics', 'marketing']) {
            const script = document.createElement('script');
            script.src = `https://${category}.example.com/tracker.js`;
            expect(script.getAttribute('src')).toBeNull();
            restorePreblockedCategory(category);
            expect(script.getAttribute('src')).toBeNull();
        }
    });
    it('never exposes old grants while renewal is required', async () => {
        const runtime = createConsentRuntime(async () => ({ categories: { necessary: true, analytics: true }, needs_renewal: true, current_policy_version: '2' }));
        expect((await runtime.refresh()).categories.analytics).toBe(false);
    });
    it('suppresses choice UI when no optional categories exist', () => {
        const banner = walk(overlay).find(n => n.id === 'gdpr_cookie_banner');
        expect(banner.if).toContain('has_optional_categories');
    });
    it('uses the supported Toggle with a flat field name for each optional category', () => {
        const toggle = walk(admin).find(n => n.name === 'Toggle' && n.props?.name === '{{category.key}}_enabled');
        expect(toggle).toBeTruthy();
        expect(toggle.if).toContain('necessary');
    });
});
