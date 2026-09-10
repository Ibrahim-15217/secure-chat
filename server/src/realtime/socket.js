const { Server } = require('socket.io');
const { verifyToken } = require('../services/authService');
const conversationStore = require('../services/conversationStore');

function attachRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return next(new Error('Unauthorized'));
    socket.user = { id: payload.sub, role: payload.role, email: payload.email };
    return next();
  });

  io.on('connection', (socket) => {
    const { id: userId } = socket.user;

    socket.on('conversation:join', ({ conversationId } = {}, ack) => {
      const conversation = conversationStore.conversations.findById(conversationId);
      if (!conversation || !conversationStore.isParticipant(conversation, userId)) {
        if (typeof ack === 'function') ack({ error: 'Forbidden' });
        return;
      }
      socket.join(`conversation:${conversation.id}`);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('conversation:leave', ({ conversationId } = {}) => {
      if (conversationId) socket.leave(`conversation:${conversationId}`);
    });

    socket.on('message:send', ({ conversationId, ...payload } = {}, ack) => {
      const conversation = conversationStore.conversations.findById(conversationId);
      if (!conversation || !conversationStore.isParticipant(conversation, userId)) {
        if (typeof ack === 'function') ack({ error: 'Forbidden' });
        return;
      }
      const { ciphertext, iv, wrappedKey, senderWrappedKey } = payload || {};
      if (!ciphertext || !iv || !wrappedKey || !senderWrappedKey) {
        if (typeof ack === 'function') ack({ error: 'ciphertext, iv, wrappedKey and senderWrappedKey are required' });
        return;
      }
      const message = conversationStore.createMessage(conversation, userId, {
        ciphertext,
        iv,
        wrappedKey,
        senderWrappedKey,
      });
      io.to(`conversation:${conversation.id}`).emit('message:new', { message });
      if (typeof ack === 'function') ack({ ok: true, message });
    });

    socket.on('message:read', ({ messageId } = {}, ack) => {
      const message = conversationStore.messages.findById(messageId);
      if (!message || !conversationStore.isParticipant(conversationStore.conversations.findById(message.conversation_id), userId)) {
        if (typeof ack === 'function') ack({ error: 'Forbidden' });
        return;
      }
      if (message.recipient_id !== userId) {
        if (typeof ack === 'function') ack({ error: 'Only the recipient can mark as read' });
        return;
      }
      const updated = message.read_at
        ? message
        : conversationStore.messages.update(message.id, { read_at: new Date().toISOString() });
      io.to(`conversation:${message.conversation_id}`).emit('message:read', { messageId: message.id, readAt: updated.read_at });
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('typing:start', ({ conversationId } = {}, ack) => {
      const conversation = conversationStore.conversations.findById(conversationId);
      if (!conversation || !conversationStore.isParticipant(conversation, userId)) {
        if (typeof ack === 'function') ack({ error: 'Forbidden' });
        return;
      }
      socket.to(`conversation:${conversation.id}`).emit('typing:start', { conversationId, userId });
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('typing:stop', ({ conversationId } = {}, ack) => {
      const conversation = conversationStore.conversations.findById(conversationId);
      if (!conversation || !conversationStore.isParticipant(conversation, userId)) {
        if (typeof ack === 'function') ack({ error: 'Forbidden' });
        return;
      }
      socket.to(`conversation:${conversation.id}`).emit('typing:stop', { conversationId, userId });
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('disconnect', () => {
      socket.rooms.forEach((room) => {
        if (room.startsWith('conversation:')) socket.leave(room);
      });
    });
  });

  return io;
}

module.exports = { attachRealtime };