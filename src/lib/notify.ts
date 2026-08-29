import { io } from 'socket.io-client';

export function pushNotifications(targetUserIds?: number[]) {
  if (!targetUserIds || targetUserIds.length === 0) return;
  const socket = io();
  socket.on('connect', () => {
    targetUserIds.forEach((uid) => socket.emit('send_notification', uid));
    socket.disconnect();
  });
}

export function forceLogout(targetUserId: number) {
  const socket = io();
  socket.on('connect', () => {
    socket.emit('send_force_logout', targetUserId);
    socket.disconnect();
  });
}
