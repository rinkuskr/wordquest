export class DailyRunCleanupCoordinator {
  private pendingDateKey: string | null = null;
  private completedDateKey: string | null = null;
  private inFlight: Promise<boolean> | null = null;

  constructor(private readonly clearForDate: (dateKey: string) => Promise<void>) {}

  get hasPending(): boolean {
    return this.pendingDateKey !== null;
  }

  markPending(dateKey: string): void {
    if (this.completedDateKey === dateKey || this.pendingDateKey === dateKey) return;
    this.pendingDateKey = dateKey;
  }

  retry(): Promise<boolean> {
    if (this.inFlight) return this.inFlight;
    const dateKey = this.pendingDateKey;
    if (!dateKey) return Promise.resolve(this.completedDateKey !== null);

    const attempt = this.clearForDate(dateKey).then(
      () => {
        if (this.pendingDateKey === dateKey) {
          this.pendingDateKey = null;
          this.completedDateKey = dateKey;
        }
        return true;
      },
      () => false,
    );
    this.inFlight = attempt.finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }
}

export interface DailyRunCleanupGame {
  dailyChallengeDate?: string;
}

export async function retryDailyRunCleanup(
  currentGame: DailyRunCleanupGame | null,
  hasPendingDailyRecord: boolean,
  cleanup: DailyRunCleanupCoordinator,
): Promise<boolean> {
  if (hasPendingDailyRecord) return false;
  if (currentGame?.dailyChallengeDate) {
    cleanup.markPending(currentGame.dailyChallengeDate);
  }
  return cleanup.retry();
}

export function cleanupCompletedDailyRun(
  dateKey: string,
  completedHistoryExists: boolean,
  cleanup: DailyRunCleanupCoordinator,
): Promise<boolean> {
  if (!completedHistoryExists) return Promise.resolve(false);
  cleanup.markPending(dateKey);
  return cleanup.retry();
}
