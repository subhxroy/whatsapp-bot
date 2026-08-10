import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@private-md-bot/database';
import { isAdminUser } from '@private-md-bot/security';
import { sendPaymentNotificationEmail } from '../services/email';
import { SessionManager } from '../session-manager';

const submitPaymentSchema = z.object({
  utrNumber: z
    .string()
    .trim()
    .min(4, 'Please provide a valid UTR / Transaction Reference Number')
    .max(32, 'UTR reference is too long')
    .regex(/^[A-Za-z0-9\s-]+$/, 'UTR reference may only contain letters, digits, dashes and spaces'),
  amount: z.number().min(1).max(100000).default(100),
});

export async function registerPaymentRoutes(fastify: FastifyInstance, sessionManager: SessionManager) {
  // Get payment status for current authenticated user
  fastify.get('/api/payment/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { username?: string; email?: string; id?: string; role?: string };
    const userIdentifier = user?.email || user?.username || user?.id || '';

    if (!userIdentifier) {
      return reply.status(400).send({ error: 'User identifier not found' });
    }

    if (isAdminUser(user)) {
      return reply.send({ isApproved: true, status: 'APPROVED' });
    }

    const status = await db.getUserPaymentStatus(userIdentifier);
    return reply.send(status);
  });

  // Submit UTR Number after paying ₹100
  fastify.post(
    '/api/payment/submit',
    { preHandler: [fastify.authenticate], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
    const user = request.user as { username?: string; email?: string; id?: string };
    const userIdentifier = user?.email || user?.username || user?.id || '';

    const { utrNumber, amount } = submitPaymentSchema.parse(request.body);
    const normalizedUtr = utrNumber.replace(/\s+/g, ' ').trim();
    const normalizedAmount = Number(amount) || 100;

    const requestObj = await db.createPaymentRequest({
      userId: userIdentifier,
      userEmail: userIdentifier,
      utrNumber: normalizedUtr,
      amount: normalizedAmount,
    });

    await sendPaymentNotificationEmail({
      userEmail: userIdentifier,
      utrNumber: normalizedUtr,
      amount: normalizedAmount,
      paymentId: requestObj.id,
    });

    await db.createAuditLog({
      action: 'PAYMENT_SUBMITTED',
      actor: userIdentifier,
      details: `Submitted UTR ${normalizedUtr} for ₹${normalizedAmount}`,
      ipAddress: request.ip,
    });

    return reply.send({
      message: 'Payment reference submitted successfully. Pending admin approval.',
      status: 'PENDING',
      request: requestObj,
    });
  });

  // Admin Only: Get all pending & historical payment requests
  fastify.get('/api/payment/admin/requests', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { username?: string; email?: string; role?: string };

    if (!isAdminUser(user)) {
      return reply.status(403).send({ error: 'Access restricted to administrators' });
    }

    const requests = await db.getPaymentRequests();
    return reply.send({ requests });
  });

  // Admin Only: Approve a payment
  fastify.post('/api/payment/admin/approve', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { username?: string; email?: string; role?: string };

    if (!isAdminUser(user)) {
      return reply.status(403).send({ error: 'Access restricted to administrators' });
    }

    const { paymentId } = request.body as { paymentId?: string };
    if (!paymentId) {
      return reply.status(400).send({ error: 'paymentId is required' });
    }

    const updated = await db.updatePaymentStatus(paymentId, 'APPROVED');
    if (!updated) {
      return reply.status(404).send({ error: 'Payment request not found' });
    }

    await db.createAuditLog({
      action: 'PAYMENT_APPROVED',
      actor: user?.email || user?.username || '',
      details: `Approved payment ${paymentId} for user ${updated.userEmail}`,
      ipAddress: request.ip,
    });

    // Auto-connect the approved user's WhatsApp session
    const approvedUserId = updated.userEmail || updated.userId;
    if (approvedUserId) {
      sessionManager.connect(approvedUserId).catch((err: any) => {
        console.error(`[Payment] Auto-connect failed for ${approvedUserId}:`, err.message);
      });
    }

    return reply.send({ message: 'Payment approved successfully', request: updated });
  });

  // Admin Only: Reject or Revoke a payment
  const handleRejectOrRevoke = async (request: any, reply: any) => {
    const user = request.user as { username?: string; email?: string; role?: string };

    if (!isAdminUser(user)) {
      return reply.status(403).send({ error: 'Access restricted to administrators' });
    }

    const { paymentId } = request.body as { paymentId?: string };
    if (!paymentId) {
      return reply.status(400).send({ error: 'paymentId is required' });
    }

    const updated = await db.updatePaymentStatus(paymentId, 'REJECTED');
    if (!updated) {
      return reply.status(404).send({ error: 'Payment request not found' });
    }

    // Immediately disconnect user's active WhatsApp session when access is revoked/rejected
    const revokedUserId = updated.userEmail || updated.userId;
    if (revokedUserId) {
      sessionManager.disconnect(revokedUserId).catch((err: any) => {
        console.error(`[Payment] Disconnect failed on access revoke for ${revokedUserId}:`, err.message);
      });
    }

    await db.createAuditLog({
      action: 'PAYMENT_REVOKED',
      actor: user?.email || user?.username || '',
      details: `Revoked access / rejected payment ${paymentId} for user ${updated.userEmail}`,
      ipAddress: request.ip,
    });

    return reply.send({ message: 'User access revoked successfully', request: updated });
  };

  fastify.post('/api/payment/admin/reject', { preHandler: [fastify.authenticate] }, handleRejectOrRevoke);
  fastify.post('/api/payment/admin/revoke', { preHandler: [fastify.authenticate] }, handleRejectOrRevoke);
}
