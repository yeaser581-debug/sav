require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Must match the fallback in src/lib/auth.ts
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function getUserFromCookieHeader(cookieHeader) {
  const token = (cookieHeader || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('token='))
    ?.split('=')
    .slice(1)
    .join('=');
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.io
  const io = new Server(server);

  // Authenticate every connection using the same "token" cookie the app already
  // sets on login. Rejected here means the socket never reaches any handler below —
  // closes the previous "anyone can connect and emit anything" gap for all events
  // (chat, notifications, force-logout), not just one of them.
  io.use((socket, next) => {
    const user = getUserFromCookieHeader(socket.handshake.headers.cookie);
    if (!user) {
      return next(new Error('unauthorized'));
    }
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id, `(user ${socket.data.user.id}, role ${socket.data.user.role})`);

    // Join a specific issue room to receive messages
    socket.on('join_issue', (issueId) => {
      const roomName = `issue_${issueId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room ${roomName}`);
    });

    // Handle new message sending
    socket.on('send_message', (data) => {
      const roomName = `issue_${data.issueId}`;
      io.to(roomName).emit('new_message', data);
    });

    // Relay typing indicator to the other participant in the issue room
    socket.on('typing', (data) => {
      const roomName = `issue_${data.issueId}`;
      socket.to(roomName).emit('user_typing');
    });

    // Notify the room that a message was deleted so everyone refreshes
    socket.on('delete_message', (data) => {
      const roomName = `issue_${data.issueId}`;
      io.to(roomName).emit('message_deleted', data);
    });

    // Handle real-time notifications
    socket.on('send_notification', (targetUserId) => {
      // Broadcast to everyone. The client side checks if targetUserId matches.
      io.emit('new_notification', targetUserId);
    });

    // Force-disconnect an admin whose account was just disabled.
    // Broadcast to everyone; the client side checks if targetUserId matches.
    // Only a super admin's own authenticated connection may trigger this.
    socket.on('send_force_logout', (targetUserId) => {
      const user = socket.data.user;
      if (!user || user.role !== 'admin' || user.isSuperAdmin !== true) return;
      io.emit('force_logout', targetUserId);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server running`);
  });
});
