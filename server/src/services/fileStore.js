const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { makeStore } = require('./jsonFileStore');
const { logAudit } = require('./auditLogStore');
const config = require('../config');

const files = makeStore('files.json');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');

const DEFAULT_ACCESS_WINDOW = 900;
const MAX_ACCESS_WINDOW = 86400;

function bodyPath(fileId) {
  return path.join(UPLOADS_DIR, `${fileId}.bin`);
}

function ensureUploadsDir() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function sanitize(file) {
  if (!file) return null;
  const { ...safe } = file;
  return safe;
}

function createFileMeta({
  conversationId,
  senderId,
  name,
  mime,
  size,
  iv,
  authTag,
  wrappedKey,
  senderWrappedKey,
  accessWindowSeconds,
}) {
  const window = Math.min(Math.max(Number(accessWindowSeconds) || DEFAULT_ACCESS_WINDOW, 1), MAX_ACCESS_WINDOW);
  const now = new Date();
  const record = files.insert({
    conversation_id: conversationId,
    sender_id: senderId,
    name: String(name),
    mime: String(mime),
    size: Number(size),
    iv,
    auth_tag: authTag,
    encrypted_key_reference: wrappedKey,
    sender_key_reference: senderWrappedKey,
    access_window_seconds: window,
    expires_at: new Date(now.getTime() + window * 1000).toISOString(),
    status: 'uploading',
    download_count: 0,
  });
  logAudit({ user_id: senderId, event_type: 'file', action: 'file_upload_started', success: true, detail: { fileId: record.id, name: record.name, size: record.size } });
  return record;
}

function storeBody(fileId, bytes) {
  const file = files.findById(fileId);
  if (!file || file.status !== 'uploading') return null;
  ensureUploadsDir();
  fs.writeFileSync(bodyPath(fileId), bytes);
  const updated = files.update(fileId, { status: 'ready', updated_at: new Date().toISOString() });
  logAudit({ user_id: file.sender_id, event_type: 'file', action: 'file_upload_completed', success: true, detail: { fileId, size: bytes.length } });
  return updated;
}

function bodyExists(file) {
  return file && file.status === 'ready' && fs.existsSync(bodyPath(file.id)) && fs.statSync(bodyPath(file.id)).size === file.size;
}

function createDownloadToken(fileId, now = Date.now()) {
  const expiresInMs = Math.min(DEFAULT_ACCESS_WINDOW * 1000, 900000);
  const payload = Buffer.from(JSON.stringify({ fid: fileId, exp: now + expiresInMs })).toString('base64url');
  const sig = crypto.createHmac('sha256', config.jwt.secret).update(payload).digest('base64url');
  return { token: `${payload}.${sig}`, expiresAt: new Date(now + expiresInMs).toISOString() };
}

function verifyDownloadToken(token) {
  if (!token) return { error: 'Missing download token' };
  const parts = String(token).split('.');
  if (parts.length !== 2) return { error: 'Invalid download token' };
  const expected = crypto.createHmac('sha256', config.jwt.secret).update(parts[0]).digest('base64url');
  if (expected !== parts[1]) return { error: 'Invalid download token' };
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return { error: 'Invalid download token' };
  }
  if (!payload.fid || Date.now() >= payload.exp) {
    return { error: 'Download token expired' };
  }
  return { ok: true, fileId: payload.fid };
}

function listFilesFor(conversationId) {
  return files.where((f) => f.conversation_id === conversationId).map(sanitize);
}

function deleteFile(fileId, userId) {
  const file = files.findById(fileId);
  if (!file) return false;
  files.remove(fileId);
  const p = bodyPath(fileId);
  if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  logAudit({ user_id: userId, event_type: 'file', action: 'file_deleted', success: true, detail: { fileId, name: file.name } });
  return true;
}

function purgeExpiredFiles() {
  const now = Date.now();
  let purged = 0;
  for (const file of files.findAll()) {
    if (file.expires_at && new Date(file.expires_at).getTime() <= now) {
      if (files.remove(file.id)) {
        const p = bodyPath(file.id);
        if (fs.existsSync(p)) fs.rmSync(p, { force: true });
        logAudit({ user_id: file.sender_id, event_type: 'file', action: 'file_expired_purged', success: true, detail: { fileId: file.id, name: file.name } });
        purged += 1;
      }
    }
  }
  return purged;
}

module.exports = {
  files,
  createFileMeta,
  storeBody,
  bodyExists,
  createDownloadToken,
  verifyDownloadToken,
  listFilesFor,
  deleteFile,
  purgeExpiredFiles,
  bodyPath,
  sanitize,
};