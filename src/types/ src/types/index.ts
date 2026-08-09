export interface ProductSku {
  skuId: string;
  sourceUrl: string;
  discoveredAt: string;
}

export interface WareBusinessResponse {
  skuId?: string;
  shopInfo?: {
    shop?: {
      shopId?: string;
      shopName?: string;
      shopUrl?: string;
    };
    venderId?: string;
  };
  stockInfo?: {
    isStock?: boolean;
    stockCount?: number;
    stockState?: number;
    areaStock?: boolean;
  };
  price?: {
    p?: string;
    op?: string;
    m?: string;
    id?: string;
  };
  YuShouInfo?: Record<string, unknown>;
  miaoshaInfo?: Record<string, unknown>;
  brandInfo?: {
    name?: string;
    id?: string;
  };
  categoryInfo?: Record<string, unknown>;
  wareInfo?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ScrapedRecord {
  id: string;
  skuId: string;
  sourceUrl: string;
  timestamp: string;
  extractionMethod: 'direct-api' | 'browser-intercept' | 'browser-fallback';
  requestStatus: number;
  latencyMs: number;
  rawResponse: WareBusinessResponse;
  normalized: NormalizedProduct;
  proxyUsed?: string;
  sessionId?: string;
  retryCount: number;
}

export interface NormalizedProduct {
  skuId: string;
  title?: string;
  brand?: string;
  category?: string;
  price?: number;
  originalPrice?: number;
  currency: string;
  stockStatus?: string;
  shopId?: string;
  shopName?: string;
  isJdSelfRun?: boolean;
  imageUrl?: string;
  productUrl: string;
  scrapedAt: string;
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
  outputFormat: 'jsonl' | 'json' | 'csv';
  databaseUrl: string;
  checkpointInterval: number;
  baseUrl: string;
  areaId: string;
  userAgent: string;
  redisUrl?: string;
  queueName: string;
}

export interface Checkpoint {
  jobId: string;
  discovered: number;
  processed: number;
  successful: number;
  failed: number;
  duplicates: number;
  lastSkuId?: string;
  timestamp: string;
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
