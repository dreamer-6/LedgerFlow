"use strict";
/**
 * Auth Middleware — DEPRECATED / COMPATIBILITY WRAPPER
 *
 * This module has been superseded by src/middleware/security.ts as part of TASK 001.
 * All security middleware functions are re-exported from security.ts for backward compatibility.
 * Direct hardcoded secrets and unmounted helpers have been removed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtSecret = exports.assertResourceOwnership = exports.authorize = exports.resolveCompanyContext = exports.authenticate = void 0;
var security_js_1 = require("./security.js");
Object.defineProperty(exports, "authenticate", { enumerable: true, get: function () { return security_js_1.authenticate; } });
Object.defineProperty(exports, "resolveCompanyContext", { enumerable: true, get: function () { return security_js_1.resolveCompanyContext; } });
Object.defineProperty(exports, "authorize", { enumerable: true, get: function () { return security_js_1.authorize; } });
Object.defineProperty(exports, "assertResourceOwnership", { enumerable: true, get: function () { return security_js_1.assertResourceOwnership; } });
Object.defineProperty(exports, "jwtSecret", { enumerable: true, get: function () { return security_js_1.jwtSecret; } });
