export interface ProductSku {
  skuId: string;
  sourceUrl: string;
  discoveredAt: string;
}

export interface WareBusinessResponse {
  [key: string]: unknown;
}

export interface NormalizedProduct {
  skuId: string;
  productName?: string;
  price?: number;
  brand?: string;
  category?: string;
  availability?: boolean;
  productUrl?: string;
  scrapedAt?: string;
  title?: string;
}

export interface ScrapedRecord {
  id: string;
  skuId: string;
  sourceUrl: string;
  timestamp: string;
  extractionMethod: 'direct-api' | 'browser-intercept' | 'fallback';
  requestStatus: number;
  latencyMs: number;
  rawResponse: WareBusinessResponse;
  normalized: NormalizedProduct;
  proxyUsed?: string;
  retryCount: number;
}

export interface MetricsSnapshot {
  totalDiscovered: number;
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  totalDuplicates: number;
  recordsPerSecond: number;
  recordsPerMinute: number;
  estimatedPerDay: number;
  activeWorkers: number;
  totalRetries: number;
  httpStatusDistribution: Record<number, number>;
  averageLatencyMs: number;
  queueSize: number;
  storageSize: number;
  uptimeSeconds: number;
}

export interface Checkpoint {
  jobId: string;
  discovered: number;
  processed: number;
  successful: number;
  failed: number;
  duplicates: number;
  timestamp: string;
}

export interface ScraperConfig {
  concurrency: number;
  requestRate: number;
  maxRetries: number;
  requestTimeout: number;
  connectionTimeout: number;
  proxyPool: string[];
  sessionRotation: number;
  batchSize: number;
  outputFormat: 'json' | 'jsonl' | 'csv';
  databaseUrl: string;
  checkpointInterval: number;
  baseUrl: string;
  areaId: string;
  userAgent: string;
  redisUrl?: string;
  queueName: string;
}
