import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initializeBusiness } from '../database/seed.js';
import { jwtSecret } from '../middleware/security.js';

export class AuthService {
  static register(db: DatabaseSync, payload: any) {
    const { email, password, fullName, businessName, companyName, legalName, gstin, state, stateCode } = payload;
    const finalBusinessName = (businessName || companyName || '').trim();

    if (!email || !password || !fullName || !finalBusinessName) {
      throw new Error('Email, password, full name, and business name are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT user_id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
      .get(cleanEmail, cleanEmail) as any;

    if (existing) {
      throw new Error('An account with this email address already exists. Please sign in.');
    }

    const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Public registration defaults strictly to ACCOUNTANT role per security policy
    const userRole = 'ACCOUNTANT';
    db.prepare(`
      INSERT INTO users (user_id, username, email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, cleanEmail, cleanEmail, passwordHash, fullName.trim(), userRole);

    // Provision isolated business
    const companyId = 'comp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    initializeBusiness(db, {
      companyId,
      companyName: finalBusinessName,
      legalName: (legalName || finalBusinessName).trim(),
      gstin: gstin ? gstin.trim() : '',
      state: state || 'Tamil Nadu',
      stateCode: stateCode || '33',
      ownerUserId: userId
    });

    const token = jwt.sign(
      { userId, username: cleanEmail, role: userRole, name: fullName.trim(), email: cleanEmail },
      jwtSecret(),
      { expiresIn: '7d' }
    );

    const businesses = db.prepare(`
      SELECT c.*, ub.role
      FROM companies c
      JOIN user_businesses ub ON c.company_id = ub.company_id
      WHERE ub.user_id = ?
      ORDER BY c.created_at ASC
    `).all(userId);

    return {
      token,
      user: {
        userId,
        email: cleanEmail,
        fullName: fullName.trim(),
        role: 'USER'
      },
      activeCompanyId: companyId,
      company: businesses[0] || null,
      businesses
    };
  }

  static login(db: DatabaseSync, payload: any) {
    const { username, email, emailOrUsername, password } = payload;
    const identifier = (emailOrUsername || email || username || '').trim().toLowerCase();

    if (!identifier || !password) {
      throw new Error('Email/username and password are required.');
    }

    // Match only on email or username — no full_name matching, no aliases
    const user = db.prepare(`
      SELECT user_id, username, email, password_hash, full_name, role, is_active
      FROM users
      WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND is_active = 1
    `).get(identifier, identifier) as any;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new Error('Invalid email or password.');
    }

    const token = jwt.sign(
      { userId: user.user_id, username: user.username, role: user.role, name: user.full_name, email: user.email },
      jwtSecret(),
      { expiresIn: '7d' }
    );

    // Return ONLY businesses the user is a member of
    const businesses = db.prepare(`
      SELECT c.*, ub.role
      FROM companies c
      JOIN user_businesses ub ON c.company_id = ub.company_id
      WHERE ub.user_id = ?
      ORDER BY c.created_at ASC
    `).all(user.user_id) as any[];

    return {
      token,
      user: {
        userId: user.user_id,
        email: user.email || user.username,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      },
      activeCompanyId: businesses[0]?.company_id || null,
      businesses
    };
  }

  /**
   * SSO is DISABLED — returns HTTP 501.
   * This method should never be called; the route returns 501 directly.
   * Left here for clarity in case of future OAuth/OIDC implementation.
   */
  static ssoDisabled(): never {
    throw new Error('SSO_DISABLED');
  }

  static getMe(db: DatabaseSync, userId: string) {
    // Always re-fetch from DB to reflect current state (handles deactivated users)
    const dbUser = db.prepare(
      'SELECT user_id, username, email, full_name, role, is_active FROM users WHERE user_id = ?'
    ).get(userId) as any;

    if (!dbUser || dbUser.is_active === 0) {
      throw new Error('USER_NOT_FOUND');
    }

    const businesses = db.prepare(`
      SELECT c.*, ub.role
      FROM companies c
      JOIN user_businesses ub ON c.company_id = ub.company_id
      WHERE ub.user_id = ?
      ORDER BY c.created_at ASC
    `).all(userId) as any[];

    return {
      user: {
        userId: dbUser.user_id,
        email: dbUser.email,
        username: dbUser.username,
        fullName: dbUser.full_name,
        role: dbUser.role
      },
      businesses
    };
  }
}
