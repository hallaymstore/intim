import { Server } from 'socket.io';
import { config } from './config/env.js';
import { verifyAccess } from './middleware/auth.js';
import { User } from './models/User.js';
import { sendMessage } from './services/chat.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.clientOrigins, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const payload = verifyAccess(socket.handshake.auth?.token || '');
      const user = await User.findById(payload.sub).select('status');
      if (!user || user.status !== 'active') return next(new Error('unauthorized'));
      socket.data.userId = String(user._id);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const me = socket.data.userId;
    socket.join(`user:${me}`);

    socket.on('message:send', async (payload, ack) => {
      try {
        const msg = await sendMessage(me, payload?.to, payload?.text);
        ack?.({ ok: true, message: msg });
      } catch (e) {
        ack?.({ ok: false, error: e.message || 'Xatolik' });
      }
    });

    socket.on('typing', (payload) => {
      if (typeof payload?.to === 'string') {
        io.to(`user:${payload.to}`).emit('typing', { from: me });
      }
    });
  });

  return io;
}

export function emitToUser(userId, event, data) {
  io?.to(`user:${userId}`).emit(event, data);
}
