const { makeStore } = require('./jsonFileStore');

const store = makeStore('audit_logs.json');

function logAudit({ user_id, event_type, action, success = true, detail }) {
  return store.insert({
    user_id: user_id || null,
    event_type,
    action,
    success,
    detail: detail || null,
  });
}

module.exports = { logAudit, auditLogs: store };