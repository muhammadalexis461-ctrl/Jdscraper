import { EventEmitter } from 'events';
import { MemoryJobQueue, Job } from '../queue';
import { ExtractionEngine } from '../extraction/engine';
import { StorageManager } from '../storage';
import { MetricsCollector } from '../metrics';
import { CheckpointManager } from '../checkpoint';
import { ProductDiscovery } from '../discovery';
import { ScrapedRecord } from '../types';
import { config } from '../config';
import { logger } from '../logging';
import { sleep } from '../utils/helpers';

export class WorkerPool extends EventEmitter {
  private queue: MemoryJobQueue;
  private engine: ExtractionEngine;
  private storage: StorageManager;
  private metrics: MetricsCollector;
  private checkpoint: CheckpointManager;
  private discovery: ProductDiscovery;
  private workers: Promise<void>[] = [];
  private isRunning = false;
  private shutdownRequested = false;

  constructor(
    queue: MemoryJobQueue,
    engine: ExtractionEngine,
    storage: StorageManager,
    metrics: MetricsCollector,
    checkpoint: CheckpointManager,
    discovery: ProductDiscovery
  ) {
    super();
    this.queue = queue;
    this.engine = engine;
    this.storage = storage;
    this.metrics = metrics;
    this.checkpoint = checkpoint;
    this.discovery = discovery;
  }

  async start(seedSkuIds?: string[]): Promise<void> {
    this.isRunning = true;
    await this.storage.initialize();

    if (seedSkuIds && seedSkuIds.length > 0) {
      this.queue.enqueue(seedSkuIds.map(id => ({
        skuId: id,
        sourceUrl: `https://item.jd.com/${id}.html`,
        discoveredAt: new Date().toISOString(),
      })));
      this.metrics.incrementDiscovered(seedSkuIds.length);
    }

    this.runDiscoveryWorker();

    const workerCount = config.concurrency;
    this.metrics.setActiveWorkers(workerCount);
    
    for (let i = 0; i < workerCount; i++) {
      this.workers.push(this.runWorker(i));
    }

    this.runMetricsReporter();
    this.runCheckpointSaver();

    await Promise.all(this.workers);
  }

  private async runWorker(id: number): Promise<void> {
    logger.info({ workerId: id }, 'Worker started');

    while (this.isRunning && !this.shutdownRequested) {
      const job = this.queue.dequeue();
      if (!job) {
        await sleep(1000);
        continue;
      }

      this.metrics.incrementProcessed();
      const startTime = Date.now();

      try {
        const record = await this.engine.extract(job.skuId, true);
        
        if (record) {
          await this.storage.store(record);
          this.metrics.incrementSuccessful();
          this.metrics.recordLatency(record.latencyMs);
          this.metrics.recordHttpStatus(record.requestStatus);
          this.metrics.incrementRetries(record.retryCount);
          this.emit('record', record);
          this.queue.complete(job);
        } else {
          this.metrics.incrementFailed();
          const shouldRetry = this.queue.fail(job, config.maxRetries);
          if (!shouldRetry) {
            logger.error({ skuId: job.skuId }, 'Job permanently failed');
          }
        }
      } catch (err) {
        this.metrics.incrementFailed();
        logger.error({ skuId: job.skuId, err }, 'Worker error');
        this.queue.fail(job, config.maxRetries);
      }

      const avgLatency = this.metrics.getSnapshot().averageLatencyMs;
      const adaptiveDelay = Math.max(500, avgLatency * 0.5);
      await sleep(adaptiveDelay / config.concurrency);
    }

    logger.info({ workerId: id }, 'Worker stopped');
  }

  private async runDiscoveryWorker(): Promise<void> {
    while (this.isRunning && !this.shutdownRequested) {
      try {
        const categories = this.discovery.getCategoryList();
        for (const cat of categories) {
          if (this.shutdownRequested) break;
          const products = await this.discovery.discoverFromCategory(cat, 1);
          this.queue.enqueue(products, 3);
          this.metrics.incrementDiscovered(products.length);
          await sleep(5000);
        }
      } catch (err) {
        logger.error({ err }, 'Discovery error');
      }
      await sleep(30000);
    }
  }

  private async runMetricsReporter(): Promise<void> {
    while (this.isRunning && !this.shutdownRequested) {
      console.log(this.metrics.formatConsole());
      await sleep(10000);
    }
  }

  private async runCheckpointSaver(): Promise<void> {
    while (this.isRunning && !this.shutdownRequested) {
      await sleep(config.checkpointInterval * 1000);
      const s = this.metrics.getSnapshot();
      this.checkpoint.save({
        jobId: `jd-scraper-${Date.now()}`,
        discovered: s.totalDiscovered,
        processed: s.totalProcessed,
        successful: s.totalSuccessful,
        failed: s.totalFailed,
        duplicates: s.totalDuplicates,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async stop(): Promise<void> {
    logger.info('Shutdown requested');
    this.shutdownRequested = true;
    this.isRunning = false;
    
    await Promise.race([
      Promise.all(this.workers),
      sleep(30000),
    ]);

    await this.engine.shutdown();
    await this.storage.flush();
    
    const s = this.metrics.getSnapshot();
    this.checkpoint.save({
      jobId: `jd-scraper-final-${Date.now()}`,
      discovered: s.totalDiscovered,
      processed: s.totalProcessed,
      successful: s.totalSuccessful,
      failed: s.totalFailed,
      duplicates: s.totalDuplicates,
      timestamp: new Date().toISOString(),
    });

    logger.info('Shutdown complete');
  }
}
