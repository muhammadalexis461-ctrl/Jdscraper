import { MetricsSnapshot } from '../types';
import { estimateDailyRate } from '../utils/helpers';

export class MetricsCollector {
  private startTime = Date.now();
  private discovered = 0;
  private processed = 0;
  private successful = 0;
  private failed = 0;
  private duplicates = 0;
  private retries = 0;
  private latencies: number[] = [];
  private httpStatusDistribution: Map<number, number> = new Map();
  private activeWorkers = 0;
  private queueSize = 0;
  private storageSize = 0;

  incrementDiscovered(n = 1): void { this.discovered += n; }
  incrementProcessed(): void { this.processed++; }
  incrementSuccessful(): void { this.successful++; }
  incrementFailed(): void { this.failed++; }
  incrementDuplicates(): void { this.duplicates++; }
  incrementRetries(): void { this.retries++; }
  recordLatency(ms: number): void {
    this.latencies.push(ms);
    if (this.latencies.length > 10000) this.latencies.shift();
  }
  recordHttpStatus(status: number): void {
    this.httpStatusDistribution.set(status, (this.httpStatusDistribution.get(status) || 0) + 1);
  }
  setActiveWorkers(n: number): void { this.activeWorkers = n; }
  setQueueSize(n: number): void { this.queueSize = n; }
  setStorageSize(n: number): void { this.storageSize = n; }

  getSnapshot(): MetricsSnapshot {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const recordsPerSecond = uptimeSeconds > 0 ? this.processed / uptimeSeconds : 0;
    const recordsPerMinute = recordsPerSecond * 60;
    const avgLatency = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0;

    return {
      totalDiscovered: this.discovered,
      totalProcessed: this.processed,
      totalSuccessful: this.successful,
      totalFailed: this.failed,
      totalDuplicates: this.duplicates,
      recordsPerSecond: parseFloat(recordsPerSecond.toFixed(2)),
      recordsPerMinute: parseFloat(recordsPerMinute.toFixed(2)),
      estimatedPerDay: estimateDailyRate(recordsPerSecond),
      activeWorkers: this.activeWorkers,
      totalRetries: this.retries,
      httpStatusDistribution: Object.fromEntries(this.httpStatusDistribution),
      averageLatencyMs: Math.round(avgLatency),
      queueSize: this.queueSize,
      storageSize: this.storageSize,
      uptimeSeconds,
    };
  }

  formatConsole(): string {
    const s = this.getSnapshot();
    return `
SCRAPER STATUS
--------------
Discovered: ${s.totalDiscovered.toLocaleString()}
Processed:  ${s.totalProcessed.toLocaleString()}
Successful: ${s.totalSuccessful.toLocaleString()}
Failed:     ${s.totalFailed.toLocaleString()}
Duplicates: ${s.totalDuplicates.toLocaleString()}
Rate:       ${s.recordsPerSecond} records/sec
Est/day:    ${s.estimatedPerDay.toLocaleString()}
Workers:    ${s.activeWorkers}
Retries:    ${s.totalRetries}
AvgLatency: ${s.averageLatencyMs}ms
Queue:      ${s.queueSize}
Storage:    ${s.storageSize}
Uptime:     ${Math.floor(s.uptimeSeconds / 60)}m ${s.uptimeSeconds % 60}s
`;
  }
}
