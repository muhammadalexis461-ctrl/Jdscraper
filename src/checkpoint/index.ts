import { writeFileSync, readFileSync, existsSync } from 'fs';
import { Checkpoint } from '../types';
import { logger } from '../logging';

export class CheckpointManager {
  private path: string;

  constructor(path = './data/checkpoint.json') {
    this.path = path;
  }

  save(checkpoint: Checkpoint): void {
    try {
      writeFileSync(this.path, JSON.stringify(checkpoint, null, 2));
      logger.debug({ checkpoint }, 'Checkpoint saved');
    } catch (err) {
      logger.error({ err }, 'Failed to save checkpoint');
    }
  }

  load(): Checkpoint | null {
    if (!existsSync(this.path)) return null;
    try {
      const data = JSON.parse(readFileSync(this.path, 'utf-8'));
      logger.info({ checkpoint: data }, 'Checkpoint loaded');
      return data;
    } catch (err) {
      logger.error({ err }, 'Failed to load checkpoint');
      return null;
    }
  }
}
