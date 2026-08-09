#!/usr/bin/env node
import { Command } from 'commander';
import { WorkerPool } from '../workers';
import { MemoryJobQueue } from '../queue';
import { ExtractionEngine } from '../extraction/engine';
import { StorageManager } from '../storage';
import { MetricsCollector } from '../metrics';
import { CheckpointManager } from '../checkpoint';
import { ProductDiscovery } from '../discovery';
import { logger } from '../logging';
import { config } from '../config';

const program = new Command();

program
  .name('jd-scraper')
  .description('JD.com WAREBUSINESS production scraper')
  .version('1.0.0');

program
  .command('scrape')
  .description('Start scraping JD.com products')
  .option('-s, --skus <skus...>', 'Seed SKU IDs')
  .option('-c, --concurrency <n>', 'Worker concurrency', String(config.concurrency))
  .option('-r, --rate <n>', 'Requests per second', String(config.requestRate))
  .option('-o, --output <dir>', 'Output directory', './output')
  .action(async (options) => {
    const queue = new MemoryJobQueue();
    const engine = new ExtractionEngine();
    const storage = new StorageManager(options.output);
    const metrics = new MetricsCollector();
    const checkpoint = new CheckpointManager();
    const discovery = new ProductDiscovery();

    const pool = new WorkerPool(queue, engine, storage, metrics, checkpoint, discovery);

    const shutdown = async () => {
      await pool.stop();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
      await pool.start(options.skus);
    } catch (err) {
      logger.fatal({ err }, 'Scraper crashed');
      process.exit(1);
    }
  });

program
  .command('resume')
  .description('Resume from last checkpoint')
  .option('-o, --output <dir>', 'Output directory', './output')
  .action(async (options) => {
    const checkpoint = new CheckpointManager();
    const last = checkpoint.load();
    
    if (!last) {
      console.error('No checkpoint found');
      process.exit(1);
    }

    console.log(`Resuming from checkpoint: ${last.timestamp}`);
    console.log(`Previously: ${last.successful} successful, ${last.failed} failed`);

    const queue = new MemoryJobQueue();
    const engine = new ExtractionEngine();
    const storage = new StorageManager(options.output);
    const metrics = new MetricsCollector();
    const discovery = new ProductDiscovery();

    const pool = new WorkerPool(queue, engine, storage, metrics, checkpoint, discovery);
    
    process.on('SIGINT', async () => { await pool.stop(); process.exit(0); });
    process.on('SIGTERM', async () => { await pool.stop(); process.exit(0); });

    await pool.start();
  });

program.parse();
