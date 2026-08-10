import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getAuth } from 'firebase-admin/auth';
import { db, getDb } from '@private-md-bot/database';
import { hashPassword, verifyPassword, isAdminUser } from '@private-md-bot/security';
import { logAudit } from '../queue';

const USERNAME_RE = /^[A-Za-z0-9._@+-]+$/;

const loginSchema = z.object({
  username: z.string().trim().min(3).max(254).regex(USERNAME_RE, 'Invalid characters in username'),
  password: z.string().min(6).max(128),
});

const setupSchema = z.object({
  username: z.string().trim().min(3).max(254).regex(USERNAME_RE, 'Invalid characters in username'),
  password: z.string().min(6).max(128),
});

const googleSchema = z.object({
  idToken: z.string().min(10),
});

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds (shortened for security)

export function registerAuthRoutes(fastify: FastifyInstance) {
  // Check if initial setup is needed
  fastify.get('/api/auth/status', async () => {
    const count = await db.countUsers();
    return { initialized: count > 0 };
  });

  // Initial admin setup
  fastify.post('/api/auth/setup', async (request, reply) => {
    const count = await db.countUsers();
    if (count > 0) {
      return reply.status(400).send({ error: 'Setup already completed' });
    }

    const { username, password } = setupSchema.parse(request.body);
    const passwordHash = await hashPassword(password);

    const user = await db.createUser({
      username,
      passwordHash,
      role: 'OWNER',
    });

    await logAudit('INITIAL_SETUP', username, 'Owner account created', request.ip);

    const token = fastify.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: '7d' }
    );
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
    });

    return { success: true, user: { id: user.id, username: user.username, role: user.role }, token };
  });

  // Login
  fastify.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
    const { username, password } = loginSchema.parse(request.body);

    const user = await db.findUserByUsername(username);
    if (!user) {
      await logAudit('LOGIN_FAILED', username, 'User not found', request.ip);
      return reply.status(401).send({ error: 'Invalid username or password' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await logAudit('LOGIN_FAILED', username, 'Invalid password', request.ip);
      return reply.status(401).send({ error: 'Invalid username or password' });
    }

    await logAudit('LOGIN_SUCCESS', username, 'User logged in', request.ip);

    const token = fastify.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: '7d' }
    );
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
    });

    return { success: true, user: { id: user.id, username: user.username, role: user.role }, token };
  });

  // Google sign-in (Firebase ID token verified via Admin SDK)
  fastify.post(
    '/api/auth/google',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
    let idToken: string;
    try {
      ({ idToken } = googleSchema.parse(request.body));
    } catch {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    // Ensure Firebase Admin app is initialized before getAuth()
    getDb();

    let payload;
    try {
      payload = await getAuth().verifyIdToken(idToken);
    } catch (err: any) {
      console.error('[AUTH] verifyIdToken failed:', err?.code, err?.message);
      const msg = err?.code === 'app/invalid-credential'
        ? 'Firebase Admin SDK credentials not configured (missing service account file)'
        : `Invalid Google credentials: ${err?.code ?? err?.message ?? 'unknown'}`;
      await logAudit('LOGIN_FAILED', 'google', msg, request.ip);
      return reply.status(401).send({ error: msg });
    }

    const email = (payload.email ?? '').trim().toLowerCase();
    if (!email) {
      await logAudit('LOGIN_FAILED', payload.uid, 'Google token has no email claim', request.ip);
      return reply.status(400).send({ error: 'Google account has no email address' });
    }

    let user = await db.findUserByUsername(email);
    if (!user) {
      const userCount = await db.countUsers();
      if (userCount === 0) {
        user = await db.createUser({
          username: email,
          passwordHash: '',
          role: 'OWNER',
          googleUid: payload.uid,
        });
        await logAudit('INITIAL_SETUP', email, 'Owner account created via Google sign-in', request.ip);
      } else {
        user = await db.createUser({
          username: email,
          passwordHash: '',
          role: 'USER',
          googleUid: payload.uid,
        });
        await logAudit('USER_CREATED', email, 'New user account created via Google sign-in', request.ip);
      }
    } else if (user.googleUid !== payload.uid) {
      await db.setUserGoogleUid(email, payload.uid);
    }

    await logAudit('LOGIN_SUCCESS', user.username, 'User logged in via Google', request.ip);

    const token = fastify.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: '7d' }
    );
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
    });

    return { success: true, user: { id: user.id, username: user.username, role: user.role }, token };
  });

  // Logout
  fastify.post('/api/auth/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { success: true };
  });

  // Current user info
  fastify.get('/api/auth/me', { onRequest: [fastify.authenticate] }, async (request) => {
    const authUser = (request as any).user;
    const user = await db.findUserById(authUser.id);
    if (!user) {
      return { user: null };
    }
    const adminCheck = isAdminUser({ ...user, email: user.username });
    const effectiveRole = adminCheck && user.role !== 'OWNER' && user.role !== 'ADMIN' ? 'ADMIN' : user.role;
    return {
      user: {
        id: user.id,
        username: user.username,
        role: effectiveRole,
        isAdmin: adminCheck,
        totpEnabled: user.totpEnabled,
        createdAt: user.createdAt,
      },
    };
  });
}
