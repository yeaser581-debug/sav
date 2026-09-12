require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { principalIsValid, canAccessIssue } = require('./src/lib/socket-auth');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const REVALIDATE_INTERVAL_MS = 60 * 1000;

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'aftersales_db',
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  }),
});

const isValidPrincipal = (user) => principalIsValid(prisma, user);
const mayAccessIssue = (user, issueId) => canAccessIssue(prisma, user, issueId);

function joinedRoom(socket, issueId) {
  return Number.isInteger(issueId) && socket.rooms.has(`issue_${issueId}`);
}

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

  io.use(async (socket, next) => {
    const user = getUserFromCookieHeader(socket.handshake.headers.cookie);
    if (!user) {
      return next(new Error('unauthorized'));
    }
    if (!(await isValidPrincipal(user))) {
      console.warn(`[SOCKET AUTH] rejected ${user.role} ${user.id}: account disabled or removed`);
      return next(new Error('unauthorized'));
    }
    socket.data.user = user;
    next();
  });

  setInterval(async () => {
    const checked = new Map();
    for (const socket of io.sockets.sockets.values()) {
      const user = socket.data.user;
      if (!user) continue;

      const key = `${user.role}:${user.id}`;
      if (!checked.has(key)) checked.set(key, await isValidPrincipal(user));
      if (checked.get(key)) continue;

      console.warn(`[SOCKET AUTH] disconnecting ${key}: account disabled or removed`);
      socket.emit('force_logout', user.id);
      socket.disconnect(true);
    }
  }, REVALIDATE_INTERVAL_MS).unref();

  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log('Client connected:', socket.id, `(user ${user.id}, role ${user.role})`);

    socket.join(`user_${user.id}`);

    socket.on('join_issue', async (issueId) => {
      const id = Number(issueId);
      if (!(await mayAccessIssue(user, id))) {
        console.warn(`Socket ${socket.id} (user ${user.id}, ${user.role}) denied join of issue ${issueId}`);
        socket.emit('join_denied', issueId);
        return;
      }
      socket.join(`issue_${id}`);
    });

    socket.on('send_message', (data) => {
      const id = Number(data?.issueId);
      if (!joinedRoom(socket, id)) return;
      io.to(`issue_${id}`).emit('new_message', data);
    });

    socket.on('typing', (data) => {
      const id = Number(data?.issueId);
      if (!joinedRoom(socket, id)) return;
      socket.to(`issue_${id}`).emit('user_typing');
    });

    socket.on('delete_message', (data) => {
      const id = Number(data?.issueId);
      if (!joinedRoom(socket, id)) return;
      io.to(`issue_${id}`).emit('message_deleted', data);
    });

    socket.on('send_notification', (targetUserId) => {
      const id = Number(targetUserId);
      if (!Number.isInteger(id) || id <= 0) return;
      io.to(`user_${id}`).emit('new_notification', id);
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
