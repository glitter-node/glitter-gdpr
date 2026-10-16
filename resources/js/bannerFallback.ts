import type { GdprConsentStatus, GdprPublicSettings } from './layouts';

export const CONSENT_BANNER_ID = 'gdpr_cookie_banner';
export const FALLBACK_ROOT_ATTRIBUTE = 'data-glitter-gdpr-root';
export const FALLBACK_ROOT_SELECTOR = `[${FALLBACK_ROOT_ATTRIBUTE}]`;

export interface ConsentBannerContext {
    settings: GdprPublicSettings;
    consent: GdprConsentStatus;
    globalState: Record<string, unknown>;
}

interface RootHandle {
    render: (node: unknown) => void;
    unmount: () => void;
}

interface ConsentBannerFallbackDependencies {
    document: Document;
    createRoot: (element: Element) => RootHandle;
    renderBanner: (context: ConsentBannerContext) => unknown;
}

export function shouldRenderConsentBanner(context: ConsentBannerContext): boolean {
    const currentUser = context.globalState.currentUser;
    const currentUserUuid = currentUser && typeof currentUser === 'object'
        ? (currentUser as { uuid?: unknown }).uuid
        : undefined;
    const identity = typeof currentUserUuid === 'string' && currentUserUuid !== ''
        ? currentUserUuid
        : 'guest';

    return context.settings.enforcement_enabled === true
        && context.settings.banner_enabled === true
        && context.settings.has_optional_categories !== false
        && context.consent.has_consented !== true
        && context.globalState.gdprBannerDismissedFor !== identity;
}

/**
 * Owns the final rendering fallback used only when the active layout did not
 * render the canonical GDPR banner contribution.
 */
export class ConsentBannerFallback {
    private mountElement: HTMLElement | null = null;
    private root: RootHandle | null = null;

    public constructor(private readonly dependencies: ConsentBannerFallbackDependencies) {}

    public hasLayoutBanner(): boolean {
        const banner = this.dependencies.document.getElementById(CONSENT_BANNER_ID);
        return banner !== null && !this.mountElement?.contains(banner);
    }

    public reconcile(context: ConsentBannerContext): 'layout' | 'fallback' | 'hidden' {
        if (this.hasLayoutBanner()) {
            this.unmount();
            return 'layout';
        }

        if (!shouldRenderConsentBanner(context)) {
            this.unmount();
            return 'hidden';
        }

        if (!this.mountElement?.isConnected) {
            this.mountElement = this.findOrCreateMountElement();
        }
        if (!this.root) {
            this.root = this.dependencies.createRoot(this.mountElement);
        }

        this.root.render(this.dependencies.renderBanner(context));
        return 'fallback';
    }

    public destroy(): void {
        this.unmount();
    }

    private findOrCreateMountElement(): HTMLElement {
        const mounts = Array.from(
            this.dependencies.document.querySelectorAll<HTMLElement>(FALLBACK_ROOT_SELECTOR),
        );
        const mount = mounts.shift() ?? this.dependencies.document.createElement('div');
        mount.setAttribute(FALLBACK_ROOT_ATTRIBUTE, '');
        for (const duplicate of mounts) duplicate.remove();

        if (!mount.isConnected) {
            this.dependencies.document.body.append(mount);
        }

        return mount;
    }

    private unmount(): void {
        this.root?.unmount();
        this.root = null;
        this.mountElement?.remove();
        this.mountElement = null;

        for (const staleMount of this.dependencies.document.querySelectorAll(FALLBACK_ROOT_SELECTOR)) {
            staleMount.remove();
        }
    }
}
