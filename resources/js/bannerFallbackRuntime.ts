import extensionDefinition from '../extensions/cookie_banner.json';
import {
    ConsentBannerFallback,
    type ConsentBannerContext,
} from './bannerFallback';
import {
    fetchConsentStatus,
    type GdprConsentStatus,
    type GdprPublicSettings,
} from './layouts';
import { StableLayoutCommitObserver } from './layoutCommitObserver';

interface G7CoreRuntime {
    renderComponentLayout?: (
        definitions: unknown[],
        context: Record<string, unknown>,
        keyPrefix?: string,
    ) => unknown;
}

interface TemplateRouter {
    on: (event: 'routeChange', listener: () => void) => void;
}

interface TemplateAppRuntime {
    getRouter?: () => TemplateRouter | null;
    getGlobalState?: () => Record<string, unknown>;
    onGlobalStateChange?: (listener: (state: Record<string, unknown>) => void) => void;
}

interface ReactDomRuntime {
    createRoot?: (element: Element) => {
        render: (node: unknown) => void;
        unmount: () => void;
    };
}

interface RuntimeWindow extends Window {
    G7Core?: G7CoreRuntime;
    ReactDOM?: ReactDomRuntime;
    __templateApp?: TemplateAppRuntime;
}

const bannerDefinitions = (
    extensionDefinition as { components?: unknown[] }
).components ?? [];

let controller: ConsentBannerFallback | null = null;
let settings: GdprPublicSettings | null = null;
let consent: GdprConsentStatus | null = null;
let stableCommitObserver: StableLayoutCommitObserver | null = null;
let runtimeRegistered = false;
let refreshSequence = 0;

function runtimeWindow(): RuntimeWindow {
    return window as RuntimeWindow;
}

function globalState(): Record<string, unknown> {
    return runtimeWindow().__templateApp?.getGlobalState?.() ?? {};
}

function reconcile(): void {
    if (!controller || !settings || !consent) return;
    controller.reconcile({ settings, consent, globalState: globalState() });
}

async function refreshAndReconcile(): Promise<void> {
    if (!controller || controller.hasLayoutBanner()) {
        controller?.destroy();
        return;
    }

    const sequence = ++refreshSequence;
    const refreshed = await fetchConsentStatus();
    if (sequence !== refreshSequence || !refreshed) return;
    consent = refreshed;
    reconcile();
}

function afterNextLayoutCommit(): void {
    if (!settings) return;
    stableCommitObserver?.disconnect();
    stableCommitObserver = null;

    // A route event can arrive while the previous layout is still mounted.
    // Clean any stale fallback immediately, but never mount one from this
    // transient state. The observer below waits for the next actual commit.
    if (controller?.hasLayoutBanner()) {
        controller.destroy();
    }

    const app = document.getElementById('app');
    if (!app) {
        requestAnimationFrame(() => afterNextLayoutCommit());
        return;
    }

    stableCommitObserver = new StableLayoutCommitObserver(
        requestAnimationFrame.bind(window),
        () => void refreshAndReconcile(),
    );
    // On SPA navigation, wait for a mutation. The old route can remain
    // stable for several frames while its data/layout request is pending.
    stableCommitObserver.observe(app, runtimeRegistered);
}

function tryRegisterRuntime(): void {
    if (runtimeRegistered) return;

    const runtime = runtimeWindow();
    const renderComponentLayout = runtime.G7Core?.renderComponentLayout;
    const createRoot = runtime.ReactDOM?.createRoot;
    const templateApp = runtime.__templateApp;
    const router = templateApp?.getRouter?.();
    if (!renderComponentLayout || !createRoot || !templateApp || !router) {
        setTimeout(tryRegisterRuntime, 100);
        return;
    }

    controller = new ConsentBannerFallback({
        document,
        createRoot: (element) => createRoot(element),
        renderBanner: (context: ConsentBannerContext) => renderComponentLayout(
            bannerDefinitions,
            {
                gdprPublicSettings: { data: context.settings },
                gdprMyConsent: { data: context.consent },
                _global: context.globalState,
            },
            'glitter-gdpr-fallback',
        ),
    });

    templateApp.onGlobalStateChange?.((state) => {
        if (!controller || !settings || !consent) return;
        controller.reconcile({ settings, consent, globalState: state });
    });
    router.on('routeChange', () => afterNextLayoutCommit());

    afterNextLayoutCommit();
    runtimeRegistered = true;
}

export function startConsentBannerFallback(publicSettings: GdprPublicSettings): void {
    settings = publicSettings;
    tryRegisterRuntime();
}

export function refreshConsentBannerFallback(): void {
    void refreshAndReconcile();
}

export function destroyConsentBannerFallback(): void {
    stableCommitObserver?.disconnect();
    stableCommitObserver = null;
    controller?.destroy();
    controller = null;
    settings = null;
    consent = null;
    refreshSequence++;
}
