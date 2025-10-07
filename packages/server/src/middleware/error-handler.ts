import { Request, Response, NextFunction } from "express";

/**
 * Error Handler Middleware
 * 
 * Centralized error handling for the Express application.
 * Ensures consistent error responses across all endpoints.
 */

export interface ApiError extends Error {
    statusCode?: number;
    requestId?: string;
}

export function errorHandler(
    err: ApiError,
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    // Log the error
    console.error("Error:", {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });

    // Determine status code
    const statusCode = err.statusCode || 500;

    // Send error response
    res.status(statusCode).json({
        error: err.message || "Internal server error",
        requestId: err.requestId,
        path: req.path,
    });
}

/**
 * Not Found Handler
 * 
 * Handles requests to non-existent API endpoints.
 */
export function notFoundHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    if (req.path.startsWith("/api")) {
        res.status(404).json({
            error: "API endpoint not found",
            path: req.path,
        });
    } else {
        next();
    }
}
