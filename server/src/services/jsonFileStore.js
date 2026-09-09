const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function makeStore(filename) {
  const file = path.join(DATA_DIR, filename);

  function ensureFile() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf8');
  }

  function readAll() {
    ensureFile();
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : [];
  }

  function writeAll(items) {
    ensureFile();
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
  }

  function findAll() {
    return readAll();
  }

  function findById(id) {
    return readAll().find((item) => item.id === id);
  }

  function where(predicate) {
    return readAll().filter(predicate);
  }

  function findOne(predicate) {
    return readAll().find(predicate);
  }

  function insert(item) {
    const items = readAll();
    const record = { id: uuidv4(), created_at: new Date().toISOString(), ...item };
    items.push(record);
    writeAll(items);
    return record;
  }

  function update(id, patch) {
    const items = readAll();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...patch, updated_at: new Date().toISOString() };
    writeAll(items);
    return items[index];
  }

  function remove(id) {
    const items = readAll();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    items.splice(index, 1);
    writeAll(items);
    return true;
  }

  return { findAll, findById, where, findOne, insert, update, remove };
}

module.exports = { makeStore, DATA_DIR };