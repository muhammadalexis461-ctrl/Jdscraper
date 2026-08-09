import { WareBusinessResponse, NormalizedProduct } from '../types';
import { logger } from '../logging';

export class ProductNormalizer {
  normalize(skuId: string, raw: WareBusinessResponse): NormalizedProduct {
    const price = this.extractPrice(raw);
    const stockStatus = this.extractStockStatus(raw);
    const isJdSelfRun = this.detectJdSelfRun(raw);

    const normalized: NormalizedProduct = {
      skuId,
      title: this.extractTitle(raw),
      brand: raw.brandInfo?.name,
      category: this.extractCategory(raw),
      price: price.current,
      originalPrice: price.original,
      currency: 'CNY',
      stockStatus,
      shopId: raw.shopInfo?.shop?.shopId,
      shopName: raw.shopInfo?.shop?.shopName,
      isJdSelfRun,
      imageUrl: this.extractImage(raw),
      productUrl: `https://item.jd.com/${skuId}.html`,
      scrapedAt: new Date().toISOString(),
    };

    logger.debug({ skuId, normalized }, 'Normalized product');
    return normalized;
  }

  private extractPrice(raw: WareBusinessResponse): { current?: number; original?: number } {
    const p = parseFloat(raw.price?.p || '0');
    const op = parseFloat(raw.price?.op || '0');
    const m = parseFloat(raw.price?.m || '0');
    
    return {
      current: p > 0 ? p : (op > 0 ? op : undefined),
      original: op > 0 ? op : (m > 0 ? m : undefined),
    };
  }

  private extractStockStatus(raw: WareBusinessResponse): string | undefined {
    if (!raw.stockInfo) return undefined;
    if (raw.stockInfo.isStock === false) return 'out_of_stock';
    if (raw.stockInfo.stockState === 34) return 'in_stock';
    if (raw.stockInfo.stockState === 36) return 'pre_sale';
    return raw.stockInfo.isStock ? 'in_stock' : 'unknown';
  }

  private detectJdSelfRun(raw: WareBusinessResponse): boolean | undefined {
    const shopId = raw.shopInfo?.shop?.shopId;
    const venderId = raw.shopInfo?.venderId;
    if (shopId === '1000000127' || venderId === '8888') return true;
    return undefined;
  }

  private extractTitle(raw: WareBusinessResponse): string | undefined {
    return (raw.wareInfo as any)?.title || (raw as any)?.name;
  }

  private extractCategory(raw: WareBusinessResponse): string | undefined {
    const cat = raw.categoryInfo as any;
    if (!cat) return undefined;
    return [cat.cat1Name, cat.cat2Name, cat.cat3Name].filter(Boolean).join(' > ');
  }

  private extractImage(raw: WareBusinessResponse): string | undefined {
    const ware = raw.wareInfo as any;
    return ware?.imageUrl || ware?.mainImage;
  }
}
