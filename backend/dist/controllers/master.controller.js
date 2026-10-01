"use strict";
/**
 * MasterController — DEPRECATED
 *
 * All master data endpoints have been moved to the secure route handlers
 * in src/api/routes.ts as part of TASK 001 security implementation.
 *
 * This file is retained for reference only and is NOT mounted in any router.
 * It will be cleaned up in a future refactoring task.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterController = void 0;
class MasterController {
    _db;
    constructor(_db) {
        this._db = _db;
    }
}
exports.MasterController = MasterController;
