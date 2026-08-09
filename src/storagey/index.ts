import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { Writable } from 'stream';
import { ScrapedRecord, NormalizedProduct } from '../types';
import { logger } from '../logging';
import { config } from '../config';

export class StorageManager {
  private jsonlStream?: Writable;
  private recordCount = 0;
  private outputDir: string;

  constructor(outputDir = './output') {
    this.outputDir = outputDir;
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    if (config.outputFormat === 'jsonl' || config.outputFormat === 'json') {
      const path = `${this.outputDir}/records-${Date.now()}.jsonl`;
      this.jsonlStream = createWriteStream(path, { flags: 'a' });
      logger.info({ path }, 'JSONL output stream initialized');
    }
  }

  async store(record: ScrapedRecord): Promise<void> {
    this.recordCount++;

    if (this.jsonlStream) {
      this.jsonlStream.write(JSON.stringify({
        ...record,
        rawResponse: JSON.stringify(record.rawResponse),
      }) + '\n');
    }

    if (this.recordCount % config.checkpointInterval === 0) {
      logger.info({ recordCount: this.recordCount }, 'Checkpoint reached');
    }
  }

  async flush(): Promise<void> {
    this.jsonlStream?.end();
  }

  getRecordCount(): number {
    return this.recordCount;
  }
}
