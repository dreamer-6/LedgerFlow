import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initializeBusiness } from '../database/seed.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ledgerflow_secure_secret_key_2026';

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
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // 1. Create User
    db.prepare(`
      INSERT INTO users (user_id, username, email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?, ?, 'ADMIN')
    `).run(userId, cleanEmail, cleanEmail, passwordHash, fullName.trim());

    // 2. Provision Isolated Business
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
      { userId, username: cleanEmail, role: 'ADMIN', name: fullName.trim(), email: cleanEmail },
      JWT_SECRET,
      { expiresIn: '30d' }
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
        role: 'ADMIN'
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

    const user = db.prepare(`
      SELECT user_id, username, email, password_hash, full_name, role
      FROM users
      WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND is_active = 1
    `).get(identifier, identifier) as any;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new Error('Invalid email or password.');
    }

    const token = jwt.sign(
      { userId: user.user_id, username: user.username, role: user.role, name: user.full_name, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    let businesses = db.prepare(`
      SELECT c.*, ub.role
      FROM companies c
      JOIN user_businesses ub ON c.company_id = ub.company_id
      WHERE ub.user_id = ?
      ORDER BY c.created_at ASC
    `).all(user.user_id) as any[];

    if (businesses.length === 0) {
      const defCompany = db.prepare('SELECT * FROM companies LIMIT 1').get() as any;
      if (defCompany) {
        db.prepare('INSERT OR IGNORE INTO user_businesses (user_id, company_id, role) VALUES (?, ?, ?)')
          .run(user.user_id, defCompany.company_id, 'OWNER');
        businesses = [{ ...defCompany, role: 'OWNER' }];
      }
    }

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

  static getMe(db: DatabaseSync, userId: string) {
    const dbUser = db.prepare('SELECT user_id, username, email, full_name, role FROM users WHERE user_id = ?').get(userId) as any;
    const businesses = db.prepare(`
      SELECT c.*, ub.role
      FROM companies c
      JOIN user_businesses ub ON c.company_id = ub.company_id
      WHERE ub.user_id = ?
      ORDER BY c.created_at ASC
    `).all(userId);

    return {
      user: dbUser,
      businesses
    };
  }
}
