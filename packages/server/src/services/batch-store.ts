/** Simple in-memory batch store; non-persistent and process-local. */
export type BatchItem = { repo: string; status: 'pending' | 'in-progress' | 'done' | 'error' | 'cancelled'; error?: string; resultId?: string };
export interface BatchRecord { batchId: string; created: string; mode?: string; items: BatchItem[]; }

const store: Record<string, BatchRecord> = {};

export function createBatch(repos: string[], mode?: string): BatchRecord {
  const batchId = 'b_' + crypto.randomUUID();
  const rec: BatchRecord = { batchId, created: new Date().toISOString(), mode, items: repos.map(r => ({ repo: r, status: 'pending' })) };
  store[batchId] = rec;
  return rec;
}

export function getBatch(id: string): BatchRecord | undefined { return store[id]; }

export function listBatches(): BatchRecord[] { return Object.values(store); }

export async function simulateBatchProgress(batch: BatchRecord, { delayMs = 200 } = {}) {
  for (const item of batch.items) {
    if (item.status !== 'pending') continue;
    item.status = 'in-progress';
    await wait(delayMs);
    item.status = 'done';
    item.resultId = 'r_' + Math.random().toString(36).slice(2,10);
  }
}

function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }
