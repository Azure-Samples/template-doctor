import { Request, Response, NextFunction } from "express";

/**
 * EasyAuth Authentication Middleware
 * 
 * Azure Container Apps EasyAuth injects authentication headers when enabled.
 * This middleware validates those headers to ensure the user is authenticated.
 * 
 * EasyAuth Headers:
 * - X-MS-CLIENT-PRINCIPAL: Base64-encoded JSON with user info
 * - X-MS-CLIENT-PRINCIPAL-ID: User ID
 * - X-MS-CLIENT-PRINCIPAL-NAME: Username
 * - X-MS-CLIENT-PRINCIPAL-IDP: Identity provider (github)
 * 
 * In local development (without EasyAuth), this middleware allows requests through
 * to maintain compatibility with the existing OAuth flow.
 */

interface EasyAuthPrincipal {
    auth_typ?: string;
    claims?: Array<{ typ: string; val: string }>;
    name_typ?: string;
    role_typ?: string;
    userId?: string;
    userDetails?: string;
    userRoles?: string[];
}

export interface AuthenticatedRequest extends Request {
    easyAuth?: {
        isAuthenticated: boolean;
        username?: string;
        userId?: string;
        provider?: string;
        principal?: EasyAuthPrincipal;
    };
}

/**
 * Parse EasyAuth principal from request headers
 */
function parseEasyAuthPrincipal(req: Request): EasyAuthPrincipal | null {
    const principalHeader = req.headers["x-ms-client-principal"] as string;
    if (!principalHeader) {
        return null;
    }

    try {
        const principalJson = Buffer.from(principalHeader, "base64").toString(
            "utf-8",
        );
        return JSON.parse(principalJson);
    } catch (error) {
        console.error("Failed to parse EasyAuth principal:", error);
        return null;
    }
}

/**
 * Extract username from EasyAuth claims
 */
function getUsernameFromClaims(principal: EasyAuthPrincipal): string | undefined {
    if (!principal.claims) {
        return undefined;
    }

    // Try to find username in claims (GitHub typically uses 'preferred_username' or 'login')
    const usernameClaim = principal.claims.find(
        (claim) =>
            claim.typ === "preferred_username" ||
            claim.typ === "login" ||
            claim.typ === "name",
    );

    return usernameClaim?.val || principal.userDetails;
}

/**
 * Middleware to extract and validate EasyAuth information
 * This middleware DOES NOT enforce authentication - it only extracts the info
 * Use requireEasyAuth middleware to enforce authentication
 */
export function easyAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const authReq = req as AuthenticatedRequest;

    // Check for EasyAuth headers
    const principalId = req.headers["x-ms-client-principal-id"] as string;
    const principalName = req.headers["x-ms-client-principal-name"] as string;
    const principalIdp = req.headers["x-ms-client-principal-idp"] as string;

    if (!principalId && !principalName) {
        // No EasyAuth headers present - not running in Azure Container Apps with EasyAuth
        // or user is not authenticated. Allow request to continue.
        authReq.easyAuth = {
            isAuthenticated: false,
        };
        next();
        return;
    }

    // Parse the full principal object
    const principal = parseEasyAuthPrincipal(req);
    const username = principalName || getUsernameFromClaims(principal!);

    authReq.easyAuth = {
        isAuthenticated: true,
        username,
        userId: principalId,
        provider: principalIdp,
        principal: principal || undefined,
    };

    next();
}

/**
 * Middleware to require EasyAuth authentication
 * Returns 401 if user is not authenticated via EasyAuth
 * 
 * Note: In production with EasyAuth's globalValidation enabled, 
 * unauthenticated requests should be redirected to login before reaching the app.
 * This middleware is a safety check for API endpoints.
 */
export function requireEasyAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const authReq = req as AuthenticatedRequest;

    // If EasyAuth middleware hasn't run, run it first
    if (!authReq.easyAuth) {
        easyAuthMiddleware(req, res, () => {
            if (!authReq.easyAuth?.isAuthenticated) {
                res.status(401).json({
                    error: "Authentication required",
                    message:
                        "You must be authenticated to access this endpoint",
                });
                return;
            }
            next();
        });
        return;
    }

    if (!authReq.easyAuth.isAuthenticated) {
        res.status(401).json({
            error: "Authentication required",
            message: "You must be authenticated to access this endpoint",
        });
        return;
    }

    next();
}

/**
 * Optional middleware to check if user is in allowed users list
 * Used for admin-only endpoints like /setup
 */
export function requireAllowedUser(allowedUsersEnvVar: string = "SETUP_ALLOWED_USERS") {
    return (req: Request, res: Response, next: NextFunction): void => {
        const authReq = req as AuthenticatedRequest;

        if (!authReq.easyAuth?.isAuthenticated) {
            res.status(401).json({
                error: "Authentication required",
                message: "You must be authenticated to access this endpoint",
            });
            return;
        }

        const allowedUsers = process.env[allowedUsersEnvVar];
        if (!allowedUsers) {
            res.status(500).json({
                error: "Configuration error",
                message: `${allowedUsersEnvVar} not configured`,
            });
            return;
        }

        const allowedUsersList = allowedUsers
            .split(",")
            .map((u) => u.trim())
            .filter((u) => u.length > 0);

        const username = authReq.easyAuth.username;
        if (!username || !allowedUsersList.includes(username)) {
            res.status(403).json({
                error: "Access denied",
                message: `User ${username || "unknown"} is not authorized to access this endpoint`,
            });
            return;
        }

        next();
    };
}
