import type { HttpRequest, Context } from "@azure/functions";
import { loadEnv } from "./env";

export interface HandlerResult {
    status?: number;
    headers?: Record<string, string>;
    body?: any;
}

export type SimpleHandler = (
    req: HttpRequest,
    ctx: Context,
    requestId: string,
) => Promise<HandlerResult>;

// Azure Functions (Node) invokes exported handlers with signature (context, req).
// Our previous implementation accidentally reversed parameters leading to ctx.res never being set,
// which produced 200 responses with an empty body (Content-Length: 0). This fixes the order.
export function wrapHttp(
    handler: SimpleHandler,
): (ctx: Context, req: HttpRequest) => Promise<any> {
    return async (ctx, req) => {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const env = loadEnv();
        const origin =
            (req.headers && (req.headers["origin"] || req.headers["Origin"])) ||
            "";
        const allowAll = env.GITHUB_OAUTH_ALLOWED_ORIGINS.includes("*");
        // Prefer explicit requesting origin if allowed; else favor port 4000, then 5173, then first configured.
        let resolvedOrigin: string;
        if (allowAll) {
            resolvedOrigin = origin || "http://localhost:4000";
        } else if (
            origin &&
            env.GITHUB_OAUTH_ALLOWED_ORIGINS.includes(origin)
        ) {
            resolvedOrigin = origin;
        } else {
            const pref =
                env.GITHUB_OAUTH_ALLOWED_ORIGINS.find((o) =>
                    /:4000$/.test(o),
                ) ||
                env.GITHUB_OAUTH_ALLOWED_ORIGINS.find((o) =>
                    /:5173$/.test(o),
                ) ||
                env.GITHUB_OAUTH_ALLOWED_ORIGINS[0];
            resolvedOrigin = pref;
        }
        const baseHeaders: Record<string, string> = {
            "Access-Control-Allow-Origin": resolvedOrigin,
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers":
                "Content-Type, Authorization, X-Requested-With",
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json; charset=utf-8",
            Vary: "Origin",
        };
        if (req.method === "OPTIONS") {
            ctx.res = { status: 204, headers: baseHeaders } as any;
            return ctx.res; // return for backward compatibility with tests expecting a value
        }
        try {
            const result = await handler(req, ctx, requestId);
            const status = result.status ?? 200;
            const headers = { ...baseHeaders, ...(result.headers || {}) };
            // For HEAD requests avoid sending body even if handler produced one.
            if (req.method === "HEAD") {
                ctx.res = { status, headers } as any;
            } else {
                ctx.res = { status, headers, body: result.body } as any;
            }
            return ctx.res;
        } catch (err: any) {
            ctx.log.error("Unhandled HTTP error", {
                requestId,
                error: err?.message,
            });
            ctx.res = {
                status: 500,
                headers: baseHeaders,
                body: { error: "Internal Server Error", requestId },
            } as any;
            return ctx.res;
        }
    };
}
