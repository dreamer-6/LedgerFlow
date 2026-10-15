"use strict";
/**
 * LedgerFlow Production Security — SEC-010
 * High-Performance Sliding Window Rate Limiter
 *
 * Implements dual-key throttling:
 *   1. Client IP address
 *   2. Target account identifier (normalized email / username)
 *
 * Features:
 *   - Zero external dependencies.
 *   - Standard HTTP 429 Too Many Requests response.
 *   - Standard RFC headers: Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
 *   - Automatic success-reset: Valid credentials clear the failure window for legitimate users.
 *   - Automatic memory pruning: Expired timestamps are cleaned up periodically.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientIp = getClientIp;
exports.getLoginIdentifier = getLoginIdentifier;
exports.resetRateLimits = resetRateLimits;
exports.recordLoginSuccess = recordLoginSuccess;
exports.recordLoginFailure = recordLoginFailure;
exports.createLoginRateLimiter = createLoginRateLimiter;
// In-memory buckets
const ipBuckets = new Map();
const accountBuckets = new Map();
// Periodic cleanup every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();
function pruneExpiredBuckets(windowMs) {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS)
        return;
    lastCleanup = now;
    const threshold = now - windowMs;
    for (const [key, record] of ipBuckets.entries()) {
        record.timestamps = record.timestamps.filter(t => t > threshold);
        if (record.timestamps.length === 0)
            ipBuckets.delete(key);
    }
    for (const [key, record] of accountBuckets.entries()) {
        record.timestamps = record.timestamps.filter(t => t > threshold);
        if (record.timestamps.length === 0)
            accountBuckets.delete(key);
    }
}
/**
 * Extracts normalized client IP address from request headers or socket.
 */
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        const client = raw.split(',')[0].trim();
        if (client)
            return client;
    }
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
}
/**
 * Extracts normalized login identifier (email/username) from request body.
 */
function getLoginIdentifier(req) {
    const body = req.body || {};
    const id = body.emailOrUsername || body.email || body.username || '';
    return String(id).trim().toLowerCase();
}
/**
 * Resets all rate limit memory buckets (primarily used by test suites).
 */
function resetRateLimits() {
    ipBuckets.clear();
    accountBuckets.clear();
}
/**
 * Records a successful login event: immediately clears failed attempt history
 * for both the client IP and account identifier so legitimate users are never locked out.
 */
function recordLoginSuccess(req) {
    const ip = getClientIp(req);
    const identifier = getLoginIdentifier(req);
    if (ipBuckets.has(ip)) {
        ipBuckets.delete(ip);
    }
    if (identifier && accountBuckets.has(identifier)) {
        accountBuckets.delete(identifier);
    }
}
/**
 * Records a failed login attempt for the client IP and account identifier.
 */
function recordLoginFailure(req, windowMs = 15 * 60 * 1000) {
    const now = Date.now();
    const ip = getClientIp(req);
    const identifier = getLoginIdentifier(req);
    // Record IP attempt
    let ipRecord = ipBuckets.get(ip);
    if (!ipRecord) {
        ipRecord = { timestamps: [] };
        ipBuckets.set(ip, ipRecord);
    }
    ipRecord.timestamps.push(now);
    // Record Account identifier attempt (if supplied)
    if (identifier) {
        let accRecord = accountBuckets.get(identifier);
        if (!accRecord) {
            accRecord = { timestamps: [] };
            accountBuckets.set(identifier, accRecord);
        }
        accRecord.timestamps.push(now);
    }
    pruneExpiredBuckets(windowMs);
}
/**
 * Creates an Express rate-limiting middleware for login endpoints.
 */
function createLoginRateLimiter(options = {}) {
    const windowMs = options.windowMs ?? 15 * 60 * 1000; // 15 minutes default
    const maxIpAttempts = options.maxIpAttempts ?? 10; // 10 attempts per IP
    const maxAccountAttempts = options.maxAccountAttempts ?? 5; // 5 failed attempts per account
    return (req, res, next) => {
        // Optional bypass for test environment if explicitly configured
        if (process.env.DISABLE_RATE_LIMIT === 'true') {
            next();
            return;
        }
        const now = Date.now();
        const threshold = now - windowMs;
        const ip = getClientIp(req);
        const identifier = getLoginIdentifier(req);
        pruneExpiredBuckets(windowMs);
        // 1. Check IP attempts
        const ipRecord = ipBuckets.get(ip);
        const activeIpAttempts = ipRecord ? ipRecord.timestamps.filter(t => t > threshold) : [];
        // 2. Check Account attempts
        const accRecord = identifier ? accountBuckets.get(identifier) : undefined;
        const activeAccAttempts = accRecord ? accRecord.timestamps.filter(t => t > threshold) : [];
        const isIpBlocked = activeIpAttempts.length >= maxIpAttempts;
        const isAccBlocked = activeAccAttempts.length >= maxAccountAttempts;
        if (isIpBlocked || isAccBlocked) {
            // Find oldest active attempt timestamp to calculate retry-after accurately
            const relevantTimestamps = isIpBlocked ? activeIpAttempts : activeAccAttempts;
            const oldestTimestamp = Math.min(...relevantTimestamps);
            const resetTimeMs = oldestTimestamp + windowMs;
            const retryAfterSec = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));
            res.setHeader('Retry-After', retryAfterSec.toString());
            res.setHeader('X-RateLimit-Limit', (isIpBlocked ? maxIpAttempts : maxAccountAttempts).toString());
            res.setHeader('X-RateLimit-Remaining', '0');
            res.setHeader('X-RateLimit-Reset', Math.ceil(resetTimeMs / 1000).toString());
            const errorMessage = isAccBlocked
                ? `Too many failed login attempts for this account. Please try again in ${Math.ceil(retryAfterSec / 60)} minutes.`
                : `Too many login attempts from this network. Please try again in ${Math.ceil(retryAfterSec / 60)} minutes.`;
            res.status(429).json({
                error: errorMessage,
                retryAfter: retryAfterSec
            });
            return;
        }
        // Set informational rate limit headers for allowed requests
        const remaining = Math.max(0, maxIpAttempts - activeIpAttempts.length);
        res.setHeader('X-RateLimit-Limit', maxIpAttempts.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000).toString());
        next();
    };
}
