// Lightweight in-memory mapping for runId -> GitHub run details.
// This is process-local and non-persistent; intended to smooth UX without external storage.

const store = new Map();

function set(runId, value) {
  if (!runId) return;
  const now = new Date().toISOString();
  const existing = store.get(runId) || {};
  store.set(runId, { ...existing, ...value, updatedAt: now, createdAt: existing.createdAt || now });
}

function get(runId) {
  return store.get(runId) || null;
}

function del(runId) {
  store.delete(runId);
}

function all() {
  return Array.from(store.entries()).map(([k, v]) => ({ runId: k, ...v }));
}

module.exports = { set, get, del, all };
