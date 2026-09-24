"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const seed_js_1 = require("../database/seed.js");
const JWT_SECRET = process.env.JWT_SECRET || 'ledgerflow_secure_secret_key_2026';
class AuthService {
    static register(db, payload) {
        const { email, password, fullName, businessName, companyName, legalName, gstin, state, stateCode } = payload;
        const finalBusinessName = (businessName || companyName || '').trim();
        if (!email || !password || !fullName || !finalBusinessName) {
            throw new Error('Email, password, full name, and business name are required.');
        }
        const cleanEmail = email.trim().toLowerCase();
        const existing = db.prepare('SELECT user_id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
            .get(cleanEmail, cleanEmail);
        if (existing) {
            throw new Error('An account with this email address already exists. Please sign in.');
        }
        const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        const salt = bcryptjs_1.default.genSaltSync(10);
        const passwordHash = bcryptjs_1.default.hashSync(password, salt);
        // 1. Create User
        db.prepare(`
      INSERT INTO users (user_id, username, email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?, ?, 'ADMIN')
    `).run(userId, cleanEmail, cleanEmail, passwordHash, fullName.trim());
        // 2. Provision Isolated Business
        const companyId = 'comp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        (0, seed_js_1.initializeBusiness)(db, {
            companyId,
            companyName: finalBusinessName,
            legalName: (legalName || finalBusinessName).trim(),
            gstin: gstin ? gstin.trim() : '',
            state: state || 'Tamil Nadu',
            stateCode: stateCode || '33',
            ownerUserId: userId
        });
        const token = jsonwebtoken_1.default.sign({ userId, username: cleanEmail, role: 'ADMIN', name: fullName.trim(), email: cleanEmail }, JWT_SECRET, { expiresIn: '30d' });
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
    static login(db, payload) {
        const { username, email, emailOrUsername, password } = payload;
        const identifier = (emailOrUsername || email || username || '').trim().toLowerCase();
        if (!identifier || !password) {
            throw new Error('Email/username and password are required.');
        }
        const user = db.prepare(`
      SELECT user_id, username, email, password_hash, full_name, role
      FROM users
      WHERE (
        LOWER(username) = ? 
        OR LOWER(email) = ? 
        OR LOWER(full_name) = ?
        OR (LOWER(?) IN ('system administrator', 'administrator', 'system admin', 'admin') AND username = 'admin')
      ) AND is_active = 1
    `).get(identifier, identifier, identifier, identifier);
        if (!user || !bcryptjs_1.default.compareSync(password, user.password_hash)) {
            throw new Error('Invalid email or password.');
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.user_id, username: user.username, role: user.role, name: user.full_name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
        let businesses = [];
        if (user.role === 'ADMIN') {
            businesses = db.prepare("SELECT *, 'ADMIN' as role FROM companies ORDER BY created_at ASC").all();
        }
        else {
            businesses = db.prepare(`
        SELECT c.*, ub.role
        FROM companies c
        JOIN user_businesses ub ON c.company_id = ub.company_id
        WHERE ub.user_id = ?
        ORDER BY c.created_at ASC
      `).all(user.user_id);
        }
        if (businesses.length === 0) {
            const defCompany = db.prepare('SELECT * FROM companies LIMIT 1').get();
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
    static ssoLogin(db, payload) {
        const { provider = 'google', email, name } = payload;
        const cleanEmail = (email || '').trim().toLowerCase();
        if (!cleanEmail) {
            throw new Error('Email is required for SSO authentication.');
        }
        // Lookup existing user by email, username, or admin aliases
        let user = db.prepare(`
      SELECT user_id, username, email, password_hash, full_name, role, is_active
      FROM users
      WHERE LOWER(email) = ? 
         OR LOWER(username) = ?
         OR (LOWER(?) IN ('admin@ledgerflow.com', 'admin', 'system administrator', 'administrator') AND username = 'admin')
    `).get(cleanEmail, cleanEmail, cleanEmail);
        if (!user) {
            // Auto-provision user account seamlessly
            const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
            const baseUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'user';
            let username = baseUsername;
            let counter = 1;
            while (db.prepare('SELECT user_id FROM users WHERE username = ?').get(username)) {
                username = `${baseUsername}${counter++}`;
            }
            const rawName = name?.trim() || cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
            const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            const salt = bcryptjs_1.default.genSaltSync(10);
            const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
            const passwordHash = bcryptjs_1.default.hashSync(randomPassword, salt);
            db.prepare(`
        INSERT INTO users (user_id, username, email, password_hash, full_name, role, is_active)
        VALUES (?, ?, ?, ?, ?, 'ADMIN', 1)
      `).run(userId, username, cleanEmail, passwordHash, formattedName);
            user = {
                user_id: userId,
                username,
                email: cleanEmail,
                full_name: formattedName,
                role: 'ADMIN',
                is_active: 1
            };
        }
        if (user.is_active === 0) {
            throw new Error('This account has been deactivated. Please contact your system administrator.');
        }
        // Resolve companies/businesses
        let businesses = [];
        if (user.role === 'ADMIN') {
            businesses = db.prepare("SELECT *, 'ADMIN' as role FROM companies ORDER BY created_at ASC").all();
        }
        else {
            businesses = db.prepare(`
        SELECT c.*, ub.role
        FROM companies c
        JOIN user_businesses ub ON c.company_id = ub.company_id
        WHERE ub.user_id = ?
        ORDER BY c.created_at ASC
      `).all(user.user_id);
        }
        if (businesses.length === 0) {
            const defCompany = db.prepare('SELECT * FROM companies ORDER BY created_at ASC LIMIT 1').get();
            if (defCompany) {
                db.prepare('INSERT OR IGNORE INTO user_businesses (user_id, company_id, role) VALUES (?, ?, ?)')
                    .run(user.user_id, defCompany.company_id, 'OWNER');
                businesses = [{ ...defCompany, role: 'OWNER' }];
            }
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.user_id, username: user.username, role: user.role, name: user.full_name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
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
    static getMe(db, userId) {
        const dbUser = db.prepare('SELECT user_id, username, email, full_name, role FROM users WHERE user_id = ?').get(userId);
        let businesses = [];
        if (dbUser?.role === 'ADMIN') {
            businesses = db.prepare("SELECT *, 'ADMIN' as role FROM companies ORDER BY created_at ASC").all();
        }
        else {
            businesses = db.prepare(`
        SELECT c.*, ub.role
        FROM companies c
        JOIN user_businesses ub ON c.company_id = ub.company_id
        WHERE ub.user_id = ?
        ORDER BY c.created_at ASC
      `).all(userId);
        }
        return {
            user: {
                userId: dbUser.user_id,
                username: dbUser.username,
                email: dbUser.email,
                fullName: dbUser.full_name,
                role: dbUser.role
            },
            businesses
        };
    }
}
exports.AuthService = AuthService;
