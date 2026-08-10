import { FastifyInstance } from 'fastify';
import { SessionManager } from './session-manager';
import { WebSocket } from 'ws';
import { db } from '@private-md-bot/database';

export function registerWebSocketGateway(fastify: FastifyInstance, sessionManager: SessionManager) {
  const userSockets = new Map<string, Set<WebSocket>>();

  fastify.get('/ws', { websocket: true }, (socket, req) => {
    // SECURITY: the token is read from the httpOnly cookie ONLY. A query-string
    // token leaks through logs, proxies and referer headers — it is not accepted.
    const token = req.cookies?.token;
    if (!token) {
      socket.close(4001, 'Unauthorized');
      return;
    }

    let userId: string;
    try {
      // Algorithm pinning is enforced at the plugin level (HS256 only).
      const decoded = fastify.jwt.verify(token) as { id?: string; username?: string };
      userId = decoded?.id || decoded?.username || '';
    } catch {
      socket.close(4001, 'Unauthorized');
      return;
    }

    if (!userId) {
      socket.close(4001, 'Unauthorized');
      return;
    }

    // SECURITY: reload the user from the database. A validly-signed token for a
    // deleted/revoked account must NOT keep the socket open (fail closed).
    db.findUserById(userId)
      .then((dbUser) => {
        if (!dbUser) {
          socket.close(4001, 'Unauthorized');
          return;
        }
        // Canonical session id = username (matches connect/pair-code/payment flows).
        attachSocket(fastify, sessionManager, userSockets, socket, dbUser.username || dbUser.id);
      })
      .catch(() => {
        socket.close(4001, 'Unauthorized');
      });
  });
}

function attachSocket(
  fastify: FastifyInstance,
  sessionManager: SessionManager,
  userSockets: Map<string, Set<WebSocket>>,
  socket: WebSocket,
  userId: string
) {
  // Track this socket for this user
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());

    // Subscribe to status changes for this user
    const client = sessionManager.get(userId);
    if (client) {
      client.onStatusChange((status, qr) => {
        const sockets = userSockets.get(userId);
        if (!sockets) return;
        const payload = JSON.stringify({ type: 'STATUS_UPDATE', status, qr });
        sockets.forEach((s) => {
          if (s.readyState === WebSocket.OPEN) s.send(payload);
        });
      });
    }
  }
  userSockets.get(userId)!.add(socket);

  // Send immediate initial status
  const { status, qrCode } = sessionManager.getStatus(userId);
  socket.send(JSON.stringify({ type: 'STATUS_UPDATE', status, qr: qrCode }));

  socket.on('close', () => {
    userSockets.get(userId)?.delete(socket);
  });
}
