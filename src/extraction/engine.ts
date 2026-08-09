import { DirectApiClient } from '../network/direct-api';
import { BrowserInterceptExtractor } from '../network/browser-intercept';
import { ResponseValidator } from '../validation/validator';
import { ProductNormalizer } from '../normalization/normalizer';
import { ScrapedRecord, WareBusinessResponse, NormalizedProduct } from '../types';
import { logger } from '../logging';
import { generateId, nowISO } from '../utils/helpers';
import { config } from '../config';

export class ExtractionEngine {
  private directApi: DirectApiClient;
  private browserExtractor?: BrowserInterceptExtractor;
  private validator: ResponseValidator;
  private normalizer: ProductNormalizer;

  constructor() {
    this.directApi = new DirectApiClient();
    this.validator = new ResponseValidator();
    this.normalizer = new ProductNormalizer();
  }

  async extract(skuId: string, attemptBrowser = false): Promise<ScrapedRecord | null> {
    const recordId = generateId();
    const startTime = Date.now();

    const directResult = await this.directApi.fetchWareBusiness(skuId);
    
    if (directResult.success && directResult.data) {
      const validation = this.validator.validateWareBusiness(directResult.data);
      if (validation.valid && validation.data) {
        const normalized = this.normalizer.normalize(skuId, validation.data);
        return {
          id: recordId,
          skuId,
          sourceUrl: `https://item.jd.com/${skuId}.html`,
          timestamp: nowISO(),
          extractionMethod: 'direct-api',
          requestStatus: directResult.statusCode || 200,
          latencyMs: directResult.latencyMs,
          rawResponse: validation.data,
          normalized,
          proxyUsed: directResult.proxyUsed,
          retryCount: directResult.retries,
        };
      }
    }

    if (attemptBrowser) {
      logger.info({ skuId }, 'Falling back to browser interception');
      try {
        if (!this.browserExtractor) {
          this.browserExtractor = new BrowserInterceptExtractor();
          await this.browserExtractor.initialize();
        }

        const browserData = await this.browserExtractor.extract(skuId);
        if (browserData) {
          const validation = this.validator.validateWareBusiness(browserData);
          if (validation.valid && validation.data) {
            const normalized = this.normalizer.normalize(skuId, validation.data);
            return {
              id: recordId,
              skuId,
              sourceUrl: `https://item.jd.com/${skuId}.html`,
              timestamp: nowISO(),
              extractionMethod: 'browser-intercept',
              requestStatus: 200,
              latencyMs: Date.now() - startTime,
              rawResponse: validation.data,
              normalized,
              retryCount: directResult.retries,
            };
          }
        }
      } catch (err) {
        logger.error({ skuId, err }, 'Browser extraction failed');
      }
    }

    logger.warn({ skuId, directError: directResult.error }, 'All extraction levels failed');
    return null;
  }

  async shutdown(): Promise<void> {
    await this.browserExtractor?.close();
  }
}
