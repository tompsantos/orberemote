import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AuditRecord } from './types.js';

export class AuditLog {
  constructor(private readonly filePath: string) {}

  async write(record: Omit<AuditRecord, 'id' | 'timestamp'>): Promise<AuditRecord> {
    const full: AuditRecord = { id: randomUUID(), timestamp: new Date().toISOString(), ...record };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, JSON.stringify(full) + '\n', { encoding: 'utf8', mode: 0o600 });
    return full;
  }

  async tail(limit = 50): Promise<AuditRecord[]> {
    try {
      const text = await readFile(this.filePath, 'utf8');
      return text.trim().split('\n').filter(Boolean).slice(-limit).map(line => JSON.parse(line) as AuditRecord);
    } catch (error: any) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
  }
}
