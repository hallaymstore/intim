import { io } from 'socket.io-client';
import { getToken } from './api';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
      // Har ulanishda joriy token olinadi
      auth: (cb) => cb({ token: getToken() }),
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
