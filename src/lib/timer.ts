// ============================================
// Doubt Game - Timer Utility
// Sprint 1: Phase timer management
// ============================================

/**
 * مؤقت بسيط يعمل بالـ setInterval
 * يرسل tick كل ثانية ويستدعي onComplete عند الانتهاء
 */
export class PhaseTimer {
  private interval: NodeJS.Timeout | null = null;
  private remaining: number = 0;
  private total: number = 0;

  constructor(
    private onTick: (remaining: number, total: number) => void,
    private onComplete: () => void
  ) {}

  /**
   * بدء المؤقت
   * @param durationSeconds المدة بالثواني
   */
  start(durationSeconds: number): void {
    this.stop(); // إيقاف أي مؤقت سابق

    this.total = durationSeconds;
    this.remaining = durationSeconds;

    // أول tick فوراً
    this.onTick(this.remaining, this.total);

    this.interval = setInterval(() => {
      this.remaining--;

      if (this.remaining <= 0) {
        this.stop();
        this.onTick(0, this.total);
        this.onComplete();
      } else {
        this.onTick(this.remaining, this.total);
      }
    }, 1000);
  }

  /**
   * إيقاف المؤقت
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * الوقت المتبقي
   */
  getRemaining(): number {
    return this.remaining;
  }

  /**
   * هل المؤقت يعمل؟
   */
  isRunning(): boolean {
    return this.interval !== null;
  }
}
