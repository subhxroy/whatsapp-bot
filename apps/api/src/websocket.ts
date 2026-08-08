import { FastifyInstance } from 'fastify';
import { WhatsAppClient } from '@private-md-bot/whatsapp';
import { WebSocket } from 'ws';

export function registerWebSocketGateway(fastify: FastifyInstance, waClient: WhatsAppClient) {
  const clients = new Set<WebSocket>();

  waClient.onStatusChange((status, qr) => {
    const payload = JSON.stringify({ type: 'STATUS_UPDATE', status, qr });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  fastify.get('/ws', { websocket: true }, (socket, req) => {
    // Authenticate WS connection using JWT token from query string or cookie
    const token = (req.query as any)?.token || req.cookies?.token;
    if (!token) {
      socket.close(4001, 'Unauthorized');
      return;
    }

    try {
      fastify.jwt.verify(token);
    } catch {
      socket.close(4001, 'Unauthorized');
      return;
    }

    clients.add(socket);

    // Send immediate initial status
    socket.send(
      JSON.stringify({
        type: 'STATUS_UPDATE',
        status: waClient.getStatus(),
        qr: waClient.getQRCode(),
      })
    );

    socket.on('close', () => {
      clients.delete(socket);
    });
  });
}
