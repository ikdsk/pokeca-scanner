export class RearmTracker {
  private since: number | null = null;
  private absent = 0;
  constructor(private count: number, private ms: number) {}
  configure(count: number, ms: number): void { this.count = count; this.ms = ms; this.since = null; this.absent = 0; }
  observe(present: boolean, now: number): boolean {
    if (present) { this.since = null; this.absent = 0; return false; }
    this.since ??= now; this.absent++;
    return this.absent >= this.count && now - this.since >= this.ms;
  }
}
