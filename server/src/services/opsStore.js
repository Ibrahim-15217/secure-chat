const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function ensureFile(file) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf8');
}

function readJsonArray(file) {
  ensureFile(file);
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    throw new Error('stored payload is not an array');
  } catch (err) {
    // Self-heal: quarantine a torn/corrupt file so the service keeps running
    // instead of failing every store read (seen after Render disk corruption).
    // eslint-disable-next-line no-console
    console.error(`Store ${path.basename(file)} corrupt, quarantining: ${err.message}`);
    const backup = `${file}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(file, backup);
    } catch {
      // best effort
    }
    fs.writeFileSync(file, '[]', 'utf8');
    return [];
  }
}

function writeJsonArray(file, items) {
  ensureFile(file);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

module.exports = { DATA_DIR, readJsonArray, writeJsonArray };