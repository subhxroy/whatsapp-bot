import { FastifyInstance } from 'fastify';
import { SessionManager } from './session-manager';
import { WebSocket } from 'ws';

export function registerWebSocketGateway(fastify: FastifyInstance, sessionManager: SessionManager) {
  const userSockets = new Map<string, Set<WebSocket>>();

  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const token = (req.query as any)?.token || req.cookies?.token;
    if (!token) {
      socket.close(4001, 'Unauthorized');
      return;
    }

    let userId: string;
    try {
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
  });
}
