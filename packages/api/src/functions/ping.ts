export async function pingHandler() {
  return {
    status: 200,
    jsonBody: { ok: true, ts: new Date().toISOString() }
  };
}
