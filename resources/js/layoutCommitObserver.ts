type RequestFrame = (callback: FrameRequestCallback) => unknown;

/**
 * Watches one app root until its child-list mutations have settled for two
 * animation frames. A route transition can remove the previous layout and
 * insert the next one in separate commits, so the first mutation is not a
 * reliable render-complete signal.
 */
export class StableLayoutCommitObserver {
    private mutationVersion = 0;
    private settleScheduled = false;
    private observer: MutationObserver | null = null;

    public constructor(
        private readonly requestFrame: RequestFrame,
        private readonly onStable: () => void,
    ) {}

    public observe(root: Node, waitForMutation = false): void {
        this.disconnect();
        this.mutationVersion = 0;
        this.observer = new MutationObserver(() => {
            this.mutationVersion++;
            this.scheduleSettleCheck();
        });
        this.observer.observe(root, { childList: true, subtree: true });
        if (!waitForMutation) this.scheduleSettleCheck();
    }

    public disconnect(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.settleScheduled = false;
    }

    private scheduleSettleCheck(): void {
        if (this.settleScheduled) return;
        this.settleScheduled = true;

        this.requestFrame(() => {
            const firstFrameVersion = this.mutationVersion;
            this.requestFrame(() => {
                this.settleScheduled = false;
                if (firstFrameVersion !== this.mutationVersion) {
                    this.scheduleSettleCheck();
                    return;
                }

                this.disconnect();
                this.onStable();
            });
        });
    }
}
