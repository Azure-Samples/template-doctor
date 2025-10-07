import { Request, Response, NextFunction } from "express";

/**
 * CORS Middleware
 * 
 * Handles Cross-Origin Resource Sharing for the API.
 * In production with EasyAuth, CORS is typically handled by Azure,
 * but this provides compatibility for local development.
 */

const ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:4000",
    "http://localhost:8080",
    // Add production origins from environment variables
];

export function corsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const origin = req.headers.origin;

    // Check if origin is allowed
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }

    next();
}
