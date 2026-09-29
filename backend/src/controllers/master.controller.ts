/**
 * MasterController — DEPRECATED
 *
 * All master data endpoints have been moved to the secure route handlers
 * in src/api/routes.ts as part of TASK 001 security implementation.
 *
 * This file is retained for reference only and is NOT mounted in any router.
 * It will be cleaned up in a future refactoring task.
 */

import { DatabaseSync } from 'node:sqlite';

export class MasterController {
  constructor(private _db: DatabaseSync) {}
}
