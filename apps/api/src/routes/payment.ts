import { FastifyInstance } from 'fastify';
import { db } from '@private-md-bot/database';
import { sendPaymentNotificationEmail } from '../services/email';
import { SessionManager } from '../session-manager';

export async function registerPaymentRoutes(fastify: FastifyInstance, sessionManager: SessionManager) {
  // Get payment status for current authenticated user
  fastify.get('/api/payment/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { username?: string; email?: string; id?: string };
    const userIdentifier = user?.email || user?.username || user?.id || '';

    if (!userIdentifier) {
      return reply.status(400).send({ error: 'User identifier not found' });
    }

    const status = await db.getUserPaymentStatus(userIdentifier);
    return reply.send(status);
  });

  // Submit UTR Number after paying ₹100
  fastify.post('/api/payment/submit', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { username?: string; email?: string; id?: string };
    const userIdentifier = user?.email || user?.username || user?.id || '';

    const { utrNumber, amount = 100 } = request.body as { utrNumber?: string; amount?: number };

    if (!utrNumber || utrNumber.trim().length < 4) {
      return reply.status(400).send({ error: 'Please provide a valid UTR / Transaction Reference Number' });
    }

    const requestObj = await db.createPaymentRequest({
      userId: userIdentifier,
      userEmail: userIdentifier,
      utrNumber: utrNumber.trim(),
      amount: Number(amount) || 100,
    });

    await sendPaymentNotificationEmail({
      userEmail: userIdentifier,
      utrNumber: utrNumber.trim(),
      amount: Number(amount) || 100,
      paymentId: requestObj.id,
    });

    await db.createAuditLog({
      action: 'PAYMENT_SUBMITTED',
      actor: userIdentifier,
      details: `Submitted UTR ${utrNumber} for ₹${amount}`,
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
    const userIdentifier = user?.email || user?.username || '';

    const EXEMPT_EMAILS = ['contact.subhroy@gmail.com', 'aarxslan@gmail.com', 'admin', 'admin@openify.studio'];
    const isAdmin = EXEMPT_EMAILS.some((e) => e.toLowerCase() === userIdentifier.toLowerCase()) || user?.role === 'ADMIN' || user?.role === 'OWNER';

    if (!isAdmin) {
      return reply.status(403).send({ error: 'Access restricted to administrators' });
    }

    const requests = await db.getPaymentRequests();
    return reply.send({ requests });
  });

  // Admin Only: Approve a payment
  fastify.post('/api/payment/admin/approve', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { username?: string; email?: string; role?: string };
    const userIdentifier = user?.email || user?.username || '';

    const EXEMPT_EMAILS = ['contact.subhroy@gmail.com', 'aarxslan@gmail.com', 'admin', 'admin@openify.studio'];
    const isAdmin = EXEMPT_EMAILS.some((e) => e.toLowerCase() === userIdentifier.toLowerCase()) || user?.role === 'ADMIN' || user?.role === 'OWNER';

    if (!isAdmin) {
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
      actor: userIdentifier,
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

  // Admin Only: Reject a payment
  fastify.post('/api/payment/admin/reject', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { username?: string; email?: string; role?: string };
    const userIdentifier = user?.email || user?.username || '';

    const EXEMPT_EMAILS = ['contact.subhroy@gmail.com', 'aarxslan@gmail.com', 'admin', 'admin@openify.studio'];
    const isAdmin = EXEMPT_EMAILS.some((e) => e.toLowerCase() === userIdentifier.toLowerCase()) || user?.role === 'ADMIN' || user?.role === 'OWNER';

    if (!isAdmin) {
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

    await db.createAuditLog({
      action: 'PAYMENT_REJECTED',
      actor: userIdentifier,
      details: `Rejected payment ${paymentId} for user ${updated.userEmail}`,
      ipAddress: request.ip,
    });

    return reply.send({ message: 'Payment rejected', request: updated });
  });
}
