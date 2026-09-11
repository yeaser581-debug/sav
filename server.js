require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

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

const app = next({ dev });
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

  const io = new Server(server);

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

    socket.on('join_issue', (issueId) => {
      const roomName = `issue_${issueId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room ${roomName}`);
    });

    socket.on('send_message', (data) => {
      const roomName = `issue_${data.issueId}`;
      io.to(roomName).emit('new_message', data);
    });

    socket.on('typing', (data) => {
      const roomName = `issue_${data.issueId}`;
      socket.to(roomName).emit('user_typing');
    });

    socket.on('delete_message', (data) => {
      const roomName = `issue_${data.issueId}`;
      io.to(roomName).emit('message_deleted', data);
    });

    socket.on('send_notification', (targetUserId) => {
      io.emit('new_notification', targetUserId);
    });

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
