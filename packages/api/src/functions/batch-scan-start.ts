import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';

interface BatchScanItem {
  repo: string;
  status: 'pending' | 'in-progress' | 'done' | 'error' | 'cancelled';
  error?: string;
  resultId?: string;
}

// In-memory store (replace with durable storage later)
const batches: Record<string, { items: BatchScanItem[]; created: string; mode?: string }> = {};

export async function batchScanStartHandler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const cors = baseCors();
  if (req.method === 'OPTIONS') return { status: 204, headers: cors };
  if (req.method !== 'POST') return { status: 405, headers: cors, jsonBody: { error: 'Method not allowed' } };

  let body: any;
  try { body = await req.json(); } catch { return { status: 400, headers: cors, jsonBody: { error: 'Invalid JSON body' } }; }
  const { repos, mode } = body || {};
  if (!Array.isArray(repos) || repos.length === 0) {
    return { status: 400, headers: cors, jsonBody: { error: 'repos[] required' } };
  }
  const sanitized = Array.from(new Set(repos.filter(r => typeof r === 'string' && r.includes('/')))).slice(0, 50);
  if (sanitized.length === 0) {
    return { status: 400, headers: cors, jsonBody: { error: 'No valid repo slugs provided' } };
  }
  const batchId = 'b_' + randomUUID();
  batches[batchId] = {
    created: new Date().toISOString(),
    mode,
    items: sanitized.map(r => ({ repo: r, status: 'pending' }))
  };
  // Kick off async simulation (placeholder). Real implementation would enqueue work.
  simulateAsync(batchId, ctx);
  return { status: 202, headers: cors, jsonBody: { batchId, acceptedCount: sanitized.length } };
}

export async function batchScanStatusHandler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const cors = baseCors();
  if (req.method === 'OPTIONS') return { status: 204, headers: cors };
  if (req.method !== 'GET') return { status: 405, headers: cors, jsonBody: { error: 'Method not allowed' } };
  const batchId = req.query.get('batchId');
  if (!batchId) return { status: 400, headers: cors, jsonBody: { error: 'batchId required' } };
  const batch = batches[batchId];
  if (!batch) return { status: 404, headers: cors, jsonBody: { error: 'Not found' } };
  const completed = batch.items.filter(i => i.status === 'done' || i.status === 'error' || i.status === 'cancelled').length;
  return { status: 200, headers: cors, jsonBody: { batchId, created: batch.created, mode: batch.mode, total: batch.items.length, completed, items: batch.items } };
}

function baseCors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

async function simulateAsync(batchId: string, ctx: InvocationContext) {
  const batch = batches[batchId];
  if (!batch) return;
  for (const item of batch.items) {
    item.status = 'in-progress';
    await delay(300); // simulate stagger
    // Pseudo success
    item.status = 'done';
    item.resultId = 'r_' + Math.random().toString(36).slice(2, 10);
  }
  ctx.log(`Batch ${batchId} simulation complete.`);
}

function delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }
