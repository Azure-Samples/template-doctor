// Temporary shim for legacy handlers still using readJson/getQuery helpers.
// Replace with shared http utilities (wrapHttp + explicit parsing) during full migration.
import type { HttpRequest } from "@azure/functions";

export async function readJson<T = any>(
    req: HttpRequest,
): Promise<T | undefined> {
    try {
        // Azure Functions HttpRequest in JS/TS provides a .json() convenience in newer versions; fall back to parsing body.
        const anyReq: any = req as any;
        if (typeof anyReq.json === "function") {
            return await anyReq.json();
        }
        const body = anyReq.body;
        if (!body) return undefined;
        if (typeof body === "object") return body as T;
        if (typeof body === "string") return JSON.parse(body);
        return undefined;
    } catch {
        return undefined;
    }
}

export function getQuery(req: HttpRequest, key: string): string | undefined {
    // Azure Functions v4 HttpRequest may expose query via req.query or url parsing; fallback to URL parsing.
    const anyReq: any = req as any;
    if (anyReq.query && typeof anyReq.query === "object") {
        const v = anyReq.query[key];
        if (typeof v === "string") return v;
    }
    try {
        const u = new URL(anyReq.url || "");
        return u.searchParams.get(key) || undefined;
    } catch {
        return undefined;
    }
}
