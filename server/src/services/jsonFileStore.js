const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { DATA_DIR, readJsonArray, writeJsonArray } = require('./opsStore');

function makeStore(filename) {
  const file = path.join(DATA_DIR, filename);

  function readAll() {
    return readJsonArray(file);
  }

  function writeAll(items) {
    writeJsonArray(file, items);
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